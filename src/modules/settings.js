/*=====================================================================
  Provinent Scripture Study – settings.js
=====================================================================*/


/* ====================================================================
   TABLE OF CONTENTS
   
    EXPORT / IMPORT / RESUME READING PLAN (settings.js)
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
    readingPlan,
    saveToCookies,
    saveToStorage,
    state,
    updateBibleGatewayVersion
} from './state.js'

import {
    restorePanelStates,
    restoreSidebarState,
    switchNotesView,
    updateMarkdownPreview,
    updateReferencePanel
} from './ui.js'


/* ====================================================================
   EXPORT / IMPORT / RESUME READING PLAN
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
    a.download = `bible-study-backup-${new Date().toISOString().split('T')[0]}.json`;
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

/* Resume reading plan from saved position */
export function resumeReadingPlan() {
    // Try to locate the current manual book/chapter inside the plan
    const curBook    = state.settings.manualBook;
    const curChapter = state.settings.manualChapter;
    const idx        = findReadingPlanIndex(curBook, curChapter);
    if (idx !== -1) {
        // Found a matching entry – make it the active reading‑plan index
        state.settings.currentPassageIndex = idx;
    }
    // Switch back to reading‑plan mode and load the passage
    state.settings.readingMode = 'readingPlan';
    loadPassage();   // loadPassage() will also sync the selectors
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
    document.getElementById('readingPlanId').value =
        state.settings.readingPlanId || 'default';
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

/**
 * Save settings and apply changes.
 * If the reading‑plan selector changed, reset the plan to the first entry of the newly‑chosen plan.
 */
export async function saveSettings() {
    try {
        // Pull values from the UI 
        const newPlanId = document.getElementById('readingPlanId').value;
        const newTranslation = document.getElementById('bibleTranslationSetting').value;
        const newReferenceVersion = document.getElementById('referenceVersionSetting').value;

        const oldPlanId = state.settings.readingPlanId; // Store the old plan ID

        state.settings.bibleTranslation = newTranslation;
        state.settings.referenceVersion = newReferenceVersion;
        state.settings.readingPlanId = newPlanId;

        // Auto-adjust reference source if incompatible
        if (newReferenceVersion === 'BSB' && state.settings.referenceSource === 'biblegateway') {
            state.settings.referenceSource = 'biblehub';
            document.getElementById('referenceSource').value = 'biblehub';
        } else if (newReferenceVersion === 'NASB1995' && state.settings.referenceSource === 'biblehub') {
            state.settings.referenceSource = 'biblegateway';
            document.getElementById('referenceSource').value = 'biblegateway';
        }

        // If the plan changed, reset the index to the beginning
        if (oldPlanId !== newPlanId) {
            state.settings.currentPassageIndex = 0;
            state.settings.readingMode = 'readingPlan';
        }

        // Apply color‑theme selection
        const selectedTheme = document.querySelector('.color-theme-option.selected');
        if (selectedTheme) {
            state.settings.colorTheme = selectedTheme.dataset.theme;
            applyColorTheme();
        }

        // Persist everything 
        document.getElementById('referenceTranslation').value = state.settings.referenceVersion;

        updateBibleGatewayVersion();
        saveToStorage();
        saveToCookies();
        closeSettings();

        // Load the passage (will be first passage of new plan if plan changed)
        await loadPassage();

        // Refresh the reference panel if it's open
        if (state.settings.referencePanelOpen) {
            updateReferencePanel();
        }

        alert('Settings saved!' + (oldPlanId !== newPlanId ? ' Starting from beginning of new reading plan.' : ''));
    } catch (err) {
        handleError(err, 'saveSettings');
    } 
}

/* Restart reading plan from day 1 */
export function restartReadingPlan() {
    if (confirm('Reset the reading plan to the very first passage? Highlights and notes will stay unchanged.')) {
        state.settings.currentPassageIndex = 0;
        state.settings.readingMode = 'readingPlan';
        saveToStorage();
        loadPassage();
        alert('Reading plan restarted – you are now at the beginning.');
    }
}

/* Clear cached (offline) data only */
export async function clearCache() {
    if (confirm('Clear all cached Bible data? This will remove offline access to previously viewed passages.')) {
        try {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
            }
            
            // Also clear API cache from IndexedDB if needed
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

/* Delete all stored data (highlights, notes, settings, PDFs) but keep the user in the app (don't show welcome screen) */
export async function deleteAllData() {
    // Double confirmation for destructive action
    const confirmDelete = confirm('WARNING: This will delete ALL your data. Would you like to create a backup first?');
    
    if (confirmDelete) {
        // Offer to create a backup before deleting
        exportData();
        
        const proceed = confirm('Backup created. Proceed with deletion?');
        if (!proceed) return;
    }
    
    try {
        showLoading(true);
        
        // Clear all localStorage
        localStorage.removeItem('bibleStudyState');
        
        // Clear cookies
        document.cookie = 'bibleStudySettings=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
        // Delete PDF from IndexedDB
        try {
            await deletePDFFromIndexedDB();
        } catch (e) {
            console.warn('Could not delete PDF from IndexedDB:', e);
        }
        
        // Reset state to defaults (but keep hasSeenWelcome = true)
        const defaultState = {
            currentVerse: null,
            currentVerseData: null,
            highlights: {},
            notes: '',
            settings: {
                bibleTranslation: 'BSB',
                referenceVersion: 'NASB1995',
                passageType: 'default',
                readingMode: 'readingPlan',
                manualBook: BOOK_ORDER[0],
                manualChapter: 1,
                lastUpdate: null,
                currentPassageIndex: 0,
                theme: 'light',
                colorTheme: 'blue',
                notesView: 'text',
                hasSeenWelcome: true,
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
            },
            welcomePdfFile: null
        };
        
        // Apply the reset state
        Object.assign(state, defaultState);
        
        // Update UI to reflect reset state
        document.getElementById('notesInput').value = '';
        updateMarkdownPreview();
        updateCustomPdfInfo();
        applyTheme();
        applyColorTheme();
        updateBibleGatewayVersion();
        
        // Reset PDF UI elements
        document.getElementById('pageInput').value = 1;
        document.getElementById('pageCount').textContent = '?';
        const zoomDisplay = document.getElementById('zoomLevel');
        if (zoomDisplay) {
            zoomDisplay.textContent = '100%';
        }
        
        // Load the default passage (Genesis 1)
        await loadPassage();
        
        // Clear any error messages
        clearError();
        
        // Close settings modal
        closeSettings();
        
        alert('All data has been deleted. The app has been reset to defaults.');
        
    } catch (err) {
        handleError(err, 'deleteAllData');
        alert('Error deleting data. See console for details.');
    } finally {
        showLoading(false);
    }
}

