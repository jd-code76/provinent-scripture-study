/*=====================================================================
  Provinent Scripture Study – main.js
=====================================================================*/

import { isKJV, playChapterAudio, pauseChapterAudio, resumeChapterAudio, stopChapterAudio } from './modules/api.js';
import { applyHighlight, clearHighlights, closeHighlightsModal, renderHighlights, showColorPicker, showHighlightsModal } from './modules/highlights.js';
import { showHelpModal } from './modules/hotkeys.js';
import { handleMobileNavResize } from './modules/mobile.js'
import { initBookChapterControls, loadSelectedChapter, navigateFromURL, nextPassage, prevPassage, randomPassage, setupNavigationWithURL, setupPopStateListener } from './modules/navigation.js'
import { clearCache, closeSettings, deleteAllData, exportData, importData, initializeAudioControls, initialiseNarratorSelect, openSettings, saveSettings } from './modules/settings.js'
import { APP_VERSION, BOOK_ORDER, updateBibleGatewayVersion, loadFromCookies, loadFromStorage, saveToStorage, state } from './modules/state.js'
import { closeStrongsPopup, showStrongsReference } from './modules/strongs.js'
import { exportNotes, initResizeHandles, insertMarkdown, restoreBookChapterUI, restorePanelStates, restoreSidebarState, switchNotesView, togglePanelCollapse, toggleReferencePanel, toggleSection, 
    updateMarkdownPreview, updateReferencePanel, updateNotesFontSize, updateScriptureFontSize } from './modules/ui.js'

/* ====================================================================
   CONSTANTS
==================================================================== */

// Touch event state management
let touchStartTime = 0;
let longPressTimer = null;
let touchStartY = 0;
let isScrolling = false;

/* ====================================================================
   Marked.js Configuration
   GitHub-flavored markdown parsing setup
==================================================================== */
if (typeof marked !== 'undefined') {
    marked.setOptions({ 
        breaks: true,       // Convert line breaks to <br>
        gfm: true          // GitHub Flavored Markdown
    });
}

/* ====================================================================
   ERROR HANDLING
   Centralized error management utilities
==================================================================== */

class AppError extends Error {
    constructor(message, type, originalError) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.originalError = originalError;
    }
}

export function handleError(error, context, userFriendlyMessage) {
    console.error(`Error in ${context}:`, error);

    const rawMsg = userFriendlyMessage ?? 
        (error instanceof AppError ? error.message : 'An unexpected error occurred');
    const escapedMsg = escapeHTML(rawMsg);

    showError(escapedMsg);

    if (window.errorTracker) {
        window.errorTracker.log(error, context);
    }
}

export function showError(escapedMsg) {
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
        errorContainer.innerHTML = `<div class="error-message">${escapedMsg}</div>`;
    }
}

export function clearError() {
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
        errorContainer.innerHTML = '';
    }
}

/* ====================================================================
   GENERAL UTILITIES
   Helper functions for application functionality
==================================================================== */

export function getFormattedDateForFilename() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${month}-${day}-${year}-${hours}${minutes}`;
}

export function getFormattedDateForDisplay() {
    const now = new Date();
    return now.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

export function getSimpleDate() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    
    return `${month}-${day}-${year}`;
}

export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function formatDateTime(isoDate) {
    const date = new Date(isoDate);
    const dateStr = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    return `${dateStr}, ${timeStr}`;
}

export function showLoading(flag) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.toggle('active', flag);
}

export function updateHeaderTitle() {
    const headerTitleEl = document.getElementById('passageHeaderTitle');
    if (headerTitleEl) {
        const translation = state.settings.bibleTranslation || 'BSB';
        headerTitleEl.textContent = `Holy Bible: ${translation}`;
    }
}

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

function handleTouchMove(e) {
    if (longPressTimer && e.touches && e.touches[0]) {
        const currentY = e.touches[0].clientY;
        if (Math.abs(currentY - touchStartY) > 10) {
            isScrolling = true;
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }
}

function handleTouchCancel() {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    isScrolling = false;
}

function handleTouchEnd(e) {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    
    const verse = e.target.closest('.verse');
    const colorPicker = document.getElementById('colorPicker');
    
    if (verse && !isScrolling && !e.target.closest('.footnote-ref')) {
        const touchDuration = Date.now() - touchStartTime;
        
        if (!colorPicker?.classList.contains('active')) {
            if (touchDuration < 300 && touchDuration > 50) {
                showStrongsReference(verse);
            }
        }
    }
    
    isScrolling = false;
}

export function escapeHTML(string) {
    return string.replace(/[&<>"']/g, char => {
        const escape = {
            '&': '&amp;',
            '<': '&lt;', 
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return escape[char];
    });
}

/* ====================================================================
   THEMING
   Theme management functions
==================================================================== */

export function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    const themeIcon = document.getElementById('themeIcon');
    
    if (themeIcon) {
        themeIcon.textContent = '';
        themeIcon.className = state.settings.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
    
    refreshHighlightsModalTheme();
}

export function selectColorTheme(theme) {
    state.settings.colorTheme = theme;
    applyColorTheme();
    
    document.querySelectorAll('.color-theme-option').forEach(o => {
        o.classList.remove('selected');
    });
    
    const selectedOption = document.querySelector(`.color-theme-option[data-theme="${theme}"]`);
    if (selectedOption) selectedOption.classList.add('selected');
    
    refreshHighlightsModalTheme();
}

export function applyColorTheme() {
    document.documentElement.setAttribute('data-color-theme', state.settings.colorTheme);
    refreshHighlightsModalTheme();
}

function refreshHighlightsModalTheme() {
    const modal = document.getElementById('highlightsModal');
    if (modal?.classList.contains('show')) {
        const activeFilter = document.querySelector('.highlight-filter-btn.active')?.dataset.color || 'all';
        renderHighlights(activeFilter);
    }
}

/* ====================================================================
   EVENT LISTENERS
   Centralized event binding for UI interactions
==================================================================== */

function setupEventListeners() {
    setupHeaderButtons();
    setupToolbarNavigation();
    setupAudioControls();
    setupKeyboardShortcuts();
    setupSidebarControls();
    setupNotesControls();
    setupHighlightingControls();
    setupModalControls();
    setupMarkdownShortcuts();
    setupTouchEvents();
}

function setupHeaderButtons() {
    const buttons = {
        openSettingsBtn: openSettings,
        exportDataBtn: exportData,
        importDataBtn: () => document.getElementById('importFile').click()
    };
    
    Object.entries(buttons).forEach(([id, handler]) => {
        const element = document.getElementById(id);
        if (element) element.addEventListener('click', handler);
    });
    
    const importFile = document.getElementById('importFile');
    if (importFile) importFile.addEventListener('change', importData);
}

function setupToolbarNavigation() {
    const navigation = {
        prevPassageBtn: prevPassage,
        nextPassageBtn: nextPassage,
        randomPassageBtn: randomPassage
    };
    
    Object.entries(navigation).forEach(([id, handler]) => {
        const element = document.getElementById(id);
        if (element) element.addEventListener('click', handler);
    });
}

function setupAudioControls() {
    document.addEventListener('DOMContentLoaded', function() {
        const playBtn = document.querySelector('.play-audio-btn');
        const pauseBtn = document.querySelector('.pause-audio-btn');
        const stopBtn = document.querySelector('.stop-audio-btn');
        
        if (playBtn) playBtn.addEventListener('click', handleAudioPlayback);
        if (pauseBtn) pauseBtn.addEventListener('click', pauseChapterAudio);
        if (stopBtn) stopBtn.addEventListener('click', stopChapterAudio);
    });
}

function handleAudioPlayback() {
    const translation = state.settings.bibleTranslation;
    const narratorSelect = document.querySelector('.narrator-select');
    
    if (isKJV(translation)) {
        if (state.audioPlayer?.isPaused) {
            resumeChapterAudio();
        } else if (state.audioPlayer?.isPlaying) {
            pauseChapterAudio();
        } else {
            playChapterAudio();
        }
    } else {
        if (state.audioPlayer?.isPaused) {
            resumeChapterAudio();
        } else if (state.audioPlayer?.isPlaying) {
            pauseChapterAudio();
        } else {
            const narrator = narratorSelect?.value || state.settings.audioNarrator || 'gilbert';
            playChapterAudio(narrator);
        }
    }
}

export function handleNarratorChange(newNarrator) {
    state.settings.audioNarrator = newNarrator;
    saveToStorage();
    if (state.audioPlayer && !isKJV(state.settings.bibleTranslation)) {
        stopChapterAudio();
        setTimeout(() => playChapterAudio(newNarrator), 100);
    }
}

function setupKeyboardShortcuts() {
    const shortcutsBtn = document.getElementById('keyboardShortcutsBtn');
    if (shortcutsBtn) {
        shortcutsBtn.addEventListener('click', () => {
            closeSettings();
            showHelpModal();
        });
    }
}

function setupSidebarControls() {
    const refToggle = document.getElementById('referencePanelToggle');
    if (refToggle) refToggle.addEventListener('click', toggleReferencePanel);
    
    document.querySelectorAll('.sidebar-section-header').forEach(h => {
        h.addEventListener('click', () => toggleSection(h.dataset.section));
    });
    
    document.querySelectorAll('.collapse-toggle').forEach(btn => {
        btn.addEventListener('click', function() {
            const panel = this.closest('[id]');
            if (panel) togglePanelCollapse(panel.id);
        });
    });
    
    const refSource = document.getElementById('referenceSource');
    const refTranslation = document.getElementById('referenceTranslation');
    const refClose = document.querySelector('.reference-panel-close');
    
    if (refSource) refSource.addEventListener('change', updateReferencePanel);
    if (refTranslation) refTranslation.addEventListener('change', handleReferenceTranslationChange);
    if (refClose) refClose.addEventListener('click', toggleReferencePanel);
}

function handleReferenceTranslationChange(e) {
    state.settings.referenceVersion = e.target.value;
    updateBibleGatewayVersion();
    saveToStorage();
    
    const settingsDropdown = document.getElementById('referenceVersionSetting');
    if (settingsDropdown) {
        settingsDropdown.value = e.target.value;
    }
    
    updateReferencePanel();
}

function setupNotesControls() {
    const notesInput = document.getElementById('notesInput');
    const textViewBtn = document.getElementById('textViewBtn');
    const markdownViewBtn = document.getElementById('markdownViewBtn');
    
    if (notesInput) notesInput.addEventListener('input', handleNotesInput);
    if (textViewBtn) textViewBtn.addEventListener('click', () => switchNotesView('text'));
    if (markdownViewBtn) markdownViewBtn.addEventListener('click', () => switchNotesView('markdown'));
    
    document.querySelectorAll('.markdown-btn').forEach(btn => {
        btn.addEventListener('click', () => insertMarkdown(btn.dataset.format));
    });
    
    document.querySelectorAll('.notes-controls button').forEach(btn => {
        btn.addEventListener('click', () => exportNotes(btn.dataset.format));
    });
}

function handleNotesInput(e) {
    state.notes = e.target.value;
    saveToStorage();
    if (state.settings.notesView === 'markdown') {
        updateMarkdownPreview();
    }
}

function setupHighlightingControls() {
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => applyHighlight(opt.dataset.color));
    });
    
    const removeHighlight = document.getElementById('removeHighlight');
    if (removeHighlight) {
        removeHighlight.addEventListener('click', () => applyHighlight('none'));
    }
    
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleOutsideColorPickerClick);
    
    const showHighlightsBtn = document.getElementById('showHighlightsBtn');
    const closeHighlightsBtn = document.getElementById('closeHighlightsBtn');
    const highlightsOverlay = document.getElementById('highlightsOverlay');
    
    if (showHighlightsBtn) showHighlightsBtn.addEventListener('click', showHighlightsModal);
    if (closeHighlightsBtn) closeHighlightsBtn.addEventListener('click', closeHighlightsModal);
    if (highlightsOverlay) highlightsOverlay.addEventListener('click', closeHighlightsModal);
}

function handleContextMenu(e) {
    const verse = e.target.closest('.verse');
    if (verse) {
        e.preventDefault();
        showColorPicker(e, verse);
    }
}

function handleOutsideColorPickerClick(e) {
    const picker = document.getElementById('colorPicker');
    if (picker && !picker.contains(e.target) && !e.target.closest('.verse')) {
        picker.classList.remove('active');
    }
}

function setupModalControls() {
    const popupOverlay = document.getElementById('popupOverlay');
    const strongsClose = document.querySelector('#strongsPopup .popup-close');
    
    if (popupOverlay) popupOverlay.addEventListener('click', closeStrongsPopup);
    if (strongsClose) strongsClose.addEventListener('click', closeStrongsPopup);
    
    const settingsOverlay = document.getElementById('settingsOverlay');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const clearHighlightsBtn = document.getElementById('clearHighlightsBtn');
    
    if (settingsOverlay) settingsOverlay.addEventListener('click', closeSettings);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);
    if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', closeSettings);
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
    if (clearHighlightsBtn) clearHighlightsBtn.addEventListener('click', clearHighlights);
    
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    const deleteAllDataBtn = document.getElementById('deleteAllDataBtn');
    
    if (clearCacheBtn) clearCacheBtn.addEventListener('click', clearCache);
    if (deleteAllDataBtn) deleteAllDataBtn.addEventListener('click', deleteAllData);
    
    document.querySelectorAll('.color-theme-option').forEach(opt => {
        opt.addEventListener('click', () => selectColorTheme(opt.dataset.theme));
    });
}

function setupMarkdownShortcuts() {
    document.addEventListener('keydown', handleMarkdownShortcuts);
}

function handleMarkdownShortcuts(e) {
    const textarea = document.getElementById('notesInput');
    if (document.activeElement !== textarea) return;
    
    const ctrlCmd = e.ctrlKey || e.metaKey;
    
    if (ctrlCmd && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
            case 'b': e.preventDefault(); insertMarkdown('bold'); break;
            case 'i': e.preventDefault(); insertMarkdown('italic'); break;
            case 'k': e.preventDefault(); insertMarkdown('link'); break;
            case '1': e.preventDefault(); insertMarkdown('h1'); break;
            case '2': e.preventDefault(); insertMarkdown('h2'); break;
            case '3': e.preventDefault(); insertMarkdown('h3'); break;
            case '`': e.preventDefault(); insertMarkdown('code'); break;
        }
    }
    
    if (ctrlCmd && e.shiftKey) {
        switch (e.key.toLowerCase()) {
            case 'u': e.preventDefault(); insertMarkdown('ul'); break;
            case 'o': e.preventDefault(); insertMarkdown('ol'); break;
            case '>': e.preventDefault(); insertMarkdown('quote'); break;
        }
    }
}

function setupTouchEvents() {
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchCancel);
}

/* ====================================================================
   INITIALIZATION
   Application startup sequence
==================================================================== */

async function init() {
    try {
        await loadFromStorage();
        loadFromCookies();
        
        const style = document.createElement('style');
        document.head.appendChild(style);
        
        initBookChapterControls();
        initializeAudioControls();
        initialiseNarratorSelect();
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
        
        if (typeof updateScriptureFontSize === 'function') {
            updateScriptureFontSize(state.settings.scriptureFontSize);
        }
        if (typeof updateNotesFontSize === 'function') {
            updateNotesFontSize(state.settings.notesFontSize);
        }
        
        updateHeaderTitle();
        initResizeHandles();
        switchNotesView(state.settings.notesView || 'text');
        updateBibleGatewayVersion();
        setupEventListeners();
        
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                handleMobileNavResize();
            }, 150); // Debounce for 150ms to avoid excessive calls
        });
        handleMobileNavResize();
        
        setTimeout(() => {
            const container = document.querySelector('.container');
            if (container) container.classList.add('loaded');
        }, 100);

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => navigator.serviceWorker.ready)
                .then(reg => {
                    reg.active.postMessage({ type: 'VERSION', version: APP_VERSION });
                    console.log('Sent version to SW:', APP_VERSION);
                })
                .catch(err => console.error('SW registration failed:', err));
        }
        
        console.log('App initialized successfully');
    } catch (error) {
        handleError(error, 'app initialization');
    }
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
