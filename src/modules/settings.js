/*=====================================================================
  Provinent Scripture Study – settings.js
=====================================================================*/


/* ====================================================================
   TABLE OF CONTENTS
   
    EXPORT / IMPORT
    SETTINGS MODAL (settings.js)
==================================================================== */


/* Global imports */
import {
    applyColorTheme,
    applyTheme,
    clearError,
    handleError,
    showLoading
} from '../main.js'

import { getCurrentTranslation } from './navigation.js'

import { loadPassage } from './passage.js'

import {
    deletePDFFromIndexedDB,
    openDB,
    STORE_NAME,
    updateCustomPdfInfo
} from './pdf.js'

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
    
    if (payload.settings.customPdf && payload.settings.customPdf.data) {
        const { data, ...meta } = payload.settings.customPdf;
        payload.settings.customPdf = meta;
    }

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

            if (!confirm('Import will overwrite all current data (except any uploaded PDF). Continue?')) {
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
            updateCustomPdfInfo();
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

<<<<<<< HEAD
=======
/* Resume reading plan from saved position */
export function resumeReadingPlan() {
    const curBook    = state.settings.manualBook;
    const curChapter = state.settings.manualChapter;
    const idx        = findReadingPlanIndex(curBook, curChapter);
    const translation = getCurrentTranslation();
    updateURL(translation, curBook, curChapter);

    if (idx !== -1) {
        // Found a matching entry – make it the active reading‑plan index
        state.settings.currentPassageIndex = idx;
    }
    state.settings.readingMode = 'readingPlan';
    loadPassage();
}

/**
 * Find the index of a reading‑plan entry that matches a given book 
 * and chapter. Returns ‑1 if the combination isn’t part of the plan.
 */
function findReadingPlanIndex(book, chapter) {
   for (let i = 0; i < readingPlan.length; i++) {
       const p = readingPlan[i];
       if (p.book === book && p.chapter === chapter) {
           return i;
       }
   }
   return -1;   // not found
}

>>>>>>> d11be95798768600c1b682f2957094b98cdb2d61

/* ====================================================================
   SETTINGS MODAL
   Configuration dialog for user preferences
==================================================================== */

/* Open settings modal */
export function openSettings() {
    document.getElementById('bibleTranslationSetting').value = 
        state.settings.bibleTranslation;
    document.getElementById('referenceVersionSetting').value = 
        state.settings.referenceVersion;
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
        const newReferenceVersion = document.getElementById('referenceVersionSetting').value;
        const currentBook = state.settings.manualBook;
        const currentChapter = state.settings.manualChapter;

        updateURL(newTranslation, currentBook, currentChapter);

        state.settings.bibleTranslation = newTranslation;
        state.settings.referenceVersion = newReferenceVersion;

        if (newReferenceVersion === 'BSB' && state.settings.referenceSource === 'biblegateway') {
            state.settings.referenceSource = 'biblehub';
            document.getElementById('referenceSource').value = 'biblehub';
        } else if (newReferenceVersion === 'NASB1995' && state.settings.referenceSource === 'biblehub') {
            state.settings.referenceSource = 'biblegateway';
            document.getElementById('referenceSource').value = 'biblegateway';
        }

        const selectedTheme = document.querySelector('.color-theme-option.selected');
        if (selectedTheme) {
            state.settings.colorTheme = selectedTheme.dataset.theme;
            applyColorTheme();
        }

        document.getElementById('referenceTranslation').value = state.settings.referenceVersion;

        updateBibleGatewayVersion();
        saveToStorage();
        saveToCookies();
        closeSettings();

        await loadPassage();

        if (state.settings.referencePanelOpen) {
            updateReferencePanel();
        }

        alert('Settings saved!');
    } catch (err) {
        handleError(err, 'saveSettings');
    } 
}

<<<<<<< HEAD
=======
/* Restart reading plan from day 1 */
export function restartReadingPlan() {
    if (confirm('Reset the reading plan to the very first passage? Highlights and notes will stay unchanged.')) {
        state.settings.currentPassageIndex = 0;
        state.settings.readingMode = 'readingPlan';
        saveToStorage();
        loadPassage();
        alert('Reading plan restarted – you are now at the beginning.');
        
        const curBook    = state.settings.manualBook;
        const curChapter = state.settings.manualChapter;
        const translation = getCurrentTranslation();
        updateURL(translation, curBook, curChapter);
    }
}

>>>>>>> d11be95798768600c1b682f2957094b98cdb2d61
/* Clear cached (offline) data only */
export async function clearCache() {
    if (confirm('Clear all cached Bible data? This will remove offline access to previously viewed passages.')) {
        try {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
            }
            
            const db = await openDB();
            const tx = db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            await store.clear();
            
            alert('Cache cleared successfully');
        } catch (err) {
            handleError(err, 'clearCache');
            alert('Error clearing cache: ' + err.message);
        }
    }
}

/* Delete all stored data (highlights, notes, settings, PDFs) */
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
        document.cookie = 'bibleStudySettings=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
        try {
            await deletePDFFromIndexedDB();
        } catch (e) {
            console.warn('Could not delete PDF from IndexedDB:', e);
        }
        
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
                },
                customPdf: null,
                pdfZoom: 1
            },
            currentPassageReference: '',
            pdf: {
                doc: null,
                currentPage: 1,
                renderTask: null,
                zoomLevel: 1
            }
        };
        
        Object.assign(state, defaultState);
        
        document.getElementById('notesInput').value = '';
        updateMarkdownPreview();
        updateCustomPdfInfo();
        applyTheme();
        applyColorTheme();
        updateBibleGatewayVersion();
        
        document.getElementById('pageInput').value = 1;
        document.getElementById('pageCount').textContent = '?';
        const zoomDisplay = document.getElementById('zoomLevel');
        if (zoomDisplay) {
            zoomDisplay.textContent = '100%';
        }
        
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

