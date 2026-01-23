/*=====================================================================
  Provinent Scripture Study – settings.js
  User settings and data management
=====================================================================*/

import { stopChapterAudio } from './api.js';
import { getVerseTextFromStorage } from './highlights.js';
import { applyColorTheme, applyTheme, getFormattedDateForFilename, getFormattedDateForDisplay, handleError, handleNarratorChange, showLoading } from '../main.js';
import { populateChapterDropdown, updateChapterDropdownVisibility } from './navigation.js';
import { APP_VERSION, saveToCookies, saveToStorage, state, updateBibleGatewayVersion, updateURL } from './state.js';
import { connectToPeer, disconnect, getActiveConnections, getConnectedDevices, getLastSyncTime, getMyPeerId, isConnected, resetReconnectAttempts, removeDevice, startPairing, syncManager, syncNow, updateDeviceName } from './sync.js';
import { restorePanelStates, restoreSidebarState, switchNotesView, updateMarkdownPreview, updateScriptureFontSize, updateNotesFontSize } from './ui.js';

/* ====================================================================
   DATA EXPORT/IMPORT
==================================================================== */
export function exportData() {
    try {
        const fileDate = getFormattedDateForFilename();
        const exportDate = getFormattedDateForDisplay();
        const highlightsWithText = Object.entries(state.highlights).reduce(
            (acc, [reference, color]) => {
                const verseText = getVerseTextFromStorage(reference) || '';
                acc[reference] = { color: color, text: verseText };
                return acc;
            },
            {}
        );
        
        const payload = {
            version: '2.0',
            exportDate: exportDate,
            highlights: highlightsWithText,
            notes: state.notes,
            settings: { ...state.settings }
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `provinent-scripture-study-backup-${fileDate}.json`;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Failed to export data. See console for details.');
    }
}

export function importData(event) {
    try {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = handleFileRead;
        reader.onerror = handleFileError;
        reader.readAsText(file);
        event.target.value = '';
    } catch (error) {
        console.error('Error importing data:', error);
        alert('Failed to import data. See console for details.');
    }
}

function handleFileRead(event) {
    try {
        const incoming = JSON.parse(event.target.result);
        validateImportData(incoming);
        if (!confirmImport()) return;
        applyImportedData(incoming);
        saveImportedData();
        updateUIAfterImport(incoming);
        reloadApplication();
    } catch (error) {
        console.error('Error processing import:', error);
        alert('Invalid backup file format.');
    }
}

function handleFileError() {
    alert('Error reading file. Please try again.');
}

function validateImportData(data) {
    if (!data.settings || typeof data.settings !== 'object') {
        throw new Error('Invalid backup format: missing settings');
    }
}

function confirmImport() {
    return confirm('Import will overwrite all current data. Continue?');
}

function applyImportedData(incoming) {
    const newSettings = { ...state.settings, ...incoming.settings };
    Object.assign(state.settings, newSettings);
    
    const incomingHighlights = incoming.highlights || {};
    const colorMap = {};
    const verseTextMap = {};
    const importTimestamp = Date.now(); // All imported data gets same timestamp

    Object.entries(incomingHighlights).forEach(([reference, data]) => {
        if (typeof data === 'string') {
            colorMap[reference] = data;
        } else if (data && typeof data === 'object') {
            colorMap[reference] = data.color;
            verseTextMap[reference] = data.text;
        }
        
        // Sync metadata for imported highlights
        if (!state._syncMeta.highlights) state._syncMeta.highlights = {};
        state._syncMeta.highlights[reference] = {
            ts: importTimestamp
        };
    });

    Object.assign(state.highlights, colorMap);

    try {
        const cachedRaw = localStorage.getItem('cachedVerses');
        const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
        const merged = { ...cached, ...verseTextMap };
        localStorage.setItem('cachedVerses', JSON.stringify(merged));
    } catch (e) {
        console.error('Failed to merge cached verses on import:', e);
    }

    state.notes = incoming.notes || '';

    // Sync metadata for imported notes
    if (!state._syncMeta.notes) state._syncMeta.notes = {};
    state._syncMeta.notes.ts = importTimestamp;

    if (incoming.connectedDevices && Array.isArray(incoming.connectedDevices)) {
        state.settings.connectedDevices = incoming.connectedDevices;
    }
}

function saveImportedData() {
    saveToStorage();
    updateURL(state.settings.bibleTranslation, state.settings.manualBook, state.settings.manualChapter, 'push');
}

function updateUIAfterImport(incoming) {
    applyTheme();
    applyColorTheme();
    restoreSidebarState();
    restorePanelStates();
    switchNotesView(state.settings.notesView || 'text');
    
    const notesInput = document.getElementById('notesInput');
    if (notesInput) notesInput.value = state.notes;
    
    updateMarkdownPreview();
    updateDropdownsFromSettings(incoming.settings);
}

function updateDropdownsFromSettings(settings) {
    const bookSelect = document.getElementById('bookSelect');
    const chapterSelect = document.getElementById('chapterSelect');
    
    if (bookSelect && settings.manualBook) {
        bookSelect.value = settings.manualBook;
        populateChapterDropdown(settings.manualBook);
    }
    
    if (chapterSelect && settings.manualChapter) {
        chapterSelect.value = settings.manualChapter;
    }
    
    updateChapterDropdownVisibility(settings.manualBook);
}

function reloadApplication() {
    alert('Backup imported successfully! Page will refresh to apply all changes.');
    setTimeout(() => window.location.reload(), 1000);
}

/* ====================================================================
   SETTINGS MODAL
==================================================================== */
export function openSettings() {
    try {
        populateSettingsForm();
        showSettingsModal();
    } catch (error) {
        console.error('Error opening settings:', error);
    }
}

function populateSettingsForm() {
    const translationSelect = document.getElementById('bibleTranslationSetting');
    const audioToggle = document.getElementById('audioControlsToggle');
    const autoplayToggle = document.getElementById('autoplayAudioToggle');
    const versionElement = document.getElementById('appVersion');
    const scriptureFontSizeSlider = document.getElementById('scriptureFontSizeSlider');
    const scriptureFontSizeValue = document.getElementById('scriptureFontSizeValue');
    const notesFontSizeSlider = document.getElementById('notesFontSizeSlider');
    const notesFontSizeValue = document.getElementById('notesFontSizeValue');
    const themeToggle = document.getElementById('themeToggleSetting');
    const autoSyncToggle = document.getElementById('autoSyncToggle');

    // Sync is always visible - no toggle needed
    const syncControls = document.getElementById('syncControls');
    if (syncControls) {
        syncControls.style.display = 'block';
    }

    if (autoSyncToggle) {
        autoSyncToggle.checked = !!state.settings.autoSync;
        autoSyncToggle.addEventListener('change', () => {
            state.settings.autoSync = autoSyncToggle.checked;
            saveToStorage();
        });
    }

    if (translationSelect) translationSelect.value = state.settings.bibleTranslation;

    if (audioToggle) {
        audioToggle.checked = state.settings.audioControlsVisible;
        audioToggle.addEventListener('change', () => {
            state.settings.audioControlsVisible = audioToggle.checked;
            saveToStorage();
            updateAudioControlsVisibility();
        });
    }

    if (autoplayToggle) {
        autoplayToggle.checked = !!state.settings.autoplayAudio;
        autoplayToggle.addEventListener('change', () => {
            state.settings.autoplayAudio = autoplayToggle.checked;
            saveToStorage();
        });
    }

    if (scriptureFontSizeSlider) {
        scriptureFontSizeSlider.value = state.settings.scriptureFontSize || 16;
        scriptureFontSizeSlider.addEventListener('input', () => {
            const val = scriptureFontSizeSlider.value;
            if (scriptureFontSizeValue) scriptureFontSizeValue.textContent = `${val}px`;
        });
    }

    if (scriptureFontSizeValue) {
        scriptureFontSizeValue.textContent = `${state.settings.scriptureFontSize || 16}px`;
    }
    
    if (notesFontSizeSlider) {
        notesFontSizeSlider.value = state.settings.notesFontSize || 16;
        notesFontSizeSlider.addEventListener('input', () => {
            const val = notesFontSizeSlider.value;
            if (notesFontSizeValue) notesFontSizeValue.textContent = `${val}px`;
        });
    }

    if (notesFontSizeValue) {
        notesFontSizeValue.textContent = `${state.settings.notesFontSize || 16}px`;
    }
    
    if (themeToggle) {
        themeToggle.checked = state.settings.theme === 'dark';
        themeToggle.addEventListener('change', () => {
            state.settings.theme = themeToggle.checked ? 'dark' : 'light';
            saveToStorage();
            applyTheme();
        });
    }

    if (versionElement) versionElement.textContent = APP_VERSION;

    updateColorThemeSelection();
}

function updateColorThemeSelection() {
    const themeOptions = document.querySelectorAll('.color-theme-option');
    themeOptions.forEach(option => {
        option.classList.toggle('selected', option.dataset.theme === state.settings.colorTheme);
    });
}

function showSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const overlay = document.getElementById('settingsOverlay');
    if (modal) modal.classList.add('active');
    if (overlay) overlay.classList.add('active');
    attachSyncUiHandlers();
    
    // Reset scrollbar to top after render and paint
    requestAnimationFrame(() => {
        if (modal) {
            modal.scrollTop = 0;
        }
    });
}

export function closeSettings() {
    const modal = document.getElementById('settingsModal');
    const overlay = document.getElementById('settingsOverlay');
    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

export async function saveSettings() {
    try {
        showLoading(true);
        const newSettings = getSettingsFromForm();
        validateSettings(newSettings);
        await applyNewSettings(newSettings);
        saveSettingsToStorage();
        updateUIAfterSettingsChange();
        closeSettings();
        alert('Settings saved. The page will now refresh to apply changes.');
        setTimeout(() => window.location.reload(), 500);
    } catch (error) {
        handleError(error, 'saveSettings');
        alert('Error saving settings: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function getSettingsFromForm() {
    const translationSelect = document.getElementById('bibleTranslationSetting');
    const audioToggle = document.getElementById('audioControlsToggle');
    const autoplayToggle = document.getElementById('autoplayAudioToggle');
    const selectedTheme = document.querySelector('.color-theme-option.selected');
    const narratorSelect = document.getElementById('narratorSelect');
    const scriptureFontSizeSlider = document.getElementById('scriptureFontSizeSlider');
    const notesFontSizeSlider = document.getElementById('notesFontSizeSlider');
    const themeToggle = document.getElementById('themeToggleSetting');
    const autoSync = document.getElementById('autoSyncToggle')?.checked ?? false;
    
    return {
        translation: translationSelect?.value || state.settings.bibleTranslation,
        audioControlsVisible: audioToggle?.checked ?? state.settings.audioControlsVisible,
        colorTheme: selectedTheme?.dataset.theme || state.settings.colorTheme,
        narrator: narratorSelect?.value || state.settings.audioNarrator,
        scriptureFontSize: scriptureFontSizeSlider ? parseInt(scriptureFontSizeSlider.value, 10) : state.settings.scriptureFontSize,
        notesFontSize: notesFontSizeSlider ? parseInt(notesFontSizeSlider.value, 10) : state.settings.notesFontSize,
        theme: themeToggle?.checked ? 'dark' : 'light',
        autoplayAudio: autoplayToggle?.checked ?? state.settings.autoplayAudio,
        autoSync
    };
}

function validateSettings(settings) {
    if (!settings.translation) throw new Error('Invalid translation selection');
}

async function applyNewSettings(newSettings) {
    if (typeof stopChapterAudio === 'function') stopChapterAudio();
    
    const updatedSettings = {
        ...state.settings,
        bibleTranslation: newSettings.translation,
        theme: newSettings.theme,
        scriptureFontSize: newSettings.scriptureFontSize ?? state.settings.scriptureFontSize,
        notesFontSize: newSettings.notesFontSize ?? state.settings.notesFontSize,
        audioControlsVisible: newSettings.audioControlsVisible,
        autoplayAudio: newSettings.autoplayAudio,
        audioNarrator: newSettings.narrator || state.settings.audioNarrator,
        colorTheme: newSettings.colorTheme,
        autoSync: newSettings.autoSync
    };
    
    Object.assign(state.settings, updatedSettings);
    updateURL(newSettings.translation, state.settings.manualBook, state.settings.manualChapter, 'push');
    updateAudioControlsVisibility();
    updateBibleGatewayVersion();
    applyTheme();
    handleNarratorChange(state.settings.audioNarrator);
}

function saveSettingsToStorage() {
    saveToStorage();
    saveToCookies();
}

function updateUIAfterSettingsChange() {
    applyColorTheme();
    const referenceTranslationSelect = document.getElementById('referenceTranslation');
    if (referenceTranslationSelect) {
        referenceTranslationSelect.value = state.settings.referenceVersion;
    }
    if (typeof updateScriptureFontSize === 'function') {
        updateScriptureFontSize(state.settings.scriptureFontSize);
    }
    if (typeof updateNotesFontSize === 'function') {
        updateNotesFontSize(state.settings.notesFontSize);
    }
}

/* ====================================================================
   SYNC UI HANDLERS
==================================================================== */

function renderConnectedDevices() {
    const container = document.getElementById('connectedDevicesList');
    if (!container) return;
    
    const devices = getConnectedDevices();
    
    if (devices.length === 0) {
        container.innerHTML = '<p class="no-devices-message">No devices paired</p>';
        return;
    }
    
    container.innerHTML = devices.map(device => {
        const displayName = device.customName || device.name;
        const isActive = getActiveConnections().includes(device.peerId);
        const retryCount = syncManager.reconnectAttempts?.get(device.peerId) || 0;
        const maxRetries = syncManager.MAX_RECONNECT_ATTEMPTS || 3;
        const hasGivenUp = retryCount >= maxRetries && !isActive;
        const lastConnected = device.lastConnectedAt || device.connectedAt;
        const timeAgo = Math.floor((Date.now() - lastConnected) / 1000);
        const lastConnectedStr = timeAgo < 60 ? `${timeAgo}s ago` : 
                                timeAgo < 3600 ? `${Math.floor(timeAgo / 60)}m ago` :
                                timeAgo < 86400 ? `${Math.floor(timeAgo / 3600)}h ago` :
                                `${Math.floor(timeAgo / 86400)}d ago`;

        return `
            <div class="device-item ${isActive ? 'device-active' : ''} ${hasGivenUp ? 'device-failed' : ''}">
                <div class="device-info">
                    <input type="text" 
                        class="device-name-input" 
                        data-device-id="${device.peerId}"
                        value="${displayName}"
                        placeholder="Device name"
                        aria-label="Device name" />
                    <small class="device-last-sync">
                        Last synced: ${lastConnectedStr}
                        ${isActive ? '<span class="status-badge">Active</span>' : ''}
                        ${hasGivenUp ? '<span class="status-badge status-failed">Connection Failed</span>' : ''}
                        ${retryCount > 0 && !isActive && !hasGivenUp ? `<span class="status-badge status-retrying">Retrying (${retryCount}/${maxRetries})</span>` : ''}
                    </small>
                </div>
                <div class="device-actions">
                    ${hasGivenUp ? `
                        <button class="btn btn-secondary btn-sm retry-device-btn" 
                                data-device-id="${device.peerId}"
                                title="Retry connection"
                                aria-label="Retry connection">
                            <i class="fas fa-rotate"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-danger btn-sm remove-device-btn" 
                            data-device-id="${device.peerId}"
                            title="Remove device"
                            aria-label="Remove device">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.remove-device-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const deviceId = btn.dataset.deviceId;
            if (confirm('Remove this device? You will need to re-pair to sync again.')) {
                removeDevice(deviceId);
                renderConnectedDevices();
                renderSyncStatus();
            }
        });
    });

    container.querySelectorAll('.retry-device-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const deviceId = btn.dataset.deviceId;
            resetReconnectAttempts(deviceId);
            
            // Update UI
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            setTimeout(() => {
                renderConnectedDevices();
                renderSyncStatus();
            }, 2000);
        });
    });

    container.querySelectorAll('.device-name-input').forEach(input => {
        let saveTimeout;
        input.addEventListener('input', (e) => {
            const deviceId = e.target.dataset.deviceId;
            const newName = e.target.value.trim();
            
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                updateDeviceName(deviceId, newName || null);
            }, 1000);
        });
    });
}

function renderSyncStatus() {
    const statusContainer = document.getElementById('syncStatus');
    if (!statusContainer) return;
    
    const activeCount = getActiveConnections().length;
    const totalDevices = getConnectedDevices().length;
    const lastSync = getLastSyncTime();
    const connected = activeCount > 0;
    
    let statusHTML = '<div class="sync-status-container">';
    
    if (connected) {
        statusHTML += `
            <div class="sync-status-connected">
                <i class="fas fa-check-circle"></i> 
                Connected (${activeCount}/${totalDevices} ${activeCount === 1 ? 'device' : 'devices'})
            </div>
        `;
        
        if (lastSync) {
            const timeAgo = Math.floor((Date.now() - lastSync) / 1000);
            const timeStr = timeAgo < 60 ? `${timeAgo}s ago` : 
                           timeAgo < 3600 ? `${Math.floor(timeAgo / 60)}m ago` :
                           `${Math.floor(timeAgo / 3600)}h ago`;
            statusHTML += `<div class="sync-status-time">Last synced: ${timeStr}</div>`;
        }
        
        statusHTML += `
            <button id="syncNowBtn" class="btn btn-primary" style="width: 100%; margin-top: 12px;">
                <i class="fas fa-sync"></i> Sync Now
            </button>
            <button id="disconnectBtn" class="btn btn-secondary" style="width: 100%; margin-top: 8px;">
                <i class="fas fa-unlink"></i> Disconnect All
            </button>
        `;
    } else if (totalDevices > 0) {
        statusHTML += `
            <div class="sync-status-disconnected">
                <i class="fas fa-spinner fa-pulse"></i> Auto-reconnecting...
            </div>
            <div class="sync-status-time">Attempting to connect to paired devices</div>
        `;
    } else {
        statusHTML += `
            <div class="sync-status-disconnected">
                <i class="fas fa-times-circle"></i> Not connected
            </div>
            <div class="sync-status-time">Pair a device below to start syncing</div>
        `;
    }
    
    statusHTML += '</div>';
    statusContainer.innerHTML = statusHTML;
    
    document.getElementById('syncNowBtn')?.addEventListener('click', async () => {
        try {
            const btn = document.getElementById('syncNowBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
            await syncNow();
            alert(`Successfully synced with ${activeCount} device(s)!`);
            renderSyncStatus();
        } catch (e) {
            alert('Sync failed: ' + e.message);
        } finally {
            const btn = document.getElementById('syncNowBtn');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sync"></i> Sync Now';
            }
        }
    });

    document.getElementById('disconnectBtn')?.addEventListener('click', () => {
        if (confirm('Disconnect from all devices? Auto-reconnect will resume.')) {
            disconnect();
            renderSyncStatus();
        }
    });
}

function attachSyncUiHandlers() {
    renderConnectedDevices();
    renderSyncStatus();
    
    document.addEventListener('sync:peerConnected', (ev) => {
        console.log('[Settings] Peer connected:', ev.detail.peerId);
        renderConnectedDevices();
        renderSyncStatus();
    });
    
    document.addEventListener('sync:peerDisconnected', () => {
        renderSyncStatus();
    });
    
    document.addEventListener('sync:deviceAdded', renderConnectedDevices);
    
    document.addEventListener('sync:deviceRemoved', () => {
        renderConnectedDevices();
        renderSyncStatus();
    });
    
    document.addEventListener('sync:complete', () => {
        renderSyncStatus();
    });

    const showCodeBtn = document.getElementById('showPairingCodeBtn');
    const codeContainer = document.getElementById('pairingCodeContainer');
    const codeDisplay = document.getElementById('pairingCodeDisplay');
    const copyCodeBtn = document.getElementById('copyPairingCodeBtn');

    if (showCodeBtn) {
        showCodeBtn.addEventListener('click', async () => {
            showCodeBtn.disabled = true;
            showCodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            
            try {
                // Force new ID generation
                syncManager._myPeerId = null;
                state.settings.myPeerId = null;
                
                const result = await startPairing();
                const code = result.code || getMyPeerId();
                
                if (codeDisplay) codeDisplay.textContent = code;
                if (codeContainer) codeContainer.style.display = 'block';
                
                showCodeBtn.innerHTML = '<i class="fas fa-sync"></i> Generate New Code';
                showCodeBtn.disabled = false;
            } catch (e) {
                alert('Failed to generate pairing code: ' + e.message);
                showCodeBtn.innerHTML = '<i class="fas fa-link"></i> Show My Pairing Code';
                showCodeBtn.disabled = false;
            }
        });
    }

    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', () => {
            const code = codeDisplay?.textContent;
            if (code) {
                navigator.clipboard.writeText(code).then(() => {
                    copyCodeBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => {
                        copyCodeBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Code';
                    }, 2000);
                });
            }
        });
    }

    const enterCodeInput = document.getElementById('enterPairingCodeInput');
    const connectCodeBtn = document.getElementById('connectPairingCodeBtn');

    if (connectCodeBtn) {
        connectCodeBtn.addEventListener('click', async () => {
            const code = enterCodeInput?.value.trim().toUpperCase();
            
            if (!code || code.length < 6) {
                alert('Please enter a valid pairing code');
                return;
            }
            
            connectCodeBtn.disabled = true;
            connectCodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
            
            // Ensure peer is ready
            if (!syncManager.peer || syncManager.peer.destroyed) {
                await syncManager.initPeer();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            const success = connectToPeer(code);
            
            if (success) {
                enterCodeInput.value = '';
                setTimeout(() => {
                    connectCodeBtn.disabled = false;
                    connectCodeBtn.innerHTML = '<i class="fas fa-link"></i> Connect';
                    renderConnectedDevices();
                    renderSyncStatus();
                }, 2000);
            } else {
                alert('Failed to initiate connection. Peer may still be initializing—try again in 5s.');
                connectCodeBtn.disabled = false;
                connectCodeBtn.innerHTML = '<i class="fas fa-link"></i> Connect';
            }
        });
    }

    if (enterCodeInput) {
        enterCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                connectCodeBtn?.click();
            }
        });
    }
}

/* ====================================================================
   DATA MANAGEMENT
==================================================================== */
export async function clearCache() {
    if (!confirm('Clear all cached Bible data?')) return;
    try {
        showLoading(true);
        if (typeof stopChapterAudio === 'function') stopChapterAudio();
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        localStorage.removeItem('cachedVerses');
        alert('Cache cleared. Refreshing...');
        setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
        handleError(error, 'clearCache');
        alert('Error clearing cache: ' + error.message);
    } finally {
        showLoading(false);
    }
}

export async function deleteAllData() {
    const wantsBackup = confirm('WARNING: Delete ALL data? Backup first?');
    if (wantsBackup) {
        exportData();
        if (!confirm('Backup created. Proceed with deletion?')) return;
    }
    try {
        showLoading(true);
        if (typeof stopChapterAudio === 'function') stopChapterAudio();
        
        // Mark all highlights as deleted and sync BEFORE wiping local data
        const now = Date.now();
        Object.keys(state.highlights).forEach(ref => {
            if (!state._syncMeta.highlights) state._syncMeta.highlights = {};
            state._syncMeta.highlights[ref] = {
                deleted: true,
                ts: now
            };
        });
        state.highlights = {};
        
        // Clear notes with timestamp
        state.notes = '';
        if (!state._syncMeta.notes) state._syncMeta.notes = {};
        state._syncMeta.notes.ts = now;
        
        // Send final sync to propagate deletions
        if (isConnected()) {
            try {
                await syncNow();
                console.log('[Settings] Sent deletion sync to peers');
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for sync
            } catch (e) {
                console.warn('[Settings] Failed to sync deletions:', e);
            }
        }
        
        // Now wipe local data
        localStorage.removeItem('bibleStudyState');
        localStorage.removeItem('cachedVerses');
        state.settings.connectedDevices = [];
        disconnect();
        document.cookie = 'bibleStudySettings=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        saveToStorage();
        alert('All data deleted and synced. Resetting...');
        setTimeout(() => window.location.replace('/?p=bsb/gen/1'), 1000);
    } catch (error) {
        handleError(error, 'deleteAllData');
        alert('Error deleting data.');
    } finally {
        showLoading(false);
    }
}

/* ====================================================================
   AUDIO CONTROLS
==================================================================== */
export function updateAudioControlsVisibility() {
    const audioControls = document.getElementById('audioControls');
    const audioDivider = document.getElementById('audio-tb-divider');
    if (!audioControls || !audioDivider) return;
    const isVisible = Boolean(state.settings.audioControlsVisible);
    audioControls.classList.toggle('audio-controls-hidden', !isVisible);
    audioDivider.style.display = isVisible ? 'inline' : 'none';
    const audioCheckbox = document.getElementById('audioControlsToggle');
    if (audioCheckbox) audioCheckbox.checked = isVisible;
}

export function initializeAudioControls() {
    updateAudioControlsVisibility();
}

export function initialiseNarratorSelect() {
    const sel = document.getElementById('narratorSelect');
    if (sel) sel.value = state.settings.audioNarrator || 'gilbert';
}
