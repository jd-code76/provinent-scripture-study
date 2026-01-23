/*=====================================================================
  Provinent Scripture Study – hotkeys.js
  Keyboard shortcut management and navigation
=====================================================================*/

import { playChapterAudio, pauseChapterAudio, stopChapterAudio, isKJV } from './api.js';
import { escapeHTML } from '../main.js';
import { nextPassage, prevPassage, randomPassage, updateManualNavigation } from './navigation.js';
import { exportData } from './settings.js';
import { BOOK_ORDER, saveToStorage, state } from './state.js';
import { syncNow, isConnected } from './sync.js';
import { exportNotes, togglePanelCollapse } from './ui.js';

/* ====================================================================
   CONSTANTS
==================================================================== */

const DEFAULT_HOTKEYS = {
    toggleReferencePanel: { key: 'b', altKey: true, shiftKey: false, ctrlKey: false },
    toggleNotes: { key: 'n', altKey: true, shiftKey: false, ctrlKey: false },
    toggleSidebar: { key: 's', altKey: true, shiftKey: false, ctrlKey: false },
    prevChapter: { key: 'ArrowLeft', altKey: true, shiftKey: false, ctrlKey: false },
    nextChapter: { key: 'ArrowRight', altKey: true, shiftKey: false, ctrlKey: false },
    prevBook: { key: 'ArrowUp', altKey: true, shiftKey: true, ctrlKey: false },
    nextBook: { key: 'ArrowDown', altKey: true, shiftKey: true, ctrlKey: false },
    randomPassage: { key: 'r', altKey: true, shiftKey: false, ctrlKey: false },
    showHelp: { key: 'F1', altKey: false, shiftKey: false, ctrlKey: false },
    toggleAudio: { key: 'p', altKey: true, shiftKey: false, ctrlKey: false },
    exportData: { key: 'e', altKey: true, shiftKey: false, ctrlKey: false },
    importData: { key: 'i', altKey: true, shiftKey: false, ctrlKey: false },
    exportNotes: { key: 'm', altKey: true, shiftKey: false, ctrlKey: false },
    manualSync: { key: 'd', altKey: true, shiftKey: false, ctrlKey: false }
};

const IGNORED_KEYS = new Set([
    'Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Escape', 'Tab'
]);

const DISALLOWED_KEYS = new Set([
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
]);

/* ====================================================================
   HOTKEYS INITIALIZATION
==================================================================== */

/**
 * Initialize hotkeys with default values if not set
 */
function initializeHotkeys() {
    try {
        if (!state.hotkeys) {
            state.hotkeys = { ...DEFAULT_HOTKEYS };
        }
        if (state.hotkeysEnabled === undefined) {
            state.hotkeysEnabled = true;
        }
        saveToStorage();
    } catch (error) {
        console.error('Error initializing hotkeys:', error);
    }
}

/**
 * Set up keyboard navigation listeners
 */
export function setupKeyboardNavigation() {
    try {
        initializeHotkeys();
        document.addEventListener('keydown', handleKeyPress);
    } catch (error) {
        console.error('Error setting up keyboard navigation:', error);
    }
}

/* ====================================================================
   KEY PRESS HANDLING
==================================================================== */

/**
 * Handle key press events for navigation
 * @param {KeyboardEvent} event - Keyboard event
 */
export function handleKeyPress(event) {
    try {
        // Always allow F1 key for help, regardless of hotkey settings
        if (isF1HelpKey(event)) {
            event.preventDefault();
            showHelpModal();
            return;
        }
        
        if (!shouldProcessHotkey(event)) return;
        
        const hotkeyAction = getHotkeyAction(event);
        if (hotkeyAction) {
            event.preventDefault();
            executeHotkeyAction(hotkeyAction);
        }
    } catch (error) {
        console.error('Error handling key press:', error);
    }
}

/**
 * Check if event is F1 help key combo
 * @param {KeyboardEvent} event - Keyboard event
 * @returns {boolean} - True if F1 help key
 */
function isF1HelpKey(event) {
    return event.key === 'F1' && 
           !event.altKey && 
           !event.shiftKey && 
           !event.ctrlKey && 
           !event.metaKey;
}

/**
 * Check if hotkey should be processed
 * @param {KeyboardEvent} event - Keyboard event
 * @returns {boolean} - True if should process
 */
function shouldProcessHotkey(event) {
    if (!state.hotkeysEnabled) return false; 
    
    // Don't trigger if user is typing in inputs/textarea
    const target = event.target;
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable) {
        return false;
    }
    
    // Ignore modifier keys pressed alone
    if (IGNORED_KEYS.has(event.key)) {
        return false;
    }
    
    return true;
}

/**
 * Get hotkey action for the given event
 * @param {KeyboardEvent} event - Keyboard event
 * @returns {string|null} - Hotkey action or null
 */
function getHotkeyAction(event) {
    const hotkeys = state.hotkeys; 
    
    for (const [action, config] of Object.entries(hotkeys)) {
        if (checkHotkey(event, config)) {
            return action;
        }
    }
    
    return null;
}

/**
 * Execute hotkey action
 * @param {string} action - Hotkey action identifier
 */
async function executeHotkeyAction(action) {
    const actions = {
        toggleReferencePanel: toggleReferencePanel,
        toggleNotes: () => togglePanelCollapse('notesSection'),
        toggleSidebar: () => togglePanelCollapse('sidebar'),
        prevChapter: prevPassage,
        nextChapter: nextPassage,
        prevBook: () => navigateToAdjacentBook(-1),
        nextBook: () => navigateToAdjacentBook(1),
        randomPassage: randomPassage,
        toggleAudio: toggleAudioPlayback,
        showHelp: showHelpModal,
        exportData: exportData,
        importData: () => document.getElementById('importFile').click(),
        exportNotes: () => exportNotes(),
        manualSync: handleManualSync
    };
    
    if (actions[action]) {
        await actions[action]();
    }
}

/**
 * Handle manual sync with proper checks and feedback
 */
async function handleManualSync() {
    // Check if sync is enabled
    if (!state.settings.syncEnabled) {
        showSyncNotification('Device sync must be enabled in Settings first.', 'error');
        return;
    }
    
    // Check if any devices are connected
    if (!isConnected()) {
        showSyncNotification('No devices connected. Pair a device first.', 'error');
        return;
    }
    
    try {
        // Show syncing notification
        const notification = showSyncNotification('Syncing...', 'info');
        
        // Perform sync
        await syncNow();
        
        // Update to success
        notification.textContent = 'Sync completed successfully!';
        notification.style.background = '#4CAF50';
        setTimeout(() => notification.remove(), 2000);
        
    } catch (error) {
        console.error('Manual sync error:', error);
        showSyncNotification('Sync failed: ' + error.message, 'error', 3000);
    }
}

/**
 * Show sync notification toast
 * @param {string} message - Notification message
 * @param {string} type - Notification type ('info', 'success', 'error')
 * @param {number} duration - Auto-hide duration in ms (0 = no auto-hide)
 * @returns {HTMLElement} - Notification element
 */
function showSyncNotification(message, type = 'info', duration = 0) {
    const colors = {
        info: 'var(--accent-color)',
        success: '#4CAF50',
        error: '#f44336'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 10px;
        padding: 12px 20px;
        background: ${colors[type] || colors.info};
        color: white;
        border-radius: 5px;
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        animation: slideInRight 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Auto-remove if duration specified
    if (duration > 0) {
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
    
    return notification;
}

/**
 * Check if event matches hotkey configuration
 * @param {KeyboardEvent} event - Keyboard event
 * @param {Object} config - Hotkey configuration
 * @returns {boolean} - True if matches
 */
function checkHotkey(event, config) {
    return event.key === config.key &&
           event.altKey === config.altKey &&
           event.shiftKey === config.shiftKey &&
           event.ctrlKey === config.ctrlKey &&
           !event.metaKey; // Never match if meta key is pressed
}

/* ====================================================================
   NAVIGATION FUNCTIONS
==================================================================== */

/**
 * Navigate to adjacent book
 * @param {number} direction - Direction (-1 for previous, 1 for next)
 */
function navigateToAdjacentBook(direction) {
    try {
        const currentBookIndex = BOOK_ORDER.indexOf(state.settings.manualBook);
        if (currentBookIndex === -1) return;

        const newBookIndex = currentBookIndex + direction;
        if (newBookIndex >= 0 && newBookIndex < BOOK_ORDER.length) {
            const newBook = BOOK_ORDER[newBookIndex];
            updateManualNavigation(newBook, 1);
        }
    } catch (error) {
        console.error('Error navigating to adjacent book:', error);
    }
}

/**
 * Toggle audio playback
 */
function toggleAudioPlayback() {
    try {
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
    } catch (error) {
        console.error('Error toggling audio playback:', error);
    }
}

/* ====================================================================
   HOTKEY DISPLAY AND MANAGEMENT
==================================================================== */

/**
 * Get human-readable hotkey display string
 * @param {Object} hotkeyConfig - Hotkey configuration
 * @returns {string} - Display string
 */
export function getHotkeyDisplay(hotkeyConfig) {
    if (!hotkeyConfig || !hotkeyConfig.key) {
        return 'Not set';
    }
    
    const parts = [];
    if (hotkeyConfig.ctrlKey) parts.push('Ctrl');
    if (hotkeyConfig.altKey) parts.push('Alt');
    if (hotkeyConfig.shiftKey) parts.push('Shift');
    
    const keyDisplay = hotkeyConfig.key.replace('Arrow', '');
    parts.push(formatKeyDisplay(keyDisplay));
    
    return parts.join(' + ');
}

/**
 * Format key for display
 * @param {string} key - Key identifier
 * @returns {string} - Formatted key
 */
function formatKeyDisplay(key) {
    const displayMap = {
        ' ': 'Space',
        'Escape': 'Esc',
        'Enter': 'Enter',
        'Backspace': 'Backspace',
        'Delete': 'Del',
        'Insert': 'Ins'
    };
    
    return displayMap[key] || key.toUpperCase();
}

/**
 * Update hotkey configuration
 * @param {string} action - Hotkey action
 * @param {string} newKey - New key
 * @param {boolean} altKey - Alt key modifier
 * @param {boolean} shiftKey - Shift key modifier
 * @param {boolean} ctrlKey - Control key modifier
 */
export function updateHotkey(action, newKey, altKey, shiftKey, ctrlKey) {
    try {
        if (DISALLOWED_KEYS.has(newKey)) {
            throw new Error(`Cannot use reserved key: ${newKey}`);
        }
        
        state.hotkeys[action] = { 
            key: newKey, 
            altKey: !!altKey, 
            shiftKey: !!shiftKey, 
            ctrlKey: !!ctrlKey 
        };
        saveToStorage();
    } catch (error) {
        console.error('Error updating hotkey:', error);
        throw error;
    }
}

/**
 * Toggle hotkeys enabled state
 * @returns {boolean} - New enabled state
 */
export function toggleHotkeysEnabled() {
    try {
        state.hotkeysEnabled = !state.hotkeysEnabled;
        saveToStorage();
        return state.hotkeysEnabled;
    } catch (error) {
        console.error('Error toggling hotkeys:', error);
        return state.hotkeysEnabled;
    }
}

function toggleReferencePanel() {
    try {
        const panelToggle = document.getElementById('referencePanelToggle');
        if (panelToggle) {
            panelToggle.click();
        }
    } catch (error) {
        console.error('Error toggling reference panel:', error);
    }
}

/* ====================================================================
   HELP MODAL FUNCTIONS
==================================================================== */

/**
 * Show or hide help modal
 */
export function showHelpModal() {
    try {
        const overlay = document.getElementById('helpOverlay');
        const modal = document.getElementById('helpModal');
        
        if (!overlay || !modal) return;
        
        const isVisible = overlay.classList.contains('show');
        
        if (isVisible) {
            closeHelpModal();
        } else {
            overlay.classList.add('show');
            modal.classList.add('show');
            populateHotkeysList();
            setupHelpModalEvents();
        }
    } catch (error) {
        console.error('Error showing help modal:', error);
    }
}

/**
 * Close help modal
 */
export function closeHelpModal() {
    try {
        const overlay = document.getElementById('helpOverlay');
        const modal = document.getElementById('helpModal');
        
        if (overlay) overlay.classList.remove('show');
        if (modal) modal.classList.remove('show');
    } catch (error) {
        console.error('Error closing help modal:', error);
    }
}

/**
 * Populate hotkeys list in help modal
 */
function populateHotkeysList() {
    try {
        const hotkeysList = document.getElementById('hotkeysList');
        const enabledCheckbox = document.getElementById('hotkeysEnabled');
        
        if (!hotkeysList || !enabledCheckbox) return;
        
        enabledCheckbox.checked = state.hotkeysEnabled;
        
        const hotkeyDefinitions = [
            { action: 'toggleReferencePanel', label: 'Toggle Reference Bible' },
            { action: 'toggleNotes', label: 'Toggle Notes' },
            { action: 'toggleSidebar', label: 'Toggle Sidebar' },
            { action: 'prevChapter', label: 'Previous Chapter' },
            { action: 'nextChapter', label: 'Next Chapter' },
            { action: 'prevBook', label: 'Previous Book' },
            { action: 'nextBook', label: 'Next Book' },
            { action: 'randomPassage', label: 'Random Passage' },
            { action: 'toggleAudio', label: 'Play/Pause Audio' },
            { action: 'exportData', label: 'Export Data' },
            { action: 'importData', label: 'Import Data' },
            { action: 'exportNotes', label: 'Export Notes' },
            { action: 'manualSync', label: 'Manual Sync (if devices paired)' },
            { action: 'showHelp', label: 'Show This Help' }
        ];
        
        hotkeysList.innerHTML = hotkeyDefinitions.map(hotkey => {
            const display = getHotkeyDisplay(state.hotkeys[hotkey.action]);
            return `
                <div class="hotkey-item">
                    <div class="hotkey-label">${escapeHTML(hotkey.label)}</div>
                    <div class="hotkey-combination">
                        <span class="hotkey-keys">${escapeHTML(display)}</span>
                        <button class="btn btn-small" data-action="${escapeHTML(hotkey.action)}">
                            <i class="fas fa-edit"></i> Change
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        setupHotkeyChangeButtons();
    } catch (error) {
        console.error('Error populating hotkeys list:', error);
    }
}

/**
 * Set up help modal event listeners
 */
function setupHelpModalEvents() {
    try {
        const closeButtons = [
            document.getElementById('closeHelpBtn'),
            document.getElementById('closeHelpModalBtn'),
            document.getElementById('helpOverlay')
        ];
        
        closeButtons.forEach(btn => {
            if (btn) btn.addEventListener('click', closeHelpModal);
        });
        
        const resetBtn = document.getElementById('resetHotkeysBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetHotkeysToDefaults);
        }
        
        const enabledCheckbox = document.getElementById('hotkeysEnabled');
        if (enabledCheckbox) {
            enabledCheckbox.addEventListener('change', handleHotkeysEnabledChange);
        }
    } catch (error) {
        console.error('Error setting up help modal events:', error);
    }
}

/**
 * Handle hotkeys enabled checkbox change
 * @param {Event} event - Change event
 */
function handleHotkeysEnabledChange(event) {
    try {
        state.hotkeysEnabled = event.target.checked;
        saveToStorage();
    } catch (error) {
        console.error('Error changing hotkeys enabled state:', error);
    }
}

/**
 * Reset all hotkeys to default settings
 */
function resetHotkeysToDefaults() {
    try {
        state.hotkeys = { ...DEFAULT_HOTKEYS };
        saveToStorage();
        populateHotkeysList();
    } catch (error) {
        console.error('Error resetting hotkeys:', error);
    }
}

/**
 * Set up hotkey change buttons
 */
function setupHotkeyChangeButtons() {
    const buttons = document.querySelectorAll('.btn-small[data-action]');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            const action = this.getAttribute('data-action');
            if (action) {
                startHotkeyRecording(action, this);
            }
        });
    });
}

/* ====================================================================
   HOTKEY RECORDING
==================================================================== */

/**
 * Start recording a new hotkey
 * @param {string} action - Hotkey action
 * @param {HTMLElement} buttonElement - Button element
 */
function startHotkeyRecording(action, buttonElement) {
    try {
        const hotkeyItem = buttonElement.closest('.hotkey-item');
        const keysSpan = hotkeyItem?.querySelector('.hotkey-keys');
        
        if (!keysSpan) {
            console.error('Could not find hotkey display element');
            return;
        }
        
        // Save original state
        const originalText = keysSpan.textContent;
        const originalHotkeysEnabled = state.hotkeysEnabled;
        
        // Update UI
        keysSpan.innerHTML = '<em>Press any key combination...</em>';
        keysSpan.style.color = 'var(--accent-color)';
        
        // Disable hotkeys during recording
        state.hotkeysEnabled = false;
        
        // Create overlay for canceling
        const overlay = createRecordingOverlay();
        
        // Set up recording handlers
        const cleanup = setupRecordingHandlers(
            action, 
            keysSpan, 
            originalHotkeysEnabled, 
            originalText, 
            overlay
        );
        
        overlay.addEventListener('click', cleanup);
        
    } catch (error) {
        console.error('Error starting hotkey recording:', error);
    }
}

/**
 * Create recording overlay element
 * @returns {HTMLElement} - Overlay element
 */
function createRecordingOverlay() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        z-index: 9999;
        cursor: pointer;
    `;
    document.body.appendChild(overlay);
    return overlay;
}

/**
 * Set up recording event handlers
 * @param {string} action - Hotkey action
 * @param {HTMLElement} keysSpan - Keys display element
 * @param {boolean} originalHotkeysEnabled - Original enabled state
 * @param {string} originalText - Original text
 * @param {HTMLElement} overlay - Overlay element
 * @returns {Function} - Cleanup function
 */
function setupRecordingHandlers(action, keysSpan, originalHotkeysEnabled, originalText, overlay) {
    function handleKeyDown(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (IGNORED_KEYS.has(event.key)) {
            if (event.key === 'Escape') {
                cancelRecording();
            }
            return;
        }
        
        try {
            updateHotkey(action, event.key, event.altKey, event.shiftKey, event.ctrlKey);
            keysSpan.textContent = getHotkeyDisplay(state.hotkeys[action]);
            keysSpan.style.color = '';
            finishRecording();
        } catch (error) {
            keysSpan.textContent = error.message;
            keysSpan.style.color = 'var(--error-color)';
            setTimeout(finishRecording, 2000);
        }
    }
    
    function cancelRecording() {
        keysSpan.textContent = originalText;
        keysSpan.style.color = '';
        finishRecording();
    }
    
    function finishRecording() {
        state.hotkeysEnabled = originalHotkeysEnabled;
        cleanup();
    }
    
    function cleanup() {
        document.removeEventListener('keydown', handleKeyDown);
        if (overlay.parentNode) {
            overlay.remove();
        }
    }
    
    document.addEventListener('keydown', handleKeyDown);
    return cleanup;
}
