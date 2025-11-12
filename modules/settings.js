import { stopChapterAudio } from './api.js' 
import {
    applyColorTheme,
    applyTheme,
    handleError,
    showLoading
} from '../main.js'
import { populateChapterDropdown, updateChapterDropdownVisibility } from './navigation.js'
import { loadPassage } from './passage.js'
import {
    APP_VERSION,
    saveToCookies,
    saveToStorage,
    state,
    updateBibleGatewayVersion,
    updateURL
} from './state.js'
import {
    restorePanelStates,
    restoreSidebarState,
    switchNotesView,
    updateMarkdownPreview,
    updateReferencePanel
} from './ui.js'
export function exportData() {
    const payload = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        highlights: state.highlights,
        notes: state.notes,
        settings: { ...state.settings }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], 
                          { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `provinent-bible-study-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
export function importData(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const incoming = JSON.parse(e.target.result);
            if (!incoming.settings) {
                throw new Error('Invalid backup format');
            }
            if (!confirm('Import will overwrite all current data. Continue?')) {
                return;
            }
            const importedSettings = { ...incoming.settings };
            const importedHighlights = incoming.highlights || {};
            const importedNotes = incoming.notes || '';
            Object.assign(state.settings, importedSettings);
            state.highlights = importedHighlights;
            state.notes = importedNotes;
            saveToStorage();
            updateURL(
                importedSettings.bibleTranslation || state.settings.bibleTranslation,
                importedSettings.manualBook || state.settings.manualBook,
                importedSettings.manualChapter || state.settings.manualChapter
            );
            applyTheme();
            applyColorTheme();
            restoreSidebarState();
            restorePanelStates();
            switchNotesView(state.settings.notesView || 'text');
            document.getElementById('notesInput').value = state.notes;
            updateMarkdownPreview();
            const bookSelect = document.getElementById('bookSelect');
            const chapterSelect = document.getElementById('chapterSelect');
            if (bookSelect && importedSettings.manualBook) {
                bookSelect.value = importedSettings.manualBook;
                populateChapterDropdown(importedSettings.manualBook);
            }
            if (chapterSelect && importedSettings.manualChapter) {
                chapterSelect.value = importedSettings.manualChapter;
            }
            updateChapterDropdownVisibility(importedSettings.manualBook);
            alert('Backup imported successfully! Page will refresh to apply all changes.');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            console.error('Import error:', err);
            alert('Failed to import backup – see console for details.');
        }
    };
    reader.readAsText(file);
    ev.target.value = '';
}
export function openSettings() {
    document.getElementById('bibleTranslationSetting').value = 
        state.settings.bibleTranslation;
    document.querySelectorAll('.color-theme-option')
            .forEach(o => o.classList.toggle('selected',
                o.dataset.theme === state.settings.colorTheme));
    document.getElementById('settingsModal').classList.add('active');
    document.getElementById('settingsOverlay').classList.add('active');
    document.getElementById('appVersion').textContent = APP_VERSION;
}
export function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
    document.getElementById('settingsOverlay').classList.remove('active');
}
export async function saveSettings() {
    try {
        const newTranslation = document.getElementById('bibleTranslationSetting').value;
        const currentBook = state.settings.manualBook;
        const currentChapter = state.settings.manualChapter;
        if (typeof stopChapterAudio === 'function') {
            stopChapterAudio();
        }
        updateURL(newTranslation, currentBook, currentChapter);
        state.settings.bibleTranslation = newTranslation;
        const referenceTranslationSelect = document.getElementById('referenceTranslation');
        if (referenceTranslationSelect) {
            referenceTranslationSelect.value = state.settings.referenceVersion;
        }
        const selectedTheme = document.querySelector('.color-theme-option.selected');
        if (selectedTheme) {
            state.settings.colorTheme = selectedTheme.dataset.theme;
            applyColorTheme();
        }
        updateBibleGatewayVersion();
        saveToStorage();
        saveToCookies();
        closeSettings();
        await loadPassage();
        if (state.settings.referencePanelOpen) {
            await updateReferencePanel();
        }
    } catch (err) {
        handleError(err, 'saveSettings');
        alert('Error saving settings: ' + err.message);
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
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        localStorage.removeItem('cachedVerses');
        alert('Cache cleared successfully. Page will refresh to apply changes.');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    } catch (err) {
        handleError(err, 'clearCache');
        alert('Error clearing cache: ' + err.message);
    } finally {
        showLoading(false);
    }
}
export async function deleteAllData() {
    const confirmDelete = confirm('WARNING: This will delete ALL your data. Would you like to create a backup first?');
    if (confirmDelete) {
        exportData();
        const proceed = confirm('Backup created. Proceed with deletion?');
        if (!proceed) return;
    }
    try {
        showLoading(true);
        if (typeof stopChapterAudio === 'function') {
            stopChapterAudio();
        }
        localStorage.removeItem('bibleStudyState');
        localStorage.removeItem('cachedVerses');
        document.cookie = 'bibleStudySettings=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        alert('All data has been deleted. The app will now reset to the default passage (Genesis 1, BSB).');
        const defaultTranslation = 'BSB';
        const defaultBook = 'Genesis';
        const defaultChapter = '1';
        setTimeout(() => {
            window.location.replace(`/?p=${defaultTranslation.toLowerCase()}/${defaultBook.toLowerCase().substring(0, 3)}/${defaultChapter}`);
        }, 1000);
    } catch (err) {
        handleError(err, 'deleteAllData');
        alert('Error deleting data. See console for details.');
    } finally {
        showLoading(false);
    }
}