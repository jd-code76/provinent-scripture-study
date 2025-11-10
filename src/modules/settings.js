/*=====================================================================
  Provinent Scripture Study – settings.js
=====================================================================*/

/* Global imports */
import {
    applyColorTheme,
    applyTheme,
    clearError,
    handleError,
    showLoading
} from '../main.js'

import { loadPassage } from './passage.js'

import {
    APP_VERSION,
    BOOK_ORDER,
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

/* ====================================================================
   EXPORT / IMPORT
   JSON backup for data portability
==================================================================== */

/* Export all user data to JSON file */
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

/* Import data from JSON backup file */
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

            Object.assign(state.settings, incoming.settings);
            
            if (incoming.highlights) {
                state.highlights = incoming.highlights;
            }
            
            if (incoming.notes) {
                state.notes = incoming.notes;
            }

            saveToStorage();
            applyTheme();
            applyColorTheme();
            restoreSidebarState();
            restorePanelStates();
            switchNotesView(state.settings.notesView || 'text');
            await loadPassage();
            document.getElementById('notesInput').value = state.notes;
            updateMarkdownPreview();

            alert('Backup imported successfully!');
        } catch (err) {
            console.error('Import error:', err);
            alert('Failed to import backup – see console for details.');
        }
    };
    reader.readAsText(file);
    ev.target.value = '';
}

/* ====================================================================
   SETTINGS MODAL
   Configuration dialog for user preferences
==================================================================== */

/* Open settings modal */
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

/* Close settings modal without saving */
export function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
    document.getElementById('settingsOverlay').classList.remove('active');
}

/* Save settings and apply changes */
export async function saveSettings() {
    try {
        const newTranslation = document.getElementById('bibleTranslationSetting').value;
        const currentBook = state.settings.manualBook;
        const currentChapter = state.settings.manualChapter;

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

/* Clear cached (offline) data only */
export async function clearCache() {
    if (!confirm('Clear all cached Bible data? This will remove offline access to previously viewed passages.')) {
        return;
    }
    
    try {
        showLoading(true);
        
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        localStorage.removeItem('cachedVerses');
        
        alert('Cache cleared successfully');
        
    } catch (err) {
        handleError(err, 'clearCache');
        alert('Error clearing cache: ' + err.message);
    } finally {
        showLoading(false);
    }
}

/* Delete all stored data (highlights, notes, settings) */
export async function deleteAllData() {
    const confirmDelete = confirm('WARNING: This will delete ALL your data. Would you like to create a backup first?');
    
    if (confirmDelete) {
        exportData();
        const proceed = confirm('Backup created. Proceed with deletion?');
        if (!proceed) return;
    }
    
    try {
        showLoading(true);
        localStorage.removeItem('bibleStudyState');
        localStorage.removeItem('cachedVerses');
        document.cookie = 'bibleStudySettings=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
        const defaultState = {
            currentVerse: null,
            currentVerseData: null,
            highlights: {},
            notes: '',
            settings: {
                bibleTranslation: 'BSB',
                referenceVersion: 'NASB1995',
                manualBook: BOOK_ORDER[0],
                manualChapter: 1,
                lastUpdate: null,
                theme: 'light',
                colorTheme: 'blue',
                notesView: 'text',
                referencePanelOpen: false,
                referenceSource: 'biblegateway',
                collapsedSections: {},
                collapsedPanels: {},
                panelWidths: {
                    sidebar: 280,
                    referencePanel: 400,
                    scriptureSection: null,
                    notesSection: 400
                }
            },
            currentPassageReference: ''
        };
        
        Object.assign(state, defaultState);
        
        document.getElementById('notesInput').value = '';
        updateMarkdownPreview();
        applyTheme();
        applyColorTheme();
        updateBibleGatewayVersion();
        
        const defaultParams = {
            translation: 'BSB',
            book: 'Genesis',
            chapter: 1
        };
        updateURL(defaultParams.translation, defaultParams.book, defaultParams.chapter);
        
        await loadPassage();
        
        clearError();
        
        closeSettings();
        
        alert('All data has been deleted. The app has been reset to defaults.');
        
    } catch (err) {
        handleError(err, 'deleteAllData');
        alert('Error deleting data. See console for details.');
    } finally {
        showLoading(false);
    }
}
