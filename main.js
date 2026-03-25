import { isKJV, playChapterAudio, pauseChapterAudio, resumeChapterAudio, stopChapterAudio } from './modules/api.js';
import { applyHighlight, clearHighlights, closeHighlightsModal, renderHighlights, showColorPicker, showHighlightsModal } from './modules/highlights.js';
import { showHelpModal } from './modules/hotkeys.js';
import { initBookChapterControls, loadSelectedChapter, navigateFromURL, nextPassage, prevPassage, randomPassage, setupNavigationWithURL, setupPopStateListener } from './modules/navigation.js'
import { clearCache, closeSettings, deleteAllData, exportData, importData, initializeAudioControls, initialiseNarratorSelect, openSettings, saveSettings } from './modules/settings.js'
import { APP_VERSION, BOOK_ORDER, updateBibleGatewayVersion, loadFromCookies, loadFromStorage, saveToStorage, state } from './modules/state.js'
import { closeStrongsPopup, showStrongsReference } from './modules/strongs.js'
import { exportNotes, initResizeHandles, insertMarkdown, restoreBookChapterUI, restorePanelStates, restoreSidebarState, switchNotesView, togglePanelCollapse, toggleReferencePanel, toggleSection, 
    updateMarkdownPreview, updateReferencePanel, updateNotesFontSize, updateScriptureFontSize } from './modules/ui.js'
const OFFLINE_STYLES = `
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
let touchStartTime = 0;
let longPressTimer = null;
let touchStartY = 0;
let isScrolling = false;
if (typeof marked !== 'undefined') {
    marked.setOptions({ 
        breaks: true,       
        gfm: true          
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
function updateOfflineStatus(isOffline) {
    let indicator = document.getElementById('offlineIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'offlineIndicator';
        indicator.style.cssText = `
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
        document.body.appendChild(indicator);
    }
    indicator.textContent = isOffline ? 'Offline Mode' : 'Online';
    indicator.style.background = isOffline ? '#ff6b6b' : '#51cf66';
    setTimeout(() => {
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 300);
    }, 3000);
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
function initMobileNav() {
    const mobileTabs = document.querySelectorAll('.mobile-nav-tab');
    const mobilePanel = document.getElementById('mobilePanel');
    const mobilePanelContent = document.getElementById('mobilePanelContent');
    const mobilePanelClose = document.getElementById('mobilePanelClose');
    const sidebar = document.querySelector('.sidebar');
    const notesSection = document.querySelector('.notes-section');
    const referencePanel = document.getElementById('referencePanel');
    if (window.innerWidth > 768) return;
    mobileTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const panel = this.dataset.panel;
            mobileTabs.forEach(t => t.classList.remove('active'));
            if (sidebar) sidebar.style.display = 'none';
            if (notesSection) notesSection.style.display = 'none';
            mobilePanel.classList.remove('active');
            switch(panel) {
                case 'scripture':
                    if (referencePanel) referencePanel.classList.remove('active');
                    this.classList.add('active');
                    break;
                case 'sidebar':
                    if (referencePanel) referencePanel.classList.remove('active');
                    this.classList.add('active');
                    if (sidebar) {
                        mobilePanelContent.innerHTML = sidebar.outerHTML;
                        const clonedSidebar = mobilePanelContent.querySelector('.sidebar');
                        clonedSidebar.style.display = 'flex';
                        clonedSidebar.style.flexDirection = 'column';
                        clonedSidebar.style.height = '100%';
                        clonedSidebar.querySelector('.collapse-toggle')?.remove();
                        reattachSidebarEvents(clonedSidebar);
                    }
                    mobilePanel.classList.add('active');
                    break;
                case 'notes':
                    if (referencePanel) referencePanel.classList.remove('active');
                    this.classList.add('active');
                    if (notesSection) {
                        mobilePanelContent.innerHTML = notesSection.outerHTML;
                        const clonedNotes = mobilePanelContent.querySelector('.notes-section');
                        clonedNotes.style.display = 'flex';
                        clonedNotes.style.height = '100%';
                        clonedNotes.querySelector('.collapse-toggle')?.remove();
                        reattachNotesEvents(clonedNotes);
                    }
                    mobilePanel.classList.add('active');
                    break;
                case 'reference':
                    if (referencePanel) {
                        const isCurrentlyActive = referencePanel.classList.contains('active');
                        if (isCurrentlyActive) {
                            referencePanel.classList.remove('active');
                            state.settings.referencePanelOpen = false;
                            saveToStorage();
                        } else {
                            this.classList.add('active');
                            referencePanel.classList.add('active');
                            state.settings.referencePanelOpen = true;
                            saveToStorage();
                            const iframe = referencePanel.querySelector('.reference-panel-iframe');
                            if (iframe && !iframe.src) {
                                updateReferencePanel();
                            }
                            setupReferencePanelCloseButton(referencePanel, mobileTabs);
                        }
                    }
                    break;
                case 'settings':
                    openSettings();
                    const scriptureTab = document.querySelector('[data-panel="scripture"]');
                    if (scriptureTab) scriptureTab.classList.add('active');
                    break;
            }
        });
    });
    if (mobilePanelClose) {
        mobilePanelClose.addEventListener('click', function() {
            mobilePanel.classList.remove('active');
            delete mobilePanel.dataset.activePanel;
            mobileTabs.forEach(t => {
                if (t.dataset.panel === 'scripture') t.classList.add('active');
                else t.classList.remove('active');
            });
        });
    }
}
function setupReferencePanelCloseButton(referencePanel, mobileTabs) {
    const refClose = referencePanel.querySelector('.reference-panel-close');
    if (refClose) {
        const newRefClose = refClose.cloneNode(true);
        refClose.parentNode.replaceChild(newRefClose, refClose);
        newRefClose.addEventListener('click', () => {
            referencePanel.classList.remove('active');
            state.settings.referencePanelOpen = false;
            saveToStorage();
            mobileTabs.forEach(t => t.classList.remove('active'));
            const scriptureTab = document.querySelector('[data-panel="scripture"]');
            if (scriptureTab) scriptureTab.classList.add('active');
        });
    }
}
function reattachSidebarEvents(sidebarElement) {
    sidebarElement.querySelectorAll('.sidebar-section-header').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        newHeader.addEventListener('click', () => {
            const content = newHeader.nextElementSibling;
            const toggle = newHeader.querySelector('.section-toggle');
            if (content && content.classList.contains('sidebar-section-content')) {
                const isCollapsed = content.classList.contains('collapsed');
                if (isCollapsed) {
                    content.classList.remove('collapsed');
                    if (toggle) toggle.classList.remove('collapsed');
                } else {
                    content.classList.add('collapsed');
                    if (toggle) toggle.classList.add('collapsed');
                }
            }
        });
    });
    const refToggle = sidebarElement.querySelector('#referencePanelToggle');
    if (refToggle) {
        const newRefToggle = refToggle.cloneNode(true);
        refToggle.parentNode.replaceChild(newRefToggle, refToggle);
        newRefToggle.addEventListener('click', toggleReferencePanel);
    }
}
function reattachNotesEvents(notesElement) {
    const notesInput = notesElement.querySelector('#notesInput');
    const notesDisplay = notesElement.querySelector('#notesDisplay');
    const textViewBtn = notesElement.querySelector('#textViewBtn');
    const markdownViewBtn = notesElement.querySelector('#markdownViewBtn');
    const closeBtn = notesElement.querySelector('.mobile-close-btn');
    if (closeBtn) closeBtn.remove();
    if (textViewBtn && markdownViewBtn && notesInput && notesDisplay) {
        textViewBtn.classList.remove('active');
        markdownViewBtn.classList.remove('active');
        if (state.settings.notesView === 'markdown') {
            markdownViewBtn.classList.add('active');
            notesInput.style.display = 'none';
            notesDisplay.style.display = 'block';
            notesDisplay.contentEditable = 'false';
            if (typeof marked !== 'undefined') {
                notesDisplay.innerHTML = marked.parse(state.notes || '');
            }
        } else {
            textViewBtn.classList.add('active');
            notesInput.style.display = 'block';
            notesDisplay.style.display = 'none';
            notesInput.value = state.notes || '';
        }
        const newTextBtn = textViewBtn.cloneNode(true);
        const newMarkdownBtn = markdownViewBtn.cloneNode(true);
        textViewBtn.parentNode.replaceChild(newTextBtn, textViewBtn);
        markdownViewBtn.parentNode.replaceChild(newMarkdownBtn, markdownViewBtn);
        newTextBtn.addEventListener('click', () => switchToTextView(notesInput, notesDisplay, newTextBtn, newMarkdownBtn));
        newMarkdownBtn.addEventListener('click', () => switchToMarkdownView(notesInput, notesDisplay, newTextBtn, newMarkdownBtn));
    }
    if (notesInput) {
        const newNotesInput = notesInput.cloneNode(true);
        notesInput.parentNode.replaceChild(newNotesInput, notesInput);
        newNotesInput.addEventListener('input', function(e) {
            state.notes = e.target.value;
            saveToStorage();
            const origInput = document.querySelector('.notes-section #notesInput');
            if (origInput && origInput !== this) {
                origInput.value = e.target.value;
            }
            if (state.settings.notesView === 'markdown') {
                updateAllMarkdownDisplays();
            }
        });
        newNotesInput.addEventListener('keydown', handleNotesKeydown);
    }
    notesElement.querySelectorAll('.markdown-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function() {
            const format = this.dataset.format;
            const currentInput = notesElement.querySelector('#notesInput');
            if (format && currentInput) {
                applyMarkdownToTextarea(currentInput, format);
            }
        });
    });
    notesElement.querySelectorAll('.notes-controls button').forEach(btn => {
        if (!btn.classList.contains('view-toggle-btn') && !btn.classList.contains('markdown-btn')) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => exportNotes());
        }
    });
}
function switchToTextView(notesInput, notesDisplay, textBtn, markdownBtn) {
    state.settings.notesView = 'text';
    saveToStorage();
    textBtn.classList.add('active');
    markdownBtn.classList.remove('active');
    notesInput.style.display = 'block';
    notesDisplay.style.display = 'none';
    const origTextBtn = document.querySelector('.notes-section #textViewBtn');
    const origMarkdownBtn = document.querySelector('.notes-section #markdownViewBtn');
    const origInput = document.querySelector('.notes-section #notesInput');
    const origDisplay = document.querySelector('.notes-section #notesDisplay');
    if (origTextBtn) origTextBtn.classList.add('active');
    if (origMarkdownBtn) origMarkdownBtn.classList.remove('active');
    if (origInput) origInput.style.display = 'block';
    if (origDisplay) origDisplay.style.display = 'none';
}
function switchToMarkdownView(notesInput, notesDisplay, textBtn, markdownBtn) {
    state.settings.notesView = 'markdown';
    saveToStorage();
    markdownBtn.classList.add('active');
    textBtn.classList.remove('active');
    notesInput.style.display = 'none';
    notesDisplay.style.display = 'block';
    notesDisplay.contentEditable = 'false';
    if (typeof marked !== 'undefined') {
        notesDisplay.innerHTML = marked.parse(state.notes || '');
    }
    const origTextBtn = document.querySelector('.notes-section #textViewBtn');
    const origMarkdownBtn = document.querySelector('.notes-section #markdownViewBtn');
    const origInput = document.querySelector('.notes-section #notesInput');
    const origDisplay = document.querySelector('.notes-section #notesDisplay');
    if (origTextBtn) origTextBtn.classList.remove('active');
    if (origMarkdownBtn) origMarkdownBtn.classList.add('active');
    if (origInput) origInput.style.display = 'none';
    if (origDisplay) {
        origDisplay.style.display = 'block';
        origDisplay.contentEditable = 'false';
        if (typeof marked !== 'undefined') {
            origDisplay.innerHTML = marked.parse(state.notes || '');
        }
    }
}
function handleNotesKeydown(e) {
    const ctrlCmd = e.ctrlKey || e.metaKey;
    if (ctrlCmd && !e.shiftKey) {
        const actions = {
            'b': 'bold', 'i': 'italic', 'k': 'link',
            '1': 'h1', '2': 'h2', '3': 'h3', '`': 'code'
        };
        const action = actions[e.key.toLowerCase()];
        if (action) {
            e.preventDefault();
            applyMarkdownToTextarea(this, action);
            return false;
        }
    }
    if (ctrlCmd && e.shiftKey) {
        const actions = { 'u': 'ul', 'o': 'ol', '>': 'quote' };
        const action = actions[e.key.toLowerCase()];
        if (action) {
            e.preventDefault();
            applyMarkdownToTextarea(this, action);
            return false;
        }
    }
}
function updateAllMarkdownDisplays() {
    const clonedDisplay = document.querySelector('.mobile-panel #notesDisplay');
    const origDisplay = document.querySelector('.notes-section #notesDisplay');
    if (clonedDisplay && typeof marked !== 'undefined') {
        clonedDisplay.innerHTML = marked.parse(state.notes || '');
    }
    if (origDisplay && typeof marked !== 'undefined') {
        origDisplay.innerHTML = marked.parse(state.notes || '');
    }
}
function applyMarkdownToTextarea(textarea, format) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const patterns = {
        bold: { before: '**', after: '**', placeholder: 'bold text' },
        italic: { before: '*', after: '*', placeholder: 'italic text' },
        h1: { before: '# ', after: '', placeholder: 'Heading 1' },
        h2: { before: '## ', after: '', placeholder: 'Heading 2' },
        h3: { before: '### ', after: '', placeholder: 'Heading 3' },
        ul: { before: '- ', after: '', placeholder: 'List item' },
        ol: { before: '1. ', after: '', placeholder: 'List item' },
        quote: { before: '> ', after: '', placeholder: 'Quote' },
        code: { before: '`', after: '`', placeholder: 'code' },
        link: { before: '[', after: '](url)', placeholder: 'link text' }
    };
    const config = patterns[format] || patterns.bold;
    const content = selectedText || config.placeholder;
    const replacement = config.before + content + config.after;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    textarea.value = newText;
    state.notes = newText;
    saveToStorage();
    const origInput = document.querySelector('.notes-section #notesInput');
    if (origInput && origInput !== textarea) {
        origInput.value = newText;
    }
    const newCursorPos = start + config.before.length + content.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
    if (state.settings.notesView === 'markdown') {
        updateAllMarkdownDisplays();
    }
}
function handleMobileNavResize() {
    const mobileNavTabs = document.getElementById('mobileNavTabs');
    if (window.innerWidth <= 768) {
        if (mobileNavTabs && !mobileNavTabs.classList.contains('active')) {
            mobileNavTabs.classList.add('active');
            initMobileNav();
        }
    } else {
        if (mobileNavTabs) {
            mobileNavTabs.classList.remove('active');
        }
        const referencePanel = document.getElementById('referencePanel');
        if (referencePanel) {
            referencePanel.classList.remove('mobile-panel');
        }
    }
}
async function init() {
    try {
        await loadFromStorage();
        loadFromCookies();
        const style = document.createElement('style');
        style.textContent = OFFLINE_STYLES;
        document.head.appendChild(style);
        updateOfflineStatus(!navigator.onLine);
        window.addEventListener('online', () => updateOfflineStatus(false));
        window.addEventListener('offline', () => updateOfflineStatus(true));
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
        window.addEventListener('resize', handleMobileNavResize);
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
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}