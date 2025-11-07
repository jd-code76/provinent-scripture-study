import {
    getCurrentTranslation,
    initBookChapterControls,
    loadSelectedChapter,
    navigateFromURL,
    nextPassage,
    prevPassage,
    randomPassage,
    setupNavigationWithURL,
    setupPopStateListener
} from './modules/navigation.js'
import { 
    loadPassage, 
    scrollToVerse, 
    setupFootnoteHandlers 
} from './modules/passage.js'
import {
    clearSearch,
    currentSearch,
    handlePDFUpload,
    navigateToSearchResult,
    renderPage,
    searchPDF,
    setupPDFCleanup,
    updateCustomPdfInfo,
    updatePDFZoom
} from './modules/pdf.js'
import {
    clearCache,
    closeSettings,
    deleteAllData,
    exportData,
    importData,
    openSettings,
    restartReadingPlan,
    resumeReadingPlan,
    saveSettings
} from './modules/settings.js'
import {
    BOOK_ORDER,
    updateBibleGatewayVersion,
    loadFromCookies,
    loadFromStorage,
    saveToCookies,
    saveToStorage,
    state,
    updateURL
} from './modules/state.js'
import { closeStrongsPopup } from './modules/strongs.js'
import {
    exportNotes,
    initResizeHandles,
    insertMarkdown,
    makeToggleSticky,
    restoreBookChapterUI,
    restorePanelStates,
    restoreSidebarState,
    switchNotesView,
    toggleNotes,
    togglePanelCollapse,
    toggleReferencePanel,
    toggleSection,
    updateMarkdownPreview,
    updateReferencePanel
} from './modules/ui.js'
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}
if (typeof marked !== 'undefined') {
    marked.setOptions({ 
        breaks: true,       
        gfm: true          
    });
}
function updateDateTime() {
    const now = new Date();
    document.getElementById('currentDate').textContent =
        now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
}
class AppError extends Error {
    constructor(message, type, originalError) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.originalError = originalError;
    }
}
export function handleError(error, context) {
    console.error(`Error in ${context}:`, error);
    const userMessage = error instanceof AppError 
        ? error.message 
        : 'An unexpected error occurred';
    showError(userMessage);
    if (window.errorTracker) {
        window.errorTracker.log(error, context);
    }
}
function setupEventListeners() {
    document.querySelector('.theme-toggle')
            .addEventListener('click', toggleTheme);
    document.getElementById('openSettingsBtn')
            .addEventListener('click', openSettings);
    document.getElementById('exportDataBtn')
            .addEventListener('click', exportData);
    document.getElementById('importDataBtn')
            .addEventListener('click', () => {
                document.getElementById('importFile').click();
            });
    document.getElementById('importFile')
            .addEventListener('change', importData);
    document.querySelector('.toggle-notes')
            .addEventListener('click', toggleNotes);
    document.getElementById('prevPassageBtn')
            .addEventListener('click', prevPassage);
    document.getElementById('nextPassageBtn')
            .addEventListener('click', nextPassage);
    document.getElementById('resumeReadingPlanBtn')
            .addEventListener('click', () => {
                if (confirm('Return to the daily reading plan where you left off?')) {
                    resumeReadingPlan();
                }
            });
    document.getElementById('randomPassageBtn')
            .addEventListener('click', randomPassage);
    document.getElementById('referencePanelToggle')
            .addEventListener('click', toggleReferencePanel);
    document.querySelectorAll('.sidebar-section-header')
            .forEach(h => h.addEventListener('click', () => {
                const sec = h.dataset.section;
                toggleSection(sec);
            }));
    document.getElementById('referenceTranslation').addEventListener('change', function() {
        const tempTranslation = this.value;
        const oldTranslation = state.settings.referenceVersion;
        state.settings.referenceVersion = tempTranslation;
        updateBibleGatewayVersion();
        state.settings.referenceVersion = oldTranslation;
    });
    document.addEventListener('DOMContentLoaded', makeToggleSticky);
    document.querySelectorAll('.collapse-toggle')
            .forEach(btn => btn.addEventListener('click', function () {
                const panel = this.closest('[id]');
                if (panel) togglePanelCollapse(panel.id);
            }));
    document.getElementById('referenceSource')
            .addEventListener('change', updateReferencePanel);
    document.getElementById('referenceTranslation')
            .addEventListener('change', updateReferencePanel);
    document.querySelector('.reference-panel-close')
            .addEventListener('click', toggleReferencePanel);
    document.getElementById('prevPage').addEventListener('click', async () => {
        if (!state.pdf.doc || state.pdf.currentPage <= 1) return;
        try {
            if (state.pdf.renderTask) {
                await state.pdf.renderTask.cancel();
                state.pdf.renderTask = null;
            }
            state.pdf.currentPage--;
            await renderPage(state.pdf.currentPage);
        } catch (err) {
            console.warn('Error navigating to previous page:', err);
            await loadPDF();
        }
    });
    document.getElementById('nextPage').addEventListener('click', async () => {
        if (!state.pdf.doc || state.pdf.currentPage >= state.pdf.doc.numPages) return;
        try {
            if (state.pdf.renderTask) {
                await state.pdf.renderTask.cancel();
                state.pdf.renderTask = null;
            }
            state.pdf.currentPage++;
            await renderPage(state.pdf.currentPage);
        } catch (err) {
            console.warn('Error navigating to next page:', err);
            await loadPDF();
        }
    });
    document.getElementById('pageInput').addEventListener('change', async () => {
        if (!state.pdf.doc) {
            document.getElementById('pageInput').value = state.pdf.currentPage;
            return;
        }
        const inp = document.getElementById('pageInput');
        let p = parseInt(inp.value, 10);
        if (Number.isNaN(p)) {
            inp.value = state.pdf.currentPage;
            return;
        }
        p = Math.max(1, Math.min(p, state.pdf.doc.numPages));
        try {
            state.pdf.currentPage = p;
            await renderPage(p);
        } catch (err) {
            console.warn('Error navigating to page:', err);
            inp.value = state.pdf.currentPage;
            await loadPDF();
        }
    });
    document.getElementById('zoomIn').addEventListener('click', () => {
        if (!state.pdf.doc) return;
        const newZoom = Math.min(state.pdf.zoomLevel + 0.25, 3.0);
        updatePDFZoom(newZoom);
    });
    document.getElementById('zoomOut').addEventListener('click', () => {
        if (!state.pdf.doc) return;
        const newZoom = Math.max(state.pdf.zoomLevel - 0.25, 0.5);
        updatePDFZoom(newZoom);
    });
    document.getElementById('pdfSearchBtn').addEventListener('click', searchPDF);
    document.getElementById('pdfSearchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchPDF();
    });
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    const nextSearchBtn = document.getElementById('nextSearchResult');
    const prevSearchBtn = document.getElementById('prevSearchResult');
    if (nextSearchBtn) {
        nextSearchBtn.addEventListener('click', () => {
            navigateToSearchResult(currentSearch.currentResult + 1);
        });
    }
    if (prevSearchBtn) {
        prevSearchBtn.addEventListener('click', () => {
            navigateToSearchResult(currentSearch.currentResult - 1);
        });
    }
    document.getElementById('notesInput')
            .addEventListener('input', e => {
                state.notes = e.target.value;
                saveToStorage();
                if (state.settings.notesView === 'markdown') {
                    updateMarkdownPreview();
                }
            });
    document.getElementById('textViewBtn')
            .addEventListener('click', () => switchNotesView('text'));
    document.getElementById('markdownViewBtn')
            .addEventListener('click', () => switchNotesView('markdown'));
    document.querySelectorAll('.markdown-btn')
            .forEach(btn => btn.addEventListener('click', () => {
                const fmt = btn.dataset.format;
                insertMarkdown(fmt);
            }));
    document.querySelectorAll('.notes-controls button')
            .forEach(btn => btn.addEventListener('click', () => {
                const fmt = btn.dataset.format;
                exportNotes(fmt);
            }));
    document.querySelectorAll('.color-option')
            .forEach(opt => opt.addEventListener('click', () => {
                const col = opt.dataset.color;
                applyHighlight(col);
            }));
    document.getElementById('removeHighlight')
            .addEventListener('click', () => applyHighlight('none'));
    document.addEventListener('contextmenu', e => {
        const verse = e.target.closest('.verse');
        if (verse) {
            e.preventDefault();
            showColorPicker(e, verse);
        }
    });
    document.addEventListener('click', e => {
        const picker = document.getElementById('colorPicker');
        if (!picker.contains(e.target) && !e.target.closest('.verse')) {
            picker.classList.remove('active');
        }
    });
    document.getElementById('showHighlightsBtn')
            .addEventListener('click', showHighlightsModal);
    document.getElementById('closeHighlightsBtn')
            .addEventListener('click', closeHighlightsModal);
    document.getElementById('highlightsOverlay')
            .addEventListener('click', closeHighlightsModal);
    document.getElementById('popupOverlay')
            .addEventListener('click', closeStrongsPopup);
    document.querySelector('#strongsPopup .popup-close')
            .addEventListener('click', closeStrongsPopup);
    document.getElementById('settingsOverlay')
            .addEventListener('click', closeSettings);
    document.getElementById('closeSettingsBtn')
            .addEventListener('click', closeSettings);
    document.getElementById('cancelSettingsBtn')
            .addEventListener('click', closeSettings);
    document.getElementById('saveSettingsBtn')
            .addEventListener('click', saveSettings);
    document.getElementById('clearHighlightsBtn')
            .addEventListener('click', clearHighlights);
    document.getElementById('restartReadingPlanBtn')
            .addEventListener('click', () => {
                restartReadingPlan();
            });
    document.addEventListener('contentLoaded', () => {
        setTimeout(setupFootnoteHandlers, 50);
    });
    document.getElementById('clearCacheBtn')
        .addEventListener('click', clearCache);
    document.getElementById('deleteAllDataBtn')
        .addEventListener('click', deleteAllData);
    document.getElementById('settingsPdfUploadBtn')
            .addEventListener('click', () => {
                document.getElementById('settingsPdfUpload').click();
            });
    document.getElementById('settingsPdfUpload')
            .addEventListener('change', handlePDFUpload);
    document.querySelectorAll('.color-theme-option')
            .forEach(opt => opt.addEventListener('click', () => {
                const theme = opt.dataset.theme;
                selectColorTheme(theme);
            }));
    document.addEventListener('keydown', e => {
        const ta = document.getElementById('notesInput');
        if (document.activeElement !== ta) return;
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    insertMarkdown('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    insertMarkdown('italic');
                    break;
            }
        }
    });
}
export function arrayBufferToBase64(buf) {
    let binary = '';
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;  
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(
            null,
            Array.from(bytes.subarray(i, i + chunk))
        );
    }
    return btoa(binary);
}
export function base64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        arr[i] = bin.charCodeAt(i);
    }
    return arr.buffer;
}
export function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = e => resolve(e.target.result);
        r.onerror = () => reject(new Error('Failed to read file'));
        r.readAsArrayBuffer(file);
    });
}
export function showLoading(flag) {
    document.getElementById('loadingOverlay').classList.toggle('active', flag);
}
export function showError(msg) {
    document.getElementById('errorContainer').innerHTML =
        `<div class="error-message">${msg}</div>`;
}
export function clearError() {
    document.getElementById('errorContainer').innerHTML = '';
}
function updateOfflineStatus(isOffline) {
    const indicator = document.getElementById('offlineIndicator');
    if (!indicator) {
        const newIndicator = document.createElement('div');
        newIndicator.id = 'offlineIndicator';
        newIndicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 10px;
            background: ${isOffline ? '#ff6b6b' : '#51cf66'};
            color: white;
            border-radius: 5px;
            z-index: 10000;
            font-size: 14px;
            transition: all 0.3s ease;
        `;
        newIndicator.textContent = isOffline ? 'Offline Mode' : 'Online';
        document.body.appendChild(newIndicator);
        setTimeout(() => {
            newIndicator.style.opacity = '0';
            setTimeout(() => newIndicator.remove(), 300);
        }, 3000);
    } else {
        indicator.textContent = isOffline ? 'Offline Mode' : 'Online';
        indicator.style.background = isOffline ? '#ff6b6b' : '#51cf66';
    }
}
const offlineStyles = `
#offlineIndicator {
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 10px 15px;
    background: #ff6b6b;
    color: white;
    border-radius: 5px;
    z-index: 10000;
    font-size: 14px;
    font-weight: bold;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
}
#offlineIndicator.online {
    background: #51cf66;
}
`;
function showColorPicker(ev, verseEl) {
    const picker = document.getElementById('colorPicker');
    state.currentVerse = verseEl;
    picker.style.left = ev.pageX + 'px';
    picker.style.top = ev.pageY + 'px';
    picker.classList.add('active');
}
function applyHighlight(col) {
    if (!state.currentVerse) return;
    const verseRef = state.currentVerse.dataset.verse;
    state.currentVerse.classList.remove(
        'highlight-yellow', 'highlight-green', 'highlight-blue',
        'highlight-pink', 'highlight-orange', 'highlight-purple'
    );
    if (col !== 'none') {
        state.currentVerse.classList.add(`highlight-${col}`);
        state.highlights[verseRef] = col;
    } else {
        delete state.highlights[verseRef];
    }
    saveToStorage();
    document.getElementById('colorPicker').classList.remove('active');
}
function clearHighlights() {
    if (!confirm('Delete ALL highlights?')) return;
    state.highlights = {};
    document.querySelectorAll('.verse')
            .forEach(v => v.classList.remove(
                'highlight-yellow', 'highlight-green', 'highlight-blue',
                'highlight-pink', 'highlight-orange', 'highlight-purple'
            ));
    saveToStorage();
}
function showHighlightsModal() {
    const overlay = document.getElementById('highlightsOverlay');
    const modal = document.getElementById('highlightsModal');
    overlay.classList.add('active');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    renderHighlights('all');
    document.querySelectorAll('.highlight-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.highlight-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderHighlights(this.dataset.color);
        });
    });
}
function closeHighlightsModal() {
    const overlay = document.getElementById('highlightsOverlay');
    const modal = document.getElementById('highlightsModal');
    overlay.classList.remove('active');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}
function renderHighlights(filterColor = 'all') {
    const highlightsList = document.getElementById('highlightsList');
    const highlights = state.highlights || {};
    if (Object.keys(highlights).length === 0) {
        highlightsList.innerHTML = '<div class="no-highlights">No verses have been highlighted yet</div>';
        return;
    }
    let html = '';
    const versesByColor = {};
    Object.entries(highlights).forEach(([reference, color]) => {
        if (!versesByColor[color]) versesByColor[color] = [];
        versesByColor[color].push(reference);
    });
    Object.keys(versesByColor).forEach(color => {
        versesByColor[color].sort((a, b) => {
            const [bookA, chapA, verseA] = a.split(/[ :]/);
            const [bookB, chapB, verseB] = b.split(/[ :]/);
            const bookOrderA = BOOK_ORDER.indexOf(bookA);
            const bookOrderB = BOOK_ORDER.indexOf(bookB);
            if (bookOrderA !== bookOrderB) return bookOrderA - bookOrderB;
            if (parseInt(chapA) !== parseInt(chapB)) return parseInt(chapA) - parseInt(chapB);
            return parseInt(verseA) - parseInt(verseB);
        });
    });
    Object.entries(versesByColor).forEach(([color, references]) => {
        if (filterColor !== 'all' && filterColor !== color) return;
        references.forEach(reference => {
            const verseText = getVerseTextFromStorage(reference) || 'Verse text not available';
            html += `
                <div class="highlight-item ${color}" data-reference="${reference}" data-color="${color}">
                    <div class="highlight-ref">${reference}</div>
                    <div class="highlight-text">${verseText}</div>
                </div>
            `;
        });
    });
    highlightsList.innerHTML = html || '<div class="no-highlights">No highlights match the selected filter</div>';
    document.querySelectorAll('.highlight-item').forEach(item => {
        item.addEventListener('click', () => {
            const reference = item.dataset.reference;
            navigateToHighlightedVerse(reference);
            closeHighlightsModal();
        });
    });
}
function getVerseTextFromStorage(reference) {
    try {
        const cachedVerses = JSON.parse(localStorage.getItem('cachedVerses') || '{}');
        return cachedVerses[reference];
    } catch (e) {
        return null;
    }
}
function navigateToHighlightedVerse(reference) {
    const match = reference.match(/^(.+?) (\d+):(\d+)$/);
    if (!match) return;
    const [, book, chapter, verse] = match;
    state.settings.readingMode = 'manual';
    state.settings.manualBook = book;
    state.settings.manualChapter = parseInt(chapter);
    const translation = getCurrentTranslation();
    updateURL(translation, book, chapter);
    loadSelectedChapter(book, chapter);
    setTimeout(() => scrollToVerse(verse), 500);
}
function toggleTheme() {
    state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    saveToStorage();
    saveToCookies();
}
export function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    const themeIcon = document.getElementById('themeIcon');
    themeIcon.textContent = '';
    themeIcon.className = state.settings.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    refreshHighlightsModalTheme();
}
export function selectColorTheme(t) {
    state.settings.colorTheme = t;
    applyColorTheme();
    document.querySelectorAll('.color-theme-option')
            .forEach(o => o.classList.remove('selected'));
    document.querySelector(`.color-theme-option[data-theme="${t}"]`)
            .classList.add('selected');
    refreshHighlightsModalTheme();
}
export function applyColorTheme() {
    document.documentElement.setAttribute('data-color-theme', state.settings.colorTheme);
    refreshHighlightsModalTheme();
}
function refreshHighlightsModalTheme() {
    const modal = document.getElementById('highlightsModal');
    if (modal.classList.contains('show')) {
        const activeFilter = document.querySelector('.highlight-filter-btn.active')?.dataset.color || 'all';
        renderHighlights(activeFilter);
    }
}
async function init() {
    await loadFromStorage();
    loadFromCookies();
    setupPDFCleanup();
    const style = document.createElement('style');
    style.textContent = offlineStyles;
    document.head.appendChild(style);
    updateOfflineStatus(!navigator.onLine);
    window.addEventListener('online', () => updateOfflineStatus(false));
    window.addEventListener('offline', () => updateOfflineStatus(true));
    if (!state.settings.readingMode)    state.settings.readingMode      = 'readingPlan';
    if (!state.settings.readingPlanId)  state.settings.readingPlanId    = 'default';
    initBookChapterControls();
    setupNavigationWithURL();
    setupPopStateListener();
    restoreBookChapterUI();
    applyTheme();
    applyColorTheme();
    restoreSidebarState();
    restorePanelStates();
    updateDateTime();
    initResizeHandles();
    updateCustomPdfInfo();
    switchNotesView(state.settings.notesView || 'text');
    updateBibleGatewayVersion();
    setupEventListeners();
    setInterval(updateDateTime, 1_000);
    const navigatedFromURL = navigateFromURL();
    if (!navigatedFromURL) {
        if (window.location.pathname !== '/') {
            loadPassage();
        }
    }
    console.log('App initialized successfully');
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}