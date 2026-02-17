/*=====================================================================
  Provinent Scripture Study – settings.js
  User settings and data management
=====================================================================*/

import { stopChapterAudio } from './api.js';
import { getVerseTextFromStorage } from './highlights.js';
import { applyColorTheme, applyTheme, formatDateTime, formatFileSize, getFormattedDateForFilename, getFormattedDateForDisplay, handleError, handleNarratorChange, showLoading } from '../main.js';
import { populateChapterDropdown, updateChapterDropdownVisibility } from './navigation.js';
import { APP_VERSION, BOOK_ORDER, saveToCookies, saveToStorage, state, updateBibleGatewayVersion, updateURL } from './state.js';
import { restorePanelStates, restoreSidebarState, switchNotesView, updateMarkdownPreview, updateScriptureFontSize } from './ui.js';

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
        const highlightsWithText = Object.entries(state.highlights).reduce(
            (acc, [reference, color]) => {
                const verseText = getVerseTextFromStorage(reference) || '';
                acc[reference] = { color: color, text: verseText };
                return acc;
            },
            {}
        );
        
        const payload = {
            version: '2.0',
            exportDate: exportDate,
            highlights: highlightsWithText,
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
        reader.onload = (e) => handleFileRead(e, file);
        reader.onerror = handleFileError;
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
        
    } catch (error) {
        console.error('Error importing data:', error);
        alert('Failed to import data. See console for details.');
    }
}

/**
 * Handle file read completion
 * @param {ProgressEvent} event - File read event
 * @param {File} file - The imported file object
 */
function handleFileRead(event, file) {
    try {
        const fileContent = event.target.result;
        const incoming = JSON.parse(fileContent);
        validateImportData(incoming);
        
        if (!confirmImport()) return;
        
        applyImportedData(incoming);
        
        // Store import info in state
        state.settings.lastImport = {
            filename: file.name,
            date: new Date().toISOString(),
            size: file.size
        };
        
        saveImportedData();
        updateUIAfterImport(incoming);
        reloadApplication();
        
    } catch (error) {
        console.error('Error processing import:', error);
        alert('Invalid backup file format.');
    }
}

/**
 * Handle file read error
 */
function handleFileError() {
    alert('Error reading file. Please try again.');
}

/**
 * Validate imported data structure
 * @param {Object} data - Imported data
 * @throws {Error} - If data is invalid
 */
function validateImportData(data) {
    if (!data.settings || typeof data.settings !== 'object') {
        throw new Error('Invalid backup format: missing settings');
    }
}

/**
 * Confirm import with user
 * @returns {boolean} - True if user confirms
 */
function confirmImport() {
    return confirm('Import will overwrite all current data. Continue?');
}

/**
 * Apply imported data to state
 * @param {Object} incoming - Imported data
 */
function applyImportedData(incoming) {
    Object.assign(state.settings, incoming.settings);
    const incomingHighlights = incoming.highlights || {};
    const colorMap = {};
    const verseTextMap = {};          // will be merged into the cache

    Object.entries(incomingHighlights).forEach(([reference, data]) => {
        if (typeof data === 'string') {
            colorMap[reference] = data;
        } else if (data && typeof data === 'object') {
            colorMap[reference] = data.color;
        verseTextMap[reference] = data.text;
        }
    });

    state.highlights = colorMap;

    try {
        const cachedRaw = localStorage.getItem('cachedVerses');
        const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
        const merged = { ...cached, ...verseTextMap };
        localStorage.setItem('cachedVerses', JSON.stringify(merged));
    } catch (e) {
        console.error('Failed to merge cached verses on import:', e);
    }

    state.notes = incoming.notes || '';
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

/**
 * Reload application after import
 */
function reloadApplication() {
    alert('Backup imported successfully! Page will refresh to apply all changes.');
    setTimeout(() => window.location.reload(), 1000);
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
    
    const referenceTranslationSelect = document.getElementById('referenceTranslation');
    if (referenceTranslationSelect) {
        referenceTranslationSelect.value = state.settings.referenceVersion;
    }

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
    state.notes = '';
    
    // Reset all settings to defaults
    state.settings = {
        bibleTranslation: 'BSB',
        referenceVersion: 'NASB',
        footnotes: {},
        audioControlsVisible: true,
        audioNarrator: 'gilbert',
        manualBook: BOOK_ORDER[0],
        manualChapter: 1,
        theme: 'dark',
        colorTheme: 'blue',
        notesView: 'text',
        referencePanelOpen: true,
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
