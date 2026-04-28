/*=====================================================================
  Provinent Scripture Study – settings.js
  User settings and data management
=====================================================================*/

import { stopChapterAudio } from './api.js';
import { getVerseTextFromStorage } from './highlights.js';
import { 
    applyColorTheme, 
    applyTheme, 
    formatDateTime, 
    formatFileSize, 
    getFormattedDateForFilename, 
    getFormattedDateForDisplay, 
    handleError, 
    handleNarratorChange, 
    showLoading 
} from '../main.js';
import { populateChapterDropdown, updateChapterDropdownVisibility } from './navigation.js';
import { 
    APP_VERSION, 
    BOOK_ORDER, 
    saveToCookies, 
    saveToStorage, 
    state, 
    updateBibleGatewayVersion, 
    updateURL 
} from './state.js';
import { 
    restorePanelStates, 
    restoreSidebarState, 
    switchNotesView, 
    updateMarkdownPreview, 
    updateScriptureFontSize 
} from './ui.js';

/* ====================================================================
   IMPORT STATE
   Temporary storage for pending imports
==================================================================== */

let pendingImportFile = null;
let pendingImportData = null;

/* ====================================================================
   DATA EXPORT/IMPORT
==================================================================== */

/**
 * Export all user data to JSON file
 */
export function exportData() {
    try {
        const fileDate = getFormattedDateForFilename();
        const exportDate = getFormattedDateForDisplay();
        
        // Build highlights with text for convenience (read-only in exports)
        const highlightsWithText = {};
        Object.keys(state.highlights).forEach(reference => {
            const verseText = getVerseTextFromStorage(reference) || '';
            highlightsWithText[reference] = {
                color: state.highlights[reference],
                text: verseText,
                timestamp: state.highlightMeta?.[reference]?.timestamp || null
            };
        });
        
        const payload = {
            version: '2.1',  // New version for timestamp support
            exportDate: exportDate,
            highlights: state.highlights,           // Simple color mapping
            highlightMeta: state.highlightMeta,     // Timestamps
            highlightsWithText: highlightsWithText, // For human readability
            notes: state.notes,
            settings: { ...state.settings }
        };

        const jsonString = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const fileSize = blob.size;
        const filename = `provinent-backup-${fileDate}.json`;
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        // Store export info in state
        state.settings.lastExport = {
            filename: filename,
            date: new Date().toISOString(),
            size: fileSize
        };
        
        saveToStorage();
        
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Failed to export data. See console for details.');
    }
}

/**
 * Import data from JSON backup file
 * @param {Event} event - File input change event
 */
export function importData(event) {
    try {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const fileContent = e.target.result;
                const data = JSON.parse(fileContent);
                
                // Validate the data
                validateImportData(data);
                
                // Store for later use
                pendingImportFile = file;
                pendingImportData = data;
                
                // Show import options modal
                showImportOptionsModal();
                
            } catch (error) {
                console.error('Error reading import file:', error);
                alert('Invalid backup file format: ' + error.message);
            }
        };
        
        reader.onerror = () => {
            alert('Error reading file. Please try again.');
        };
        
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
        
    } catch (error) {
        console.error('Error importing data:', error);
        alert('Failed to import data. See console for details.');
    }
}

/**
 * Validate imported data structure
 * @param {Object} data - Imported data
 * @throws {Error} - If data is invalid
 */
function validateImportData(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid backup file: not a valid JSON object');
    }
    
    if (!data.settings || typeof data.settings !== 'object') {
        throw new Error('Invalid backup format: missing settings');
    }
    
    // Version 2.1+ should have separate highlights and highlightMeta
    if (data.version === '2.1') {
        if (data.highlights && typeof data.highlights !== 'object') {
            throw new Error('Invalid backup format: highlights must be an object');
        }
        if (data.highlightMeta && typeof data.highlightMeta !== 'object') {
            throw new Error('Invalid backup format: highlightMeta must be an object');
        }
    }
    
    // Version 2.0 or older uses nested format - still valid, but check if exists
    if (data.version === '2.0' || !data.version) {
        if (data.highlights && typeof data.highlights !== 'object') {
            throw new Error('Invalid backup format: highlights must be an object');
        }
    }
    
    // Notes should be a string if present
    if (data.notes !== undefined && typeof data.notes !== 'string') {
        throw new Error('Invalid backup format: notes must be a string');
    }
}

/* ====================================================================
   IMPORT OPTIONS MODAL
==================================================================== */

/**
 * Show import options modal
 */
function showImportOptionsModal() {
    const modal = document.getElementById('importOptionsModal');
    const overlay = document.getElementById('importOptionsOverlay');
    
    if (!modal || !overlay) {
        console.error('Import options modal elements not found');
        return;
    }
    
    // Set default values
    const mergeHighlightsToggle = document.getElementById('mergeHighlightsToggle');
    const mergeNotesToggle = document.getElementById('mergeNotesToggle');
    const preserveSettingsToggle = document.getElementById('preserveSettingsToggle');
    
    if (mergeHighlightsToggle) mergeHighlightsToggle.checked = true;
    if (mergeNotesToggle) mergeNotesToggle.checked = false;
    if (preserveSettingsToggle) preserveSettingsToggle.checked = true;
    
    // Update summary
    updateImportSummary();
    
    // Show modal
    modal.classList.add('active');
    overlay.classList.add('active');
    
    // Set up event listeners
    setupImportOptionsListeners();
}

/**
 * Close import options modal
 */
function closeImportOptionsModal() {
    const modal = document.getElementById('importOptionsModal');
    const overlay = document.getElementById('importOptionsOverlay');
    
    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    
    // Clear pending data
    pendingImportFile = null;
    pendingImportData = null;
}

/**
 * Set up import options event listeners
 */
function setupImportOptionsListeners() {
    // Toggle listeners for updating summary
    const toggles = ['mergeHighlightsToggle', 'mergeNotesToggle', 'preserveSettingsToggle'];
    toggles.forEach(id => {
        const toggle = document.getElementById(id);
        if (toggle) {
            toggle.removeEventListener('change', updateImportSummary);
            toggle.addEventListener('change', updateImportSummary);
        }
    });
    
    // Confirm button
    const confirmBtn = document.getElementById('confirmImportBtn');
    if (confirmBtn) {
        confirmBtn.removeEventListener('click', handleConfirmImport);
        confirmBtn.addEventListener('click', handleConfirmImport);
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('cancelImportBtn');
    if (cancelBtn) {
        cancelBtn.removeEventListener('click', closeImportOptionsModal);
        cancelBtn.addEventListener('click', closeImportOptionsModal);
    }
    
    // Close button
    const closeBtn = document.getElementById('closeImportOptionsBtn');
    if (closeBtn) {
        closeBtn.removeEventListener('click', closeImportOptionsModal);
        closeBtn.addEventListener('click', closeImportOptionsModal);
    }
    
    // Overlay click
    const overlay = document.getElementById('importOptionsOverlay');
    if (overlay) {
        overlay.removeEventListener('click', closeImportOptionsModal);
        overlay.addEventListener('click', closeImportOptionsModal);
    }
}

/**
 * Update import summary based on selected options
 */
function updateImportSummary() {
    const mergeHighlights = document.getElementById('mergeHighlightsToggle')?.checked;
    const mergeNotes = document.getElementById('mergeNotesToggle')?.checked;
    const preserveSettings = document.getElementById('preserveSettingsToggle')?.checked;
    
    const summaryList = document.getElementById('importSummaryList');
    if (!summaryList) return;
    
    const currentHighlights = Object.keys(state.highlights).length;
    const importedHighlights = pendingImportData?.highlights ? 
        Object.keys(pendingImportData.highlights).length : 0;
    
    let html = '';
    
    // Highlights summary
    if (mergeHighlights) {
        html += `<li class="success">
            <i class="fas fa-check-circle"></i>
            <strong>Highlights:</strong> Merge ${importedHighlights} imported with ${currentHighlights} existing
        </li>`;
    } else {
        html += `<li class="warning">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Highlights:</strong> Replace all ${currentHighlights} existing with ${importedHighlights} imported
        </li>`;
    }
    
    // Notes summary
    if (mergeNotes) {
        html += `<li class="success">
            <i class="fas fa-check-circle"></i>
            <strong>Notes:</strong> Append imported notes to existing notes
        </li>`;
    } else {
        html += `<li class="warning">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Notes:</strong> Replace existing notes with imported notes
        </li>`;
    }
    
    // Settings summary
    if (preserveSettings) {
        html += `<li class="success">
            <i class="fas fa-check-circle"></i>
            <strong>Settings:</strong> Keep your current device settings
        </li>`;
    } else {
        html += `<li class="warning">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Settings:</strong> Apply imported settings (translation, theme, etc.)
        </li>`;
    }
    
    summaryList.innerHTML = html;
}

/**
 * Handle confirm import button click
 */
function handleConfirmImport() {
    if (!pendingImportData || !pendingImportFile) {
        alert('No import data available');
        return;
    }
    
    try {
        const options = {
            mergeHighlights: document.getElementById('mergeHighlightsToggle')?.checked ?? true,
            mergeNotes: document.getElementById('mergeNotesToggle')?.checked ?? false,
            preserveSettings: document.getElementById('preserveSettingsToggle')?.checked ?? true
        };
        
        // Store references locally before closing modal
        const importData = pendingImportData;
        const importFile = pendingImportFile;
        
        // Close options modal (this clears pendingImportData)
        closeImportOptionsModal();
        
        // Apply the import with options using local references
        applyImportedDataWithOptions(importData, options);
        
        // Store import info
        state.settings.lastImport = {
            filename: importFile.name,
            date: new Date().toISOString(),
            size: importFile.size
        };
        
        // Save and reload
        saveImportedData();
        updateUIAfterImport(importData);
        
        alert('Import successful! Page will refresh to apply changes.');
        setTimeout(() => window.location.reload(), 1000);
        
    } catch (error) {
        console.error('Error during import:', error);
        alert('Import failed: ' + error.message);
    }
}

/**
 * Apply imported data with merge options
 * @param {Object} incoming - Imported data
 * @param {Object} options - Import options
 */
function applyImportedDataWithOptions(incoming, options) {
    try {
        // 1. Handle Settings
        if (!options.preserveSettings && incoming.settings) {
            console.log('Applying imported settings...');
            Object.assign(state.settings, incoming.settings);
        } else {
            console.log('Preserving current device settings');
        }
        
        // Initialize metadata if needed
        if (!state.highlightMeta) {
            state.highlightMeta = {};
        }
        
        // 2. Handle Highlights
        if (incoming.version === '2.1') {
            // New format
            if (options.mergeHighlights) {
                console.log('Merging highlights...');
                // Merge highlights and metadata
                state.highlights = { ...state.highlights, ...(incoming.highlights || {}) };
                state.highlightMeta = { ...state.highlightMeta, ...(incoming.highlightMeta || {}) };
            } else {
                console.log('Replacing highlights...');
                // Replace completely
                state.highlights = incoming.highlights || {};
                state.highlightMeta = incoming.highlightMeta || {};
            }
            
            // Cache verse text if available
            if (incoming.highlightsWithText) {
                cacheVerseText(incoming.highlightsWithText, options.mergeHighlights);
            }
            
        } else {
            // Old format - backwards compatibility
            console.log('Processing legacy format...');
            const { colorMap, metaMap, verseTextMap } = extractLegacyHighlights(incoming.highlights || {});
            
            if (options.mergeHighlights) {
                console.log('Merging legacy highlights...');
                state.highlights = { ...state.highlights, ...colorMap };
                state.highlightMeta = { ...state.highlightMeta, ...metaMap };
            } else {
                console.log('Replacing with legacy highlights...');
                state.highlights = colorMap;
                state.highlightMeta = metaMap;
            }
            
            if (Object.keys(verseTextMap).length > 0) {
                cacheVerseTextLegacy(verseTextMap, options.mergeHighlights);
            }
        }
        
        // 3. Handle Notes
        if (options.mergeNotes) {
            console.log('Merging notes...');
            if (incoming.notes) {
                // Append with separator if current notes exist
                if (state.notes && state.notes.trim()) {
                    state.notes = state.notes + '\n\n---\n\n' + incoming.notes;
                } else {
                    state.notes = incoming.notes;
                }
            }
        } else {
            console.log('Replacing notes...');
            state.notes = incoming.notes || '';
        }
        
        console.log('Import complete:', {
            highlights: Object.keys(state.highlights).length,
            metadata: Object.keys(state.highlightMeta).length,
            notesLength: state.notes.length
        });
        
    } catch (error) {
        console.error('Error applying imported data:', error);
        throw new Error('Failed to apply imported data: ' + error.message);
    }
}

/**
 * Extract highlights from legacy format
 * @param {Object} incomingHighlights - Old format highlights
 * @returns {Object} - Extracted data
 */
function extractLegacyHighlights(incomingHighlights) {
    const colorMap = {};
    const verseTextMap = {};
    const metaMap = {};
    
    Object.entries(incomingHighlights).forEach(([reference, data]) => {
        if (typeof data === 'string') {
            colorMap[reference] = data;
        } else if (data && typeof data === 'object') {
            if (data.color) {
                colorMap[reference] = data.color;
            }
            if (data.text) {
                verseTextMap[reference] = data.text;
            }
            if (data.timestamp) {
                metaMap[reference] = { timestamp: data.timestamp };
            }
        }
    });
    
    return { colorMap, metaMap, verseTextMap };
}

/**
 * Cache verse text from new format
 * @param {Object} highlightsWithText - Highlights with text
 * @param {boolean} merge - Whether to merge or replace
 */
function cacheVerseText(highlightsWithText, merge = true) {
    try {
        let cached = {};
        
        if (merge) {
            const cachedRaw = localStorage.getItem('cachedVerses');
            cached = cachedRaw ? JSON.parse(cachedRaw) : {};
        }
        
        Object.entries(highlightsWithText).forEach(([reference, data]) => {
            if (data && data.text && typeof data.text === 'string') {
                cached[reference] = data.text;
            }
        });
        
        localStorage.setItem('cachedVerses', JSON.stringify(cached));
        console.log('Cached verse text for', Object.keys(highlightsWithText).length, 'verses');
    } catch (e) {
        console.error('Failed to cache verse text:', e);
    }
}

/**
 * Cache verse text from legacy format
 * @param {Object} verseTextMap - Map of verse text
 * @param {boolean} merge - Whether to merge or replace
 */
function cacheVerseTextLegacy(verseTextMap, merge = true) {
    try {
        let cached = {};
        
        if (merge) {
            const cachedRaw = localStorage.getItem('cachedVerses');
            cached = cachedRaw ? JSON.parse(cachedRaw) : {};
        }
        
        Object.assign(cached, verseTextMap);
        localStorage.setItem('cachedVerses', JSON.stringify(cached));
        console.log('Cached verse text for', Object.keys(verseTextMap).length, 'verses (legacy)');
    } catch (e) {
        console.error('Failed to cache verse text:', e);
    }
}

/**
 * Save imported data to storage
 */
function saveImportedData() {
    saveToStorage();
    updateURL(
        state.settings.bibleTranslation,
        state.settings.manualBook,
        state.settings.manualChapter,
        'push'
    );
}

/**
 * Update UI after import
 * @param {Object} incoming - Imported data
 */
function updateUIAfterImport(incoming) {
    applyTheme();
    applyColorTheme();
    restoreSidebarState();
    restorePanelStates();
    switchNotesView(state.settings.notesView || 'text');
    
    const notesInput = document.getElementById('notesInput');
    if (notesInput) notesInput.value = state.notes;
    
    updateMarkdownPreview();
    updateDropdownsFromSettings(incoming.settings);
}

/**
 * Update dropdowns from imported settings
 * @param {Object} settings - Imported settings
 */
function updateDropdownsFromSettings(settings) {
    const bookSelect = document.getElementById('bookSelect');
    const chapterSelect = document.getElementById('chapterSelect');
    
    if (bookSelect && settings.manualBook) {
        bookSelect.value = settings.manualBook;
        populateChapterDropdown(settings.manualBook);
    }
    
    if (chapterSelect && settings.manualChapter) {
        chapterSelect.value = settings.manualChapter;
    }
    
    updateChapterDropdownVisibility(settings.manualBook);
}

/**
 * Update file info display in settings modal
 */
function updateFileInfoDisplay() {
    const lastExportInfo = document.getElementById('lastExportInfo');
    const lastImportInfo = document.getElementById('lastImportInfo');
    
    if (!lastExportInfo || !lastImportInfo) return;
    
    // Update export info
    if (state.settings.lastExport) {
        const exp = state.settings.lastExport;
        lastExportInfo.innerHTML = `
            <div class="file-info-details">
                <div class="info-row">
                    <p>
                        <span class="info-label" style="font-weight: bold;">File:</span>
                    </p>
                    <span class="info-value">${exp.filename}</span>
                </div>
                <div class="info-row">
                    <p>
                        <span class="info-label" style="font-weight: bold;">Date:</span>
                    </p>
                    <span class="info-value">${formatDateTime(exp.date)}</span>
                </div>
                <div class="info-row">
                    <p>
                        <span class="info-label" style="font-weight: bold;">Size:</span>
                    </p>
                    <span class="info-value">${formatFileSize(exp.size)}</span>
                </div>
            </div>
        `;
    } else {
        lastExportInfo.innerHTML = '<p class="no-data">No exports yet</p>';
    }
    
    // Update import info
    if (state.settings.lastImport) {
        const imp = state.settings.lastImport;
        lastImportInfo.innerHTML = `
            <div class="file-info-details">
                <div class="info-row">
                    <p>
                        <span class="info-label" style="font-weight: bold;">File:</span>
                    </p>
                    <span class="info-value">${imp.filename}</span>
                </div>
                <div class="info-row">
                    <p>
                        <span class="info-label" style="font-weight: bold;">Date:</span>
                    </p>
                    <span class="info-value">${formatDateTime(imp.date)}</span>
                </div>
                <div class="info-row">
                    <p>
                        <span class="info-label" style="font-weight: bold;">Size:</span>
                    </p>
                    <span class="info-value">${formatFileSize(imp.size)}</span>
                </div>
            </div>
        `;
    } else {
        lastImportInfo.innerHTML = '<p class="no-data">No imports yet</p>';
    }
}

/* ====================================================================
   SETTINGS MODAL
==================================================================== */

/**
 * Open settings modal
 */
export function openSettings() {
    try {
        populateSettingsForm();
        updateFileInfoDisplay();
        showSettingsModal();
        
    } catch (error) {
        console.error('Error opening settings:', error);
    }
}

/**
 * Populate settings form with current values
 */
function populateSettingsForm() {
    const translationSelect = document.getElementById('bibleTranslationSetting');
    const audioToggle = document.getElementById('audioControlsToggle');
    const autoplayToggle = document.getElementById('autoplayAudioToggle');
    const versionElement = document.getElementById('appVersion');
    const scriptureFontSizeSlider = document.getElementById('scriptureFontSizeSlider');
    const scriptureFontSizeValue = document.getElementById('scriptureFontSizeValue');
    const notesFontSizeSlider = document.getElementById('notesFontSizeSlider');
    const notesFontSizeValue = document.getElementById('notesFontSizeValue');
    const themeToggle = document.getElementById('themeToggleSetting');
    
    if (translationSelect) translationSelect.value = state.settings.bibleTranslation;
    if (audioToggle) audioToggle.checked = state.settings.audioControlsVisible;
    if (versionElement) versionElement.textContent = APP_VERSION;

    if (themeToggle) {
        themeToggle.checked = state.settings.theme === 'dark';
    }

    if (scriptureFontSizeSlider) {
        scriptureFontSizeSlider.value = state.settings.scriptureFontSize || 16;
        scriptureFontSizeSlider.addEventListener('input', () => {
            const val = scriptureFontSizeSlider.value;
            if (scriptureFontSizeValue) scriptureFontSizeValue.textContent = `${val}px`;
        });
    }
    
    if (scriptureFontSizeValue) {
        scriptureFontSizeValue.textContent = `${state.settings.scriptureFontSize || 16}px`;
    }
    
    if (notesFontSizeSlider) {
        notesFontSizeSlider.value = state.settings.notesFontSize || 16;
        notesFontSizeSlider.addEventListener('input', () => {
            const val = notesFontSizeSlider.value;
            if (notesFontSizeValue) notesFontSizeValue.textContent = `${val}px`;
        });
    }
    
    if (notesFontSizeValue) {
        notesFontSizeValue.textContent = `${state.settings.notesFontSize || 16}px`;
    }

    if (autoplayToggle) {
        autoplayToggle.checked = !!state.settings.autoplayAudio;
    }
    
    updateColorThemeSelection();
}

/**
 * Update color theme selection in UI
 */
function updateColorThemeSelection() {
    const themeOptions = document.querySelectorAll('.color-theme-option');
    themeOptions.forEach(option => {
        option.classList.toggle('selected', option.dataset.theme === state.settings.colorTheme);
    });
}

/**
 * Show settings modal
 */
function showSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const overlay = document.getElementById('settingsOverlay');
    
    if (modal) modal.classList.add('active');
    if (overlay) overlay.classList.add('active');
    requestAnimationFrame(() => {
        if (modal) {
            modal.scrollTop = 0;
        }
    });
}

/**
 * Close settings modal
 */
export function closeSettings() {
    const modal = document.getElementById('settingsModal');
    const overlay = document.getElementById('settingsOverlay');
    
    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

/**
 * Save settings and apply changes
 */
export async function saveSettings() {
    try {
        showLoading(true);

        const newSettings = getSettingsFromForm();

        validateSettings(newSettings);
        await applyNewSettings(newSettings);
        saveSettingsToStorage();
        updateUIAfterSettingsChange();
        closeSettings();

        alert('Settings saved. The page will now refresh to apply changes.');
        setTimeout(() => window.location.reload(), 500);
    } catch (error) {
        handleError(error, 'saveSettings');
        alert('Error saving settings: ' + error.message);
    } finally {
        showLoading(false);
    }
}

/**
 * Get settings values from form
 * @returns {Object} - New settings values
 */
function getSettingsFromForm() {
    const translationSelect = document.getElementById('bibleTranslationSetting');
    const audioToggle = document.getElementById('audioControlsToggle');
    const autoplayToggle = document.getElementById('autoplayAudioToggle');
    const selectedTheme = document.querySelector('.color-theme-option.selected');
    const narratorSelect = document.getElementById('narratorSelect');
    const scriptureFontSizeSlider = document.getElementById('scriptureFontSizeSlider');
    const notesFontSizeSlider = document.getElementById('notesFontSizeSlider');
    const themeToggle = document.getElementById('themeToggleSetting');
    
    return {
        translation: translationSelect?.value || state.settings.bibleTranslation,
        audioControlsVisible: audioToggle?.checked ?? state.settings.audioControlsVisible,
        colorTheme: selectedTheme?.dataset.theme || state.settings.colorTheme,
        narrator: narratorSelect?.value || state.settings.audioNarrator,
        scriptureFontSize: scriptureFontSizeSlider ? parseInt(scriptureFontSizeSlider.value, 10) : state.settings.scriptureFontSize,
        notesFontSize: notesFontSizeSlider ? parseInt(notesFontSizeSlider.value, 10) : state.settings.notesFontSize,
        theme: themeToggle?.checked ? 'dark' : 'light',
        autoplayAudio: autoplayToggle?.checked ?? state.settings.autoplayAudio
    };
}

/**
 * Validate settings values
 * @param {Object} settings - Settings to validate
 * @throws {Error} - If settings are invalid
 */
function validateSettings(settings) {
    if (!settings.translation) {
        throw new Error('Invalid translation selection');
    }
}

/**
 * Apply new settings to state
 * @param {Object} newSettings - New settings values
 */
async function applyNewSettings(newSettings) {
    if (typeof stopChapterAudio === 'function') {
        stopChapterAudio();
    }
    
    state.settings.bibleTranslation = newSettings.translation;
    state.settings.theme = newSettings.theme;
    state.settings.scriptureFontSize = newSettings.scriptureFontSize ?? state.settings.scriptureFontSize;
    state.settings.notesFontSize = newSettings.notesFontSize ?? state.settings.notesFontSize;
    state.settings.audioControlsVisible = newSettings.audioControlsVisible;
    state.settings.autoplayAudio = newSettings.autoplayAudio;
    state.settings.audioNarrator = newSettings.narrator || state.settings.audioNarrator;
    state.settings.colorTheme = newSettings.colorTheme;
    
    updateURL(newSettings.translation, state.settings.manualBook, state.settings.manualChapter, 'push');
    updateAudioControlsVisibility();
    updateBibleGatewayVersion();
    applyTheme();
    handleNarratorChange(state.settings.audioNarrator);
}

/**
 * Save settings to persistent storage
 */
function saveSettingsToStorage() {
    saveToStorage();
    saveToCookies();
}

/**
 * Update UI after settings changes
 */
function updateUIAfterSettingsChange() {
    applyColorTheme();
    if (typeof updateScriptureFontSize === 'function') {
        updateScriptureFontSize(state.settings.scriptureFontSize);
    }
    
    if (typeof updateNotesFontSize === 'function') {
        updateNotesFontSize(state.settings.notesFontSize);
    }
}

/* ====================================================================
   DATA MANAGEMENT
==================================================================== */

/**
 * Clear cached data
 */
export async function clearCache() {
    if (!confirm('Clear all cached Bible data? This will remove offline access to previously viewed passages.')) {
        return;
    }
    
    try {
        showLoading(true);
        
        if (typeof stopChapterAudio === 'function') {
            stopChapterAudio();
        }
        
        await clearBrowserCaches();
        clearLocalStorageCache();
        
        alert('Cache cleared successfully. Page will refresh to apply changes.');
        setTimeout(() => window.location.reload(), 1000);
        
    } catch (error) {
        handleError(error, 'clearCache');
        alert('Error clearing cache: ' + error.message);
    } finally {
        showLoading(false);
    }
}

/**
 * Clear browser caches
 */
async function clearBrowserCaches() {
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
}

/**
 * Clear localStorage cache
 */
function clearLocalStorageCache() {
    localStorage.removeItem('cachedVerses');
}

/**
 * Delete all user data
 */
export async function deleteAllData() {
    const wantsBackup = confirm('WARNING: This will delete ALL your data. Would you like to create a backup first?');
    
    if (wantsBackup) {
        exportData();
        if (!confirm('Backup created. Proceed with deletion?')) return;
    }
    
    try {
        showLoading(true);
        
        if (typeof stopChapterAudio === 'function') {
            stopChapterAudio();
        }
        
        clearAllStorage();
        redirectToDefaultPassage();
        
    } catch (error) {
        handleError(error, 'deleteAllData');
        alert('Error deleting data. See console for details.');
    } finally {
        showLoading(false);
    }
}

/**
 * Clear all storage data and reset entire state to defaults
 */
function clearAllStorage() {
    // Clear all localStorage items
    localStorage.removeItem('bibleStudyState');
    localStorage.removeItem('cachedVerses');
    
    // Reset entire state object to defaults
    state.currentVerse = null;
    state.currentVerseData = null;
    state.highlights = {};
    state.highlightMeta = {};
    state.notes = '';
    
    // Reset all settings to defaults
    state.settings = {
        bibleTranslation: 'BSB',
        referenceVersion: 'NASB1995',
        footnotes: {},
        audioControlsVisible: true,
        audioNarrator: 'gilbert',
        manualBook: BOOK_ORDER[0],
        manualChapter: 1,
        theme: 'dark',
        colorTheme: 'blue',
        notesView: 'text',
        referencePanelOpen: false,
        referenceSource: 'biblegateway',
        collapsedSections: {},
        collapsedPanels: {},
        panelWidths: {
            sidebar: 280,
            referencePanel: 350,
            scriptureSection: null,
            notesSection: 350
        },
        scriptureFontSize: 16,
        notesFontSize: 16,
        autoplayAudio: true,
        footnotesCollapsed: false,
        lastExport: null,
        lastImport: null
    };
    
    // Reset hotkeys to defaults
    state.hotkeys = {
        toggleReferencePanel: { key: 'b', altKey: true, shiftKey: false, ctrlKey: false },
        toggleNotes: { key: 'n', altKey: true, shiftKey: false, ctrlKey: false },
        toggleSidebar: { key: 's', altKey: true, shiftKey: false, ctrlKey: false },
        prevChapter: { key: 'ArrowLeft', altKey: true, shiftKey: false, ctrlKey: false },
        nextChapter: { key: 'ArrowRight', altKey: true, shiftKey: false, ctrlKey: false },
        prevBook: { key: 'ArrowUp', altKey: true, shiftKey: true, ctrlKey: false },
        nextBook: { key: 'ArrowDown', altKey: true, shiftKey: true, ctrlKey: false },
        randomPassage: { key: 'r', altKey: true, shiftKey: false, ctrlKey: false },
        showHelp: { key: 'F1', altKey: false, shiftKey: false, ctrlKey: false },
        toggleAudio: { key: 'p', altKey: true, shiftKey: false, ctrlKey: false },
        exportData: { key: 'e', altKey: true, shiftKey: false, ctrlKey: false },
        importData: { key: 'i', altKey: true, shiftKey: false, ctrlKey: false },
        exportNotes: { key: 'm', altKey: true, shiftKey: false, ctrlKey: false }
    };
    
    state.hotkeysEnabled = true;
    state.currentPassageReference = '';
    state.audioPlayer = null;
    state.currentChapterData = null;
    
    // Clear cookies
    document.cookie = 'bibleStudySettings=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

/**
 * Redirect to default passage after deletion
 */
function redirectToDefaultPassage() {
    const defaultTranslation = 'BSB';
    const defaultBook = 'Genesis';
    const defaultChapter = '1';
    
    alert('All data has been deleted. The app will now reset to the default passage (Genesis 1, BSB).');
    
    setTimeout(() => {
        window.location.replace(`/?p=${defaultTranslation.toLowerCase()}/${defaultBook.toLowerCase().substring(0, 3)}/${defaultChapter}`);
    }, 1000);
}

/* ====================================================================
   AUDIO CONTROLS
==================================================================== */

/**
 * Update audio controls visibility
 */
function updateAudioControlsVisibility() {
    const audioControls = document.getElementById('audioControls');
    const audioDivider = document.getElementById('audio-tb-divider');
    
    if (!audioControls || !audioDivider) return;
    
    const isVisible = Boolean(state.settings.audioControlsVisible);
    
    audioControls.classList.toggle('audio-controls-hidden', !isVisible);
    audioDivider.style.display = isVisible ? 'inline' : 'none';
    
    const audioCheckbox = document.getElementById('audioControlsToggle');
    if (audioCheckbox) {
        audioCheckbox.checked = isVisible;
    }
}

/**
 * Initialize audio controls
 */
export function initializeAudioControls() {
    if (typeof state.settings.audioControlsVisible === 'undefined') {
        state.settings.audioControlsVisible = true;
        saveToStorage();
    }
    
    updateAudioControlsVisibility();
}

/**
 * Initialize narrator select
 */
export function initialiseNarratorSelect() {
    const sel = document.getElementById('narratorSelect');
    if (sel) {
        sel.value = state.settings.audioNarrator || 'gilbert';
    }
}
