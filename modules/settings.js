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
export function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
    document.getElementById('settingsOverlay').classList.remove('active');
}
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
        const db = await openDB();
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await store.clear();
        await tx.done;
        alert('Cache cleared successfully');
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