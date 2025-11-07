/*=====================================================================
  Provinent Scripture Study – main.js
=====================================================================*/


/* ====================================================================
   TABLE OF CONTENTS
   
    DATE / TIME
    ERROR HANDLING
    EVENT LISTENERS
    GENERAL UTILITIES
    GLOBAL SETUP
    HIGHLIGHTING
    INITIALIZATION
    START THE APP
    THEMING
==================================================================== */


/* ====================================================================
   GLOBAL SETUP
   Configure external libraries and define API constants
==================================================================== */

/* Global imports */
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

/* ----------------------------------------------------------------
   PDF.js Configuration
   Set the worker script path for PDF rendering
---------------------------------------------------------------- */
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/* ----------------------------------------------------------------
   Marked.js Configuration
   Set options for markdown parsing (GitHub-flavored markdown)
---------------------------------------------------------------- */
if (typeof marked !== 'undefined') {
    marked.setOptions({ 
        breaks: true,       // Convert line breaks to <br>
        gfm: true          // GitHub Flavored Markdown
    });
}

/* ====================================================================
   DATE / TIME
   Current date display (updates every second)
==================================================================== */

/* Update current date display */
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


/* ====================================================================
   ERROR HANDLING
==================================================================== */
/* Create error handling utility */
class AppError extends Error {
    constructor(message, type, originalError) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.originalError = originalError;
    }
}

/* Centralized error handler */
export function handleError(error, context) {
    console.error(`Error in ${context}:`, error);
    
    const userMessage = error instanceof AppError 
        ? error.message 
        : 'An unexpected error occurred';
    
    showError(userMessage);
    
    // Log to external service if needed
    if (window.errorTracker) {
        window.errorTracker.log(error, context);
    }
}


/* ====================================================================
   EVENT LISTENERS
   Wire up all UI interactions
==================================================================== */

/* Setup all event listeners for the application */
function setupEventListeners() {
    // Theme Toggle
    document.querySelector('.theme-toggle')
            .addEventListener('click', toggleTheme);

    // Header Buttons
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

    // Toolbar Navigation
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

    // Sidebar Sections
    document.getElementById('referencePanelToggle')
            .addEventListener('click', toggleReferencePanel);
    document.querySelectorAll('.sidebar-section-header')
            .forEach(h => h.addEventListener('click', () => {
                const sec = h.dataset.section;
                toggleSection(sec);
            }));

    // Bible Gateway search button (dynamic translation searching)
    document.getElementById('referenceTranslation').addEventListener('change', function() {
        const tempTranslation = this.value;
        const oldTranslation = state.settings.referenceVersion;
        state.settings.referenceVersion = tempTranslation;
        
        updateBibleGatewayVersion();
        
        state.settings.referenceVersion = oldTranslation;
    });

    // Resize bar toggle
    document.addEventListener('DOMContentLoaded', makeToggleSticky);

    // Panel Collapse Toggles
    document.querySelectorAll('.collapse-toggle')
            .forEach(btn => btn.addEventListener('click', function () {
                const panel = this.closest('[id]');
                if (panel) togglePanelCollapse(panel.id);
            }));

    // Reference Panel Controls
    document.getElementById('referenceSource')
            .addEventListener('change', updateReferencePanel);
    document.getElementById('referenceTranslation')
            .addEventListener('change', updateReferencePanel);
    document.querySelector('.reference-panel-close')
            .addEventListener('click', toggleReferencePanel);

    // PDF Navigation
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

    // Notes Section
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

    // Color Picker (Highlighting)
    document.querySelectorAll('.color-option')
            .forEach(opt => opt.addEventListener('click', () => {
                const col = opt.dataset.color;
                applyHighlight(col);
            }));
    document.getElementById('removeHighlight')
            .addEventListener('click', () => applyHighlight('none'));

    // Right-Click -> Color Picker
    document.addEventListener('contextmenu', e => {
        const verse = e.target.closest('.verse');
        if (verse) {
            e.preventDefault();
            showColorPicker(e, verse);
        }
    });

    // Click Outside -> Hide Color Picker
    document.addEventListener('click', e => {
        const picker = document.getElementById('colorPicker');
        if (!picker.contains(e.target) && !e.target.closest('.verse')) {
            picker.classList.remove('active');
        }
    });

    // Highlights button
    document.getElementById('showHighlightsBtn')
            .addEventListener('click', showHighlightsModal);

    // Highlights modal close
    document.getElementById('closeHighlightsBtn')
            .addEventListener('click', closeHighlightsModal);
    document.getElementById('highlightsOverlay')
            .addEventListener('click', closeHighlightsModal);

    // Popup Overlays (Strong's)
    document.getElementById('popupOverlay')
            .addEventListener('click', closeStrongsPopup);
    document.querySelector('#strongsPopup .popup-close')
            .addEventListener('click', closeStrongsPopup);

    // Settings Modal
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
    
    // Setup footnote handlers when new content is loaded
    document.addEventListener('contentLoaded', () => {
        setTimeout(setupFootnoteHandlers, 50);
    });

    // Clear cache button
    document.getElementById('clearCacheBtn')
        .addEventListener('click', clearCache);
    
    // Delete All Data button
    document.getElementById('deleteAllDataBtn')
        .addEventListener('click', deleteAllData);

    // Settings -> PDF Upload
    document.getElementById('settingsPdfUploadBtn')
            .addEventListener('click', () => {
                document.getElementById('settingsPdfUpload').click();
            });
    document.getElementById('settingsPdfUpload')
            .addEventListener('change', handlePDFUpload);

    // Color Theme Selector
    document.querySelectorAll('.color-theme-option')
            .forEach(opt => opt.addEventListener('click', () => {
                const theme = opt.dataset.theme;
                selectColorTheme(theme);
            }));

    // Markdown Keyboard Shortcuts
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


/* ====================================================================
   GENERAL UTILITIES
   Helper functions for data conversion and UI feedback
==================================================================== */

/**
 * Convert ArrayBuffer to Base64 string
 * Used for storing binary PDF data as JSON
 */
export function arrayBufferToBase64(buf) {
    let binary = '';
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;  // Process in 32KB chunks to avoid stack overflow
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(
            null,
            Array.from(bytes.subarray(i, i + chunk))
        );
    }
    return btoa(binary);
}

/* Convert Base64 string to ArrayBuffer */
export function base64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        arr[i] = bin.charCodeAt(i);
    }
    return arr.buffer;
}

/* Read file as ArrayBuffer using FileReader */
export function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = e => resolve(e.target.result);
        r.onerror = () => reject(new Error('Failed to read file'));
        r.readAsArrayBuffer(file);
    });
}

/* Show/hide loading overlay */
export function showLoading(flag) {
    document.getElementById('loadingOverlay').classList.toggle('active', flag);
}

/* Display error message to user */
export function showError(msg) {
    document.getElementById('errorContainer').innerHTML =
        `<div class="error-message">${msg}</div>`;
}

/* Clear error message display */
export function clearError() {
    document.getElementById('errorContainer').innerHTML = '';
}

/* Checks the offline status of the app functions */
function updateOfflineStatus(isOffline) {
    const indicator = document.getElementById('offlineIndicator');
    if (!indicator) {
        // Create offline indicator if it doesn't exist
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
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            newIndicator.style.opacity = '0';
            setTimeout(() => newIndicator.remove(), 300);
        }, 3000);
    } else {
        indicator.textContent = isOffline ? 'Offline Mode' : 'Online';
        indicator.style.background = isOffline ? '#ff6b6b' : '#51cf66';
    }
}

// CSS for the offline indicator
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


/* ====================================================================
   HIGHLIGHTING
   Right-click color picker for verse highlighting
==================================================================== */

/* Show color picker at mouse position */
function showColorPicker(ev, verseEl) {
    const picker = document.getElementById('colorPicker');
    state.currentVerse = verseEl;
    picker.style.left = ev.pageX + 'px';
    picker.style.top = ev.pageY + 'px';
    picker.classList.add('active');
}

/* Apply highlight color to selected verse */
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

/* Clear all verse highlights */
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

/* Open highlights modal */
function showHighlightsModal() {
    const overlay = document.getElementById('highlightsOverlay');
    const modal = document.getElementById('highlightsModal');
    
    overlay.classList.add('active');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    renderHighlights('all');
    
    // Add filter button listeners
    document.querySelectorAll('.highlight-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.highlight-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderHighlights(this.dataset.color);
        });
    });
}

/* Close highlights modal */
function closeHighlightsModal() {
    const overlay = document.getElementById('highlightsOverlay');
    const modal = document.getElementById('highlightsModal');
    
    overlay.classList.remove('active');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

/* Render highlights list in modal */
function renderHighlights(filterColor = 'all') {
    const highlightsList = document.getElementById('highlightsList');
    const highlights = state.highlights || {};
    
    if (Object.keys(highlights).length === 0) {
        highlightsList.innerHTML = '<div class="no-highlights">No verses have been highlighted yet</div>';
        return;
    }
    
    let html = '';
    const versesByColor = {};
    
    // Group verses by color
    Object.entries(highlights).forEach(([reference, color]) => {
        if (!versesByColor[color]) versesByColor[color] = [];
        versesByColor[color].push(reference);
    });
    
    // Sort verses within each color group
    Object.keys(versesByColor).forEach(color => {
        versesByColor[color].sort((a, b) => {
            // Sort by book, chapter, verse
            const [bookA, chapA, verseA] = a.split(/[ :]/);
            const [bookB, chapB, verseB] = b.split(/[ :]/);
            
            const bookOrderA = BOOK_ORDER.indexOf(bookA);
            const bookOrderB = BOOK_ORDER.indexOf(bookB);
            
            if (bookOrderA !== bookOrderB) return bookOrderA - bookOrderB;
            if (parseInt(chapA) !== parseInt(chapB)) return parseInt(chapA) - parseInt(chapB);
            return parseInt(verseA) - parseInt(verseB);
        });
    });
    
    // Render verses
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
    
    // Add click handlers to navigate to verses
    document.querySelectorAll('.highlight-item').forEach(item => {
        item.addEventListener('click', () => {
            const reference = item.dataset.reference;
            navigateToHighlightedVerse(reference);
            closeHighlightsModal();
        });
    });
}

/* Retrieve verse text from localStorage cache */
function getVerseTextFromStorage(reference) {
    try {
        const cachedVerses = JSON.parse(localStorage.getItem('cachedVerses') || '{}');
        return cachedVerses[reference];
    } catch (e) {
        return null;
    }
}

/* Navigate to the highlighted verse in the main passage when selected from highlights modal */
function navigateToHighlightedVerse(reference) {
    // Parse reference format: "Book Chapter:Verse"
    const match = reference.match(/^(.+?) (\d+):(\d+)$/);
    if (!match) return;
    
    const [, book, chapter, verse] = match;
    
    // Update navigation
    state.settings.readingMode = 'manual';
    state.settings.manualBook = book;
    state.settings.manualChapter = parseInt(chapter);
    
    // Update URL
    const translation = getCurrentTranslation();
    updateURL(translation, book, chapter);
    
    // Load the chapter
    loadSelectedChapter(book, chapter);
    
    // Scroll to the specific verse (you'll need to add this to passage.js)
    setTimeout(() => scrollToVerse(verse), 500);
}


/* ====================================================================
   THEMING
   Light/dark mode and color palette selection
==================================================================== */

/* Toggle between light and dark themes */
function toggleTheme() {
    state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    saveToStorage();
    saveToCookies();
}

/* Apply current theme to document (dark mode/light mode) */
export function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    const themeIcon = document.getElementById('themeIcon');
    themeIcon.textContent = '';
    themeIcon.className = state.settings.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    
    // Refresh highlights modal if open
    refreshHighlightsModalTheme();
}

/* Select a color theme */
export function selectColorTheme(t) {
    state.settings.colorTheme = t;
    applyColorTheme();
    
    document.querySelectorAll('.color-theme-option')
            .forEach(o => o.classList.remove('selected'));
    document.querySelector(`.color-theme-option[data-theme="${t}"]`)
            .classList.add('selected');
    
    // Refresh highlights modal if open
    refreshHighlightsModalTheme();
}

/* Apply current color theme (user selected color scheme) to document */
export function applyColorTheme() {
    document.documentElement.setAttribute('data-color-theme', state.settings.colorTheme);
    
    // Refresh highlights modal if open
    refreshHighlightsModalTheme();
}

/* Refresh highlights modal to match current theme/color */
function refreshHighlightsModalTheme() {
    const modal = document.getElementById('highlightsModal');
    if (modal.classList.contains('show')) {
        // Re-render highlights to apply new theme
        const activeFilter = document.querySelector('.highlight-filter-btn.active')?.dataset.color || 'all';
        renderHighlights(activeFilter);
    }
}


/* ====================================================================
   INITIALIZATION
   Application startup sequence
==================================================================== */

/**
 * Initialize the application
 * Main entry point called on DOM ready
 */
async function init() {
    await loadFromStorage();
    loadFromCookies();
    setupPDFCleanup();

    // Add offline styles
    const style = document.createElement('style');
    style.textContent = offlineStyles;
    document.head.appendChild(style);
    
    // Check initial online status
    updateOfflineStatus(!navigator.onLine);
    
    // Listen for online/offline events
    window.addEventListener('online', () => updateOfflineStatus(false));
    window.addEventListener('offline', () => updateOfflineStatus(true));

    // Guard defaults for other settings
    if (!state.settings.readingMode)    state.settings.readingMode      = 'readingPlan';
    if (!state.settings.readingPlanId)  state.settings.readingPlanId    = 'default';
    
    // Initialize manual navigation
    initBookChapterControls();
    setupNavigationWithURL();
    setupPopStateListener();
    
    // Restore the book/chapter UI
    restoreBookChapterUI();

    // Apply theme
    applyTheme();
    applyColorTheme();

    // Restore UI state
    restoreSidebarState();
    restorePanelStates();

    // Initialize components
    updateDateTime();
    initResizeHandles();
    updateCustomPdfInfo();
    switchNotesView(state.settings.notesView || 'text');
    updateBibleGatewayVersion();

    // Wire up all event listeners
    setupEventListeners();

    // Start periodic updates
    setInterval(updateDateTime, 1_000);
    
    const navigatedFromURL = navigateFromURL();
    if (!navigatedFromURL) {
        if (window.location.pathname !== '/') {
            loadPassage();
        }
        // If we're at root path, navigateFromURL should have handled the redirect
    }
    
    console.log('App initialized successfully');
}


/* ====================================================================
   START THE APP
   Execute initialization when DOM is ready
==================================================================== */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

