import {
    isKJV,
    playChapterAudio,
    pauseChapterAudio,
    resumeChapterAudio,
    stopChapterAudio
} from './modules/api.js';
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
import { 
    scrollToVerse, 
    setupFootnoteHandlers 
} from './modules/passage.js'
import {
    clearCache,
    closeSettings,
    deleteAllData,
    exportData,
    importData,
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
    document.getElementById('prevPassageBtn')
            .addEventListener('click', prevPassage);
    document.getElementById('nextPassageBtn')
            .addEventListener('click', nextPassage);
    document.getElementById('randomPassageBtn')
            .addEventListener('click', randomPassage);
    document.addEventListener('DOMContentLoaded', function() {
        const playBtn = document.querySelector('.play-audio-btn');
        const pauseBtn = document.querySelector('.pause-audio-btn');
        const stopBtn = document.querySelector('.stop-audio-btn');
        const narratorSelect = document.querySelector('.narrator-select');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                const translation = state.settings.bibleTranslation;
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
    document.getElementById('referencePanelToggle')
            .addEventListener('click', toggleReferencePanel);
    document.querySelectorAll('.sidebar-section-header')
            .forEach(h => h.addEventListener('click', () => {
                const sec = h.dataset.section;
                toggleSection(sec);
            }));
    document.addEventListener('DOMContentLoaded', makeToggleSticky);
    document.querySelectorAll('.collapse-toggle')
            .forEach(btn => btn.addEventListener('click', function () {
                const panel = this.closest('[id]');
                if (panel) togglePanelCollapse(panel.id);
            }));
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
    document.addEventListener('contentLoaded', () => {
        setTimeout(setupFootnoteHandlers, 50);
    });
    document.getElementById('clearCacheBtn')
        .addEventListener('click', clearCache);
    document.getElementById('deleteAllDataBtn')
        .addEventListener('click', deleteAllData);
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
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchCancel);
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
function updateHeaderTitle() {
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
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
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
        if (!colorPicker.classList.contains('active')) {
            if (touchDuration < 300 && touchDuration > 50) {
                showStrongsReference(verse);
            }
        }
    }
    isScrolling = false;
}
function showColorPicker(ev, verseEl) {
    const picker = document.getElementById('colorPicker');
    state.currentVerse = verseEl;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const pickerWidth = 200;
    const pickerHeight = 50;
    const clientX = ev.clientX || (ev.touches && ev.touches[0].clientX) || 0;
    const clientY = ev.clientY || (ev.touches && ev.touches[0].clientY) || 0;
    let adjustedX = clientX;
    let adjustedY = clientY;
    if (clientX + pickerWidth > viewportWidth) {
        adjustedX = viewportWidth - pickerWidth - 10;
    }
    if (clientY + pickerHeight > viewportHeight) {
        adjustedY = viewportHeight - pickerHeight - 10;
    }
    adjustedX = Math.max(10, adjustedX);
    adjustedY = Math.max(10, adjustedY);
    picker.style.left = adjustedX + 'px';
    picker.style.top = adjustedY + 'px';
    picker.classList.add('active');
    ev.preventDefault();
    ev.stopPropagation();
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
    const filterButtons = document.querySelectorAll('.highlight-filter-btn');
    filterButtons.forEach(btn => btn.classList.remove('active'));
    const allButton = document.querySelector('.highlight-filter-btn[data-color="all"]');
    if (allButton) {
        allButton.classList.add('active');
    }
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
    const sortableReferences = Object.keys(highlights).map(reference => {
        const match = reference.match(/^(\d*\s*\w+)\s+(\d+):(\d+)$/);
        if (!match) return null;
        let bookName = match[1].trim();
        const chapter = parseInt(match[2]);
        const verse = parseInt(match[3]);
        const color = highlights[reference];
        const bookParts = bookName.split(' ');
        let baseBookName = bookName;
        let bookNumber = '';
        if (bookParts.length > 1 && /^\d+$/.test(bookParts[0])) {
            bookNumber = bookParts[0];
            baseBookName = bookParts.slice(1).join(' ');
        }
        const bookIndex = BOOK_ORDER.findIndex(book => {
            const orderParts = book.split(' ');
            let orderBaseName = book;
            let orderNumber = '';
            if (orderParts.length > 1 && /^\d+$/.test(orderParts[0])) {
                orderNumber = orderParts[0];
                orderBaseName = orderParts.slice(1).join(' ');
            }
            return orderBaseName.toLowerCase() === baseBookName.toLowerCase() && 
                   orderNumber === bookNumber;
        });
        return {
            reference,
            bookName,
            baseBookName,
            bookNumber,
            bookIndex,
            chapter,
            verse,
            color
        };
    }).filter(ref => ref !== null && ref.bookIndex !== -1);
    sortableReferences.sort((a, b) => {
        if (a.bookIndex !== b.bookIndex) {
            return a.bookIndex - b.bookIndex;
        }
        if (a.chapter !== b.chapter) {
            return a.chapter - b.chapter;
        }
        return a.verse - b.verse;
    });
    sortableReferences.forEach(ref => {
        if (filterColor !== 'all' && ref.color !== filterColor) {
            return;
        }
        const verseText = getVerseTextFromStorage(ref.reference) || 'Verse text not available';
        html += `
            <div class="highlight-item ${ref.color}" data-reference="${ref.reference}" data-color="${ref.color}">
                <div class="highlight-ref">${ref.reference}</div>
                <div class="highlight-text">${verseText}</div>
            </div>
        `;
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
    state.settings.manualBook = book;
    state.settings.manualChapter = parseInt(chapter);
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
    const style = document.createElement('style');
    style.textContent = offlineStyles;
    document.head.appendChild(style);
    updateOfflineStatus(!navigator.onLine);
    window.addEventListener('online', () => updateOfflineStatus(false));
    window.addEventListener('offline', () => updateOfflineStatus(true));
    initBookChapterControls();
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
    updateDateTime();
    initResizeHandles();
    switchNotesView(state.settings.notesView || 'text');
    updateBibleGatewayVersion();
    setupEventListeners();
    setInterval(updateDateTime, 1_000);
    console.log('App initialized successfully');
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}