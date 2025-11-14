import { stopChapterAudio } from './api.js';
import { applyColorTheme, applyTheme, getFormattedDateForFilename, getFormattedDateForDisplay, handleError, showLoading } from '../main.js';
import { populateChapterDropdown, updateChapterDropdownVisibility } from './navigation.js';
import { loadPassage } from './passage.js';
import { APP_VERSION, saveToCookies, saveToStorage, state, updateBibleGatewayVersion, updateURL } from './state.js';
import { restorePanelStates, restoreSidebarState, switchNotesView, updateMarkdownPreview, updateReferencePanel } from './ui.js';
export function exportData() {
    try {
        const fileDate = getFormattedDateForFilename();
        const exportDate = getFormattedDateForDisplay();
        const payload = {
            version: '2.0',
            exportDate: exportDate,
            highlights: { ...state.highlights },
            notes: state.notes,
            settings: { ...state.settings }
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `provinent-bible-study-backup-${fileDate}.json`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Failed to export data. See console for details.');
    }
}
export function importData(event) {
    try {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = handleFileRead;
        reader.onerror = handleFileError;
        reader.readAsText(file);
        event.target.value = '';
    } catch (error) {
        console.error('Error importing data:', error);
        alert('Failed to import data. See console for details.');
    }
}
function handleFileRead(event) {
    try {
        const incoming = JSON.parse(event.target.result);
        validateImportData(incoming);
        if (!confirmImport()) return;
        applyImportedData(incoming);
        saveImportedData();
        updateUIAfterImport(incoming);
        reloadApplication();
    } catch (error) {
        console.error('Error processing import:', error);
        alert('Invalid backup file format.');
    }
}
function handleFileError() {
    alert('Error reading file. Please try again.');
}
function validateImportData(data) {
    if (!data.settings || typeof data.settings !== 'object') {
        throw new Error('Invalid backup format: missing settings');
    }
}
function confirmImport() {
    return confirm('Import will overwrite all current data. Continue?');
}
function applyImportedData(incoming) {
    Object.assign(state.settings, incoming.settings);
    state.highlights = incoming.highlights || {};
    state.notes = incoming.notes || '';
}
function saveImportedData() {
    saveToStorage();
    updateURL(
        state.settings.bibleTranslation,
        state.settings.manualBook,
        state.settings.manualChapter,
        'push'
    );
}
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
function reloadApplication() {
    alert('Backup imported successfully! Page will refresh to apply all changes.');
    setTimeout(() => window.location.reload(), 1000);
}
export function openSettings() {
    try {
        populateSettingsForm();
        showSettingsModal();
    } catch (error) {
        console.error('Error opening settings:', error);
    }
}
function populateSettingsForm() {
    const translationSelect = document.getElementById('bibleTranslationSetting');
    const audioToggle = document.getElementById('audioControlsToggle');
    const versionElement = document.getElementById('appVersion');
    if (translationSelect) translationSelect.value = state.settings.bibleTranslation;
    if (audioToggle) audioToggle.checked = state.settings.audioControlsVisible;
    if (versionElement) versionElement.textContent = APP_VERSION;
    updateColorThemeSelection();
}
function updateColorThemeSelection() {
    const themeOptions = document.querySelectorAll('.color-theme-option');
    themeOptions.forEach(option => {
        option.classList.toggle('selected', option.dataset.theme === state.settings.colorTheme);
    });
}
function showSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const overlay = document.getElementById('settingsOverlay');
    if (modal) modal.classList.add('active');
    if (overlay) overlay.classList.add('active');
}
export function closeSettings() {
    const modal = document.getElementById('settingsModal');
    const overlay = document.getElementById('settingsOverlay');
    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}
export async function saveSettings() {
    try {
        showLoading(true);
        const newSettings = getSettingsFromForm();
        validateSettings(newSettings);
        await applyNewSettings(newSettings);
        saveSettingsToStorage();
        updateUIAfterSettingsChange();
        closeSettings();
        await reloadPassageWithNewSettings();
    } catch (error) {
        handleError(error, 'saveSettings');
        alert('Error saving settings: ' + error.message);
    } finally {
        showLoading(false);
    }
}
function getSettingsFromForm() {
    const translationSelect = document.getElementById('bibleTranslationSetting');
    const audioToggle = document.getElementById('audioControlsToggle');
    const selectedTheme = document.querySelector('.color-theme-option.selected');
    return {
        translation: translationSelect?.value || state.settings.bibleTranslation,
        audioControlsVisible: audioToggle?.checked ?? state.settings.audioControlsVisible,
        colorTheme: selectedTheme?.dataset.theme || state.settings.colorTheme
    };
}
function validateSettings(settings) {
    if (!settings.translation) {
        throw new Error('Invalid translation selection');
    }
}
async function applyNewSettings(newSettings) {
    if (typeof stopChapterAudio === 'function') {
        stopChapterAudio();
    }
    state.settings.bibleTranslation = newSettings.translation;
    state.settings.audioControlsVisible = newSettings.audioControlsVisible;
    state.settings.colorTheme = newSettings.colorTheme;
    updateURL(newSettings.translation, state.settings.manualBook, state.settings.manualChapter, 'push');
    updateAudioControlsVisibility();
    updateBibleGatewayVersion();
}
function saveSettingsToStorage() {
    saveToStorage();
    saveToCookies();
}
function updateUIAfterSettingsChange() {
    applyColorTheme();
    const referenceTranslationSelect = document.getElementById('referenceTranslation');
    if (referenceTranslationSelect) {
        referenceTranslationSelect.value = state.settings.referenceVersion;
    }
}
async function reloadPassageWithNewSettings() {
    await loadPassage();
    if (state.settings.referencePanelOpen) {
        await updateReferencePanel();
    }
}
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
async function clearBrowserCaches() {
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
}
function clearLocalStorageCache() {
    localStorage.removeItem('cachedVerses');
}
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
function clearAllStorage() {
    localStorage.removeItem('bibleStudyState');
    localStorage.removeItem('cachedVerses');
    document.cookie = 'bibleStudySettings=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}
function redirectToDefaultPassage() {
    const defaultTranslation = 'BSB';
    const defaultBook = 'Genesis';
    const defaultChapter = '1';
    alert('All data has been deleted. The app will now reset to the default passage (Genesis 1, BSB).');
    setTimeout(() => {
        window.location.replace(`/?p=${defaultTranslation.toLowerCase()}/${defaultBook.toLowerCase().substring(0, 3)}/${defaultChapter}`);
    }, 1000);
}
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
export function initializeAudioControls() {
    if (typeof state.settings.audioControlsVisible === 'undefined') {
        state.settings.audioControlsVisible = true;
        saveToStorage();
    }
    updateAudioControlsVisibility();
}