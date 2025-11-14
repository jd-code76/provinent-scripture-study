/*=====================================================================
  Provinent Scripture Study – main.js
=====================================================================*/

/* Global imports */
import {
    isKJV,
    playChapterAudio,
    pauseChapterAudio,
    resumeChapterAudio,
    stopChapterAudio
} from './modules/api.js';

import { handleKeyPress, showHelpModal } from './modules/hotkeys.js';

import { 
    applyHighlight,
    clearHighlights,
    closeHighlightsModal,
    renderHighlights,
    showColorPicker,
    showHighlightsModal
} from './modules/highlights.js';

import {
    initBookChapterControls,
    loadSelectedChapter,
    navigateFromURL,
    nextPassage,
    prevPassage,
    randomPassage,
    setupNavigationWithURL,
    setupPopStateListener
} from './modules/navigation.js'

import { setupFootnoteHandlers } from './modules/passage.js'

import {
    clearCache,
    closeSettings,
    deleteAllData,
    exportData,
    importData,
    initializeAudioControls,
    openSettings,
    saveSettings
} from './modules/settings.js'

import {
    BOOK_ORDER,
    updateBibleGatewayVersion,
    loadFromCookies,
    loadFromStorage,
    saveToCookies,
    saveToStorage,
    state
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
    togglePanelCollapse,
    toggleReferencePanel,
    toggleSection,
    updateMarkdownPreview,
    updateReferencePanel
} from './modules/ui.js'

/* Global constants */
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

/* Touch event handlers for mobile highlighting */
let touchStartTime = 0;
let longPressTimer = null;
let touchStartY = 0;
let isScrolling = false;

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

/* Display error message to user */
export function showError(msg) {
    document.getElementById('errorContainer').innerHTML =
        `<div class="error-message">${msg}</div>`;
}

/* Clear error message display */
export function clearError() {
    document.getElementById('errorContainer').innerHTML = '';
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

    // Toolbar Navigation
    document.getElementById('prevPassageBtn')
            .addEventListener('click', prevPassage);
    document.getElementById('nextPassageBtn')
            .addEventListener('click', nextPassage);
    document.getElementById('randomPassageBtn')
            .addEventListener('click', randomPassage);

    // Audio Controls
    document.addEventListener('DOMContentLoaded', function() {
        const playBtn = document.querySelector('.play-audio-btn');
        const pauseBtn = document.querySelector('.pause-audio-btn');
        const stopBtn = document.querySelector('.stop-audio-btn');
        const narratorSelect = document.querySelector('.narrator-select');
        
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                const translation = state.settings.bibleTranslation;
                
                if (isKJV(translation)) {
                    // Simple play for KJV
                    if (state.audioPlayer?.isPaused) {
                        resumeChapterAudio();
                    } else if (state.audioPlayer?.isPlaying) {
                        pauseChapterAudio();
                    } else {
                        playChapterAudio();
                    }
                } else {
                    // BSB with narrator selection
                    if (state.audioPlayer?.isPaused) {
                        resumeChapterAudio();
                    } else if (state.audioPlayer?.isPlaying) {
                        pauseChapterAudio();
                    } else {
                        const narrator = narratorSelect?.value || state.settings.audioNarrator || 'gilbert';
                        playChapterAudio(narrator);
                    }
                }
            });
        }
        
        if (pauseBtn) {
            pauseBtn.addEventListener('click', pauseChapterAudio);
        }
        
        if (stopBtn) {
            stopBtn.addEventListener('click', stopChapterAudio);
        }
        
        if (narratorSelect) {
            narratorSelect.addEventListener('change', (e) => {
                const newNarrator = e.target.value;
                
                state.settings.audioNarrator = newNarrator;
                saveToStorage();
                
                if (state.audioPlayer && !isKJV(state.settings.bibleTranslation)) {
                    stopChapterAudio();
                    setTimeout(() => playChapterAudio(newNarrator), 100);
                }
            });
        }
    });

    // Keyboard Shortcuts
    document.getElementById('keyboardShortcutsBtn').addEventListener('click', () => {
        closeSettings();
        showHelpModal();
    });

    // Sidebar Sections
    document.getElementById('referencePanelToggle')
            .addEventListener('click', toggleReferencePanel);
    document.querySelectorAll('.sidebar-section-header')
            .forEach(h => h.addEventListener('click', () => {
                const sec = h.dataset.section;
                toggleSection(sec);
            }));

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
    document.getElementById('referenceTranslation').addEventListener('change', function() {
        state.settings.referenceVersion = this.value;
        updateBibleGatewayVersion();
        saveToStorage();
        
        const settingsDropdown = document.getElementById('referenceVersionSetting');
        if (settingsDropdown) {
            settingsDropdown.value = this.value;
        }
        
        updateReferencePanel();
    });
    document.querySelector('.reference-panel-close')
            .addEventListener('click', toggleReferencePanel);

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

    // Mobile touch events for highlighting
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchCancel);
}

/* ====================================================================
   GENERAL UTILITIES
   Helper functions for data conversion and UI feedback
==================================================================== */

/* Show/hide loading overlay */
export function showLoading(flag) {
    document.getElementById('loadingOverlay').classList.toggle('active', flag);
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

/* Update header title with current translation */
function updateHeaderTitle() {
    const headerTitleEl = document.getElementById('passageHeaderTitle');
    if (headerTitleEl) {
        const translation = state.settings.bibleTranslation || 'BSB';
        headerTitleEl.textContent = `Holy Bible: ${translation}`;
    }
}

/* Touch event handlers for mobile highlighting */
function handleTouchStart(e) {
    const verse = e.target.closest('.verse');
    if (verse) {
        touchStartTime = Date.now();
        touchStartY = e.touches[0].clientY;
        isScrolling = false;
        
        longPressTimer = setTimeout(() => {
            if (!isScrolling) {
                showColorPicker(e, verse);
            }
        }, 500);
        
        if (!e.target.closest('.verse')) {
            e.preventDefault();
        }
    }
}

/* Handle touch move to detect scrolling */
function handleTouchMove(e) {
    if (longPressTimer && e.touches && e.touches[0]) {
        const currentY = e.touches[0].clientY;
        if (Math.abs(currentY - touchStartY) > 10) {
            isScrolling = true;
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }
    }
}

/* Handle touch cancel to clear long-press timer */
function handleTouchCancel() {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    isScrolling = false;
}

/* Handle touch end to differentiate tap vs long-press */
function handleTouchEnd(e) {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    
    const verse = e.target.closest('.verse');
    const colorPicker = document.getElementById('colorPicker');
    
    if (verse && !isScrolling && !e.target.closest('.footnote-ref')) {
        const touchDuration = Date.now() - touchStartTime;
        
        if (!colorPicker.classList.contains('active')) {
            if (touchDuration < 300 && touchDuration > 50) {
                showStrongsReference(verse);
            }
        }
    }
    
    isScrolling = false;
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
    
    refreshHighlightsModalTheme();
}

/* Apply current color theme (user selected color scheme) to document */
export function applyColorTheme() {
    document.documentElement.setAttribute('data-color-theme', state.settings.colorTheme);
    
    refreshHighlightsModalTheme();
}

/* Refresh highlights modal to match current theme/color */
function refreshHighlightsModalTheme() {
    const modal = document.getElementById('highlightsModal');
    if (modal.classList.contains('show')) {
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
    const style = document.createElement('style');
    style.textContent = offlineStyles;
    document.head.appendChild(style);
    updateOfflineStatus(!navigator.onLine);
    window.addEventListener('online', () => updateOfflineStatus(false));
    window.addEventListener('offline', () => updateOfflineStatus(true));
    initBookChapterControls();
    initializeAudioControls();
    setupNavigationWithURL();
    setupPopStateListener();
    if (!navigateFromURL()) {
        loadSelectedChapter(
            state.settings.manualBook || BOOK_ORDER[0],
            state.settings.manualChapter || 1
        );
    }
    restoreBookChapterUI();
    applyTheme();
    applyColorTheme();
    restoreSidebarState();
    restorePanelStates();
    updateHeaderTitle();
    initResizeHandles();
    switchNotesView(state.settings.notesView || 'text');
    updateBibleGatewayVersion();
    setupEventListeners();
    
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
