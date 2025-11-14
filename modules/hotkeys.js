import { 
    playChapterAudio, 
    pauseChapterAudio, 
    stopChapterAudio,
    isKJV 
} from './api.js';
import { 
    BOOK_ORDER,
    saveToStorage,
    state 
} from './state.js';
import { 
    nextPassage, 
    prevPassage, 
    randomPassage,
    updateManualNavigation 
} from './navigation.js';
const DEFAULT_HOTKEYS = {
    prevChapter: { key: 'ArrowLeft', altKey: true, shiftKey: false },
    nextChapter: { key: 'ArrowRight', altKey: true, shiftKey: false },
    prevBook: { key: 'ArrowUp', altKey: true, shiftKey: true },
    nextBook: { key: 'ArrowDown', altKey: true, shiftKey: true },
    randomPassage: { key: 'r', altKey: true, shiftKey: false },
    showHelp: { key: 'F1', altKey: false, shiftKey: false },
    toggleAudio: { key: 'p', altKey: true, shiftKey: false }
};
function initializeHotkeys() {
    if (!state.settings.hotkeys) {
        state.settings.hotkeys = { ...DEFAULT_HOTKEYS };
        state.settings.hotkeysEnabled = true;
        saveToStorage();
    }
}
export function setupKeyboardNavigation() {
    initializeHotkeys();
    document.addEventListener('keydown', handleKeyPress);
}
export function handleKeyPress(e) {
    if (e.key === 'F1' && !e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        showHelpModal();
        return;
    }
    if (!state.settings.hotkeysEnabled) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
    }
    const hotkeys = state.settings.hotkeys;
    if (checkHotkey(e, hotkeys.prevChapter)) {
        e.preventDefault();
        prevPassage();
    } 
    else if (checkHotkey(e, hotkeys.nextChapter)) {
        e.preventDefault();
        nextPassage();
    }
    else if (checkHotkey(e, hotkeys.prevBook)) {
        e.preventDefault();
        navigateToAdjacentBook(-1);
    }
    else if (checkHotkey(e, hotkeys.nextBook)) {
        e.preventDefault();
        navigateToAdjacentBook(1);
    }
    else if (checkHotkey(e, hotkeys.randomPassage)) {
        e.preventDefault();
        randomPassage();
    }
    else if (checkHotkey(e, hotkeys.toggleAudio)) {
        e.preventDefault();
        toggleAudioPlayback();
    }
    else if (checkHotkey(e, hotkeys.showHelp)) {
        e.preventDefault();
        showHelpModal();
    }
}
function checkHotkey(event, hotkeyConfig) {
    return event.key === hotkeyConfig.key &&
           event.altKey === hotkeyConfig.altKey &&
           event.shiftKey === hotkeyConfig.shiftKey &&
           event.ctrlKey === false &&
           event.metaKey === false;
}
function navigateToAdjacentBook(direction) {
    const currentBookIndex = BOOK_ORDER.indexOf(state.settings.manualBook);
    if (currentBookIndex === -1) return;
    const newBookIndex = currentBookIndex + direction;
    if (newBookIndex >= 0 && newBookIndex < BOOK_ORDER.length) {
        const newBook = BOOK_ORDER[newBookIndex];
        updateManualNavigation(newBook, 1);
    }
}
export function getHotkeyDisplay(hotkeyConfig) {
    if (!hotkeyConfig) {
        return 'Not set';
    }
    const parts = [];
    if (hotkeyConfig.altKey) parts.push('Alt');
    if (hotkeyConfig.shiftKey) parts.push('Shift');
    const keyDisplay = hotkeyConfig.key ? hotkeyConfig.key.replace('Arrow', '') : '?';
    parts.push(keyDisplay);
    return parts.join(' + ');
}
export function updateHotkey(action, newKey, altKey, shiftKey) {
    state.settings.hotkeys[action] = { key: newKey, altKey, shiftKey };
    saveToStorage();
}
export function toggleHotkeysEnabled() {
    state.settings.hotkeysEnabled = !state.settings.hotkeysEnabled;
    saveToStorage();
    return state.settings.hotkeysEnabled;
}
export function showHelpModal() {
    const overlay = document.getElementById('helpOverlay');
    const modal = document.getElementById('helpModal');
    const isVisible = overlay.classList.contains('show') && modal.classList.contains('show');
    if (isVisible) {
        overlay.classList.remove('show');
        modal.classList.remove('show');
    } else {
        overlay.classList.add('show');
        modal.classList.add('show');
        populateHotkeysList();
        setupHelpModalEvents();
    }
}
export function closeHelpModal() {
    const overlay = document.getElementById('helpOverlay');
    const modal = document.getElementById('helpModal');
    overlay.classList.remove('show');
    modal.classList.remove('show');
}
function populateHotkeysList() {
    const hotkeysList = document.getElementById('hotkeysList');
    const enabledCheckbox = document.getElementById('hotkeysEnabled');
    enabledCheckbox.checked = state.settings.hotkeysEnabled;
    const hotkeyDefinitions = [
        { action: 'prevChapter', label: 'Previous Chapter' },
        { action: 'nextChapter', label: 'Next Chapter' },
        { action: 'prevBook', label: 'Previous Book' },
        { action: 'nextBook', label: 'Next Book' },
        { action: 'randomPassage', label: 'Random Passage' },
        { action: 'toggleAudio', label: 'Play/Pause Audio' },
        { action: 'showHelp', label: 'Show This Help' }
    ];
    hotkeysList.innerHTML = hotkeyDefinitions.map(hotkey => `
        <div class="hotkey-item">
            <div class="hotkey-label">${hotkey.label}</div>
            <div class="hotkey-combination">
                <span class="hotkey-keys">${getHotkeyDisplay(state.settings.hotkeys[hotkey.action])}</span>
                <button class="btn btn-small" data-action="${hotkey.action}">
                    <i class="fas fa-edit"></i> Change
                </button>
            </div>
        </div>
    `).join('');
    hotkeysList.querySelectorAll('.btn-small[data-action]').forEach(button => {
        button.addEventListener('click', function() {
            const action = this.getAttribute('data-action');
            startHotkeyRecording(action, this);
        });
    });
}
function toggleAudioPlayback() {
    if (!state.audioPlayer) {
        const translation = state.settings.bibleTranslation;
        if (isKJV(translation)) {
            playChapterAudio();
        } else {
            const narrator = state.settings.audioNarrator || 'gilbert';
            playChapterAudio(narrator);
        }
    } else if (state.audioPlayer.isPlaying) {
        pauseChapterAudio();
    } else if (state.audioPlayer.isPaused) {
        playChapterAudio();
    } else {
        stopChapterAudio();
        setTimeout(() => {
            const translation = state.settings.bibleTranslation;
            if (isKJV(translation)) {
                playChapterAudio();
            } else {
                const narrator = state.settings.audioNarrator || 'gilbert';
                playChapterAudio(narrator);
            }
        }, 100);
    }
}
function setupHelpModalEvents() {
    document.getElementById('closeHelpBtn').addEventListener('click', closeHelpModal);
    document.getElementById('closeHelpModalBtn').addEventListener('click', closeHelpModal);
    document.getElementById('helpOverlay').addEventListener('click', closeHelpModal);
    document.getElementById('resetHotkeysBtn').addEventListener('click', resetHotkeysToDefaults);
    document.getElementById('hotkeysEnabled').addEventListener('change', (e) => {
        state.settings.hotkeysEnabled = e.target.checked;
        saveToStorage();
    });
}
function resetHotkeysToDefaults() {
    state.settings.hotkeys = { ...DEFAULT_HOTKEYS };
    saveToStorage();
    populateHotkeysList();
}
function startHotkeyRecording(action, buttonElement) {
    const hotkeyItem = buttonElement.closest('.hotkey-item');
    if (!hotkeyItem) {
        console.error('Could not find hotkey item element');
        return;
    }
    const keysSpan = hotkeyItem.querySelector('.hotkey-keys');
    if (!keysSpan) {
        console.error('Could not find hotkey keys element');
        return;
    }
    keysSpan.innerHTML = '<em>Press any key combination...</em>';
    keysSpan.style.color = 'var(--accent-color)';
    const originalHotkeysEnabled = state.settings.hotkeysEnabled;
    state.settings.hotkeysEnabled = false;
    function recordKeypress(e) {
        e.preventDefault();
        e.stopPropagation();
        if (['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Escape'].includes(e.key)) {
            if (e.key === 'Escape') {
                cancelRecording();
            }
            return;
        }
        updateHotkey(action, e.key, e.altKey, e.shiftKey);
        keysSpan.textContent = getHotkeyDisplay(state.settings.hotkeys[action]);
        keysSpan.style.color = '';
        state.settings.hotkeysEnabled = originalHotkeysEnabled;
        cleanup();
        document.removeEventListener('keydown', recordKeypress);
    }
    function cancelRecording() {
        keysSpan.textContent = getHotkeyDisplay(state.settings.hotkeys[action]);
        keysSpan.style.color = '';
        state.settings.hotkeysEnabled = originalHotkeysEnabled;
        cleanup();
        document.removeEventListener('keydown', recordKeypress);
    }
    function cleanup() {
        if (cancelOverlay && cancelOverlay.parentNode) {
            cancelOverlay.remove();
        }
    }
    document.addEventListener('keydown', recordKeypress, { once: false });
    const cancelOverlay = document.createElement('div');
    cancelOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        z-index: 9999;
        cursor: pointer;
    `;
    cancelOverlay.addEventListener('click', cancelRecording);
    document.body.appendChild(cancelOverlay);
}