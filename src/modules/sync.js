/*=====================================================================
  Provinent Scripture Study – sync.js
  Text-based device pairing with automatic reconnection via PeerJS
=====================================================================*/

import { state, onStateChange, saveToStorage, APP_VERSION } from "./state.js";

/**
 * Safe JSON parser that prevents prototype pollution
 * @param {string} str - JSON string to parse
 * @returns {Object|null} - Parsed object or null if invalid
 */
function safeJSONParse(str) {
  try {
    const obj = JSON.parse(str);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    
    // Strip dangerous keys
    delete obj.__proto__;
    delete obj.constructor;
    delete obj.prototype;
    
    return obj;
  } catch (e) {
    console.error('[Sync] JSON parse error:', e);
    return null;
  }
}

class SyncManager {
  constructor() {
    this.peer = null;
    this.connections = new Map(); // peerId -> DataConnection
    this.connectedDevices = [];
    this.localDeviceId = this._genDeviceId();
    this.syncInProgress = new Set();
    this.lastSyncTime = null;
    this.autoSyncTimer = null;
    this.AUTO_SYNC_DELAY_MS = 5000;
    this.reconnectTimer = null;
    this.RECONNECT_INTERVAL_MS = 15000;
    this.broadcastChannel = null;
    this._myPeerId = null;
    this.messageRateLimit = new Map();
    this.reconnectAttempts = new Map();
    this.MAX_RECONNECT_ATTEMPTS = 3; 
  }

  _generatePairingCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  _genDeviceId() {
    let id = localStorage.getItem("deviceId");
    if (!id) {
      id = "dev_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("deviceId", id);
    }
    return id;
  }

  _deviceName() {
      const ua = navigator.userAgent;
      const platform = navigator.platform || '';
      
      // Mobile devices (check first for specificity)
      if (/iPhone/.test(ua)) return "iPhone";
      if (/iPad/.test(ua)) return "iPad";
      if (/iPod/.test(ua)) return "iPod Touch";
      
      // Android devices (try to get specific model/brand)
      if (/Android/.test(ua)) {
          // Extract device model if available (e.g., "SM-G960F" for Samsung Galaxy S9)
          const modelMatch = ua.match(/Android.*;\s*([^)]+)\s*Build/);
          if (modelMatch && modelMatch[1]) {
              const model = modelMatch[1].trim();
              // Common brands
              if (/Samsung/i.test(model)) return `Samsung ${model.replace(/Samsung/gi, '').trim()}`;
              if (/Pixel/i.test(model)) return `Google ${model}`;
              if (/OnePlus/i.test(model)) return model;
              return `Android: ${model}`;
          }
          return "Android Device";
      }
      
      // Desktop OS detection
      // Linux (various distros)
      if (/Linux/.test(ua) || /X11/.test(ua)) {
          // Check for Chrome OS first (it reports as Linux)
          if (/CrOS/.test(ua)) return "Chromebook";
          
          // Try to identify Linux distro from UA (rarely available)
          if (/Ubuntu/.test(ua)) return "Ubuntu Linux";
          if (/Fedora/.test(ua)) return "Fedora Linux";
          if (/Debian/.test(ua)) return "Debian Linux";
          
          // Check platform for more clues
          if (/Linux armv/.test(platform)) return "Linux (ARM)"; // Raspberry Pi, etc.
          if (/Linux x86_64/.test(platform)) return "Linux (64-bit)";
          if (/Linux i686/.test(platform)) return "Linux (32-bit)";
          
          return "Linux Desktop";
      }
      
      // Windows (with version detection)
      if (/Win/.test(ua)) {
          if (/Windows NT 10/.test(ua)) return "Windows 10/11";
          if (/Windows NT 6\.3/.test(ua)) return "Windows 8.1";
          if (/Windows NT 6\.2/.test(ua)) return "Windows 8";
          if (/Windows NT 6\.1/.test(ua)) return "Windows 7";
          if (/Windows NT 6\.0/.test(ua)) return "Windows Vista";
          if (/Windows NT 5\.1/.test(ua)) return "Windows XP";
          return "Windows PC";
      }
      
      // macOS (with version hints)
      if (/Mac/.test(ua)) {
          // Distinguish between Mac types
          if (/Macintosh/.test(ua)) {
              // Try to get macOS version
              const macVersionMatch = ua.match(/Mac OS X ([\d_]+)/);
              if (macVersionMatch) {
                  const version = macVersionMatch[1].split('_')[0];
                  if (parseInt(version) >= 11) return "macOS (Apple Silicon)"; // Rough heuristic
                  return `macOS ${version}`;
              }
              return "macOS";
          }
          return "Mac";
      }
      
      // BSD variants
      if (/FreeBSD/.test(ua)) return "FreeBSD";
      if (/OpenBSD/.test(ua)) return "OpenBSD";
      if (/NetBSD/.test(ua)) return "NetBSD";
      
      // Other Unix-like
      if (/SunOS/.test(ua)) return "Solaris";
      if (/AIX/.test(ua)) return "IBM AIX";
      
      // Game consoles (just for fun)
      if (/PlayStation/.test(ua)) return "PlayStation";
      if (/Xbox/.test(ua)) return "Xbox";
      if (/Nintendo/.test(ua)) return "Nintendo";
      
      // Smart TVs
      if (/SmartTV|TV/.test(ua)) return "Smart TV";
      
      // Fallback with browser hint
      const browserHint = this._getBrowserName(ua);
      return browserHint ? `Unknown Device (${browserHint})` : "Unknown Device";
  }

  /**
   * Get browser name for fallback identification
   * @param {string} ua - User agent string
   * @returns {string} - Browser name
   */
  _getBrowserName(ua) {
      if (/Edge/.test(ua)) return "Edge";
      if (/Chrome/.test(ua) && !/Edg/.test(ua)) return "Chrome";
      if (/Firefox/.test(ua)) return "Firefox";
      if (/Safari/.test(ua) && !/Chrome/.test(ua)) return "Safari";
      if (/Opera|OPR/.test(ua)) return "Opera";
      if (/Vivaldi/.test(ua)) return "Vivaldi";
      if (/Brave/.test(ua)) return "Brave";
      return "";
  }

  async _ensurePeerJS() {
    if (typeof Peer !== 'undefined') return;
  
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';
      script.onload = () => {
        console.log('[Sync] PeerJS loaded');
        resolve();
      };
      script.onerror = () => reject(new Error('PeerJS load failed'));
      document.head.appendChild(script);
    });
  }

  async initPeer() {
    await this._ensurePeerJS();
    if (this.peer && !this.peer.destroyed) return;
  
    const peerId = this._myPeerId || this._generatePairingCode();
  
    this.peer = new Peer(peerId, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('open', (id) => {
      console.info("[Sync] Peer ready – ID:", id);
      this._myPeerId = id;
      state.settings.myPeerId = id;
      saveToStorage();
      document.dispatchEvent(new CustomEvent("sync:peerReady", { detail: { peerId: id } }));
    });

    this.peer.on('error', (err) => {
      console.error("[Sync] Peer error:", err);
      if (err.type === 'unavailable-id') {
        this._myPeerId = null;
        state.settings.myPeerId = null;
        this.generateNewPeerId();
      } else if (err.type === 'peer-unavailable') {
        console.warn("[Sync] Peer unavailable – will retry");
      } else {
        document.dispatchEvent(new CustomEvent("sync:error", { detail: { error: err.type } }));
      }
    });

    this.peer.on('connection', (conn) => {
      console.info("[Sync] Incoming connection from:", conn.peer);
      this._handleIncomingConnection(conn);
    });
  }

  generateNewPeerId() {
    this._myPeerId = this._generatePairingCode();
    return this._myPeerId;
  }

  getMyPeerId() {
    return this._myPeerId;
  }

  _handleIncomingConnection(conn) {
    this._bindDataChannel(conn);
  }

  _bindDataChannel(conn) {
    let authenticated = false;
    const challengeNonce = crypto.randomUUID ? crypto.randomUUID() : 
                           btoa(Date.now() + Math.random().toString(36));

    conn.on('open', async () => {
      console.info("[Sync] Connection OPEN, sending challenge to:", conn.peer);
      
      // Send challenge
      await this._sendMessage(conn, {
        type: "challenge",
        nonce: challengeNonce
      });
    });

    conn.on('data', (data) => {
      try {
        // Rate limiting check
        const now = Date.now();
        if (!this.messageRateLimit.has(conn.peer)) {
          this.messageRateLimit.set(conn.peer, []);
        }
        const timestamps = this.messageRateLimit.get(conn.peer);
        timestamps.push(now);

        // Keep only last 10 seconds
        const recent = timestamps.filter(t => now - t < 10000);
        this.messageRateLimit.set(conn.peer, recent);

        if (recent.length > 50) { // Max 50 messages per 10s
          console.warn('[Sync] Rate limit exceeded from', conn.peer);
          conn.close();
          return;
        }
        
        // Safe parse
        const msg = safeJSONParse(data);
        if (!msg) {
          console.error('[Sync] Invalid message format from', conn.peer);
          return;
        }
        
        // Handle challenge/response (auth)
        if (msg.type === 'challenge') {
          const response = btoa(msg.nonce + this.localDeviceId);
          this._sendMessage(conn, { 
            type: 'challenge-response', 
            response, 
            deviceId: this.localDeviceId 
          });
          return;
        }
        
        if (msg.type === 'challenge-response') {
          const expected = btoa(challengeNonce + msg.deviceId);
          if (msg.response === expected) {
              authenticated = true;
              this.connections.set(conn.peer, conn);
              console.info('[Sync] Authenticated:', conn.peer);
              this._stopReconnectPolling();

              // Reset retry counter on successful connection
              this.reconnectAttempts.delete(conn.peer);
              
              // Auto-enable auto-sync on first successful connection
              if (!state.settings.autoSync && this.connections.size === 1) {
                  state.settings.autoSync = true;
                  saveToStorage();
                  console.log('[Sync] Auto-sync enabled on first connection');
                  
                  // Update UI checkbox if settings modal is open
                  const autoSyncToggle = document.getElementById('autoSyncToggle');
                  if (autoSyncToggle) {
                      autoSyncToggle.checked = true;
                  }
              }
              
              // Now send handshake
              this._sendMessage(conn, {
                  type: "handshake",
                  deviceId: this.localDeviceId,
                  deviceName: this._deviceName(),
              });
              
              this.syncNow(conn.peer);
              document.dispatchEvent(new CustomEvent("sync:peerConnected", { 
                  detail: { peerId: conn.peer } 
              }));
          } else {
            console.error('[Sync] Auth failed for', conn.peer);
            conn.close();
          }
          return;
        }
        
        // All other messages require auth
        if (!authenticated) {
          console.warn('[Sync] Unauthenticated message from', conn.peer);
          return;
        }
        
        // Version check
        if (msg.version && msg.version !== APP_VERSION) {
          console.error("[Sync] Version mismatch:", APP_VERSION, "vs", msg.version);
          alert(`Version mismatch: This device (${APP_VERSION}) vs peer (${msg.version}). Please update both devices.`);
          this.closeConnection(conn.peer);
          return;
        }
        
        this._handleIncomingMessage(conn.peer, msg);
      } catch (e) {
        console.error("[Sync] Bad message from", conn.peer, ":", e);
      }
    });

    conn.on('close', () => {
      console.info("[Sync] Connection CLOSED to:", conn.peer);
      this.closeConnection(conn.peer);
    });

    conn.on('error', (e) => {
      console.error("[Sync] Connection error to", conn.peer, ":", e);
      this.closeConnection(conn.peer);
    });
  }

  async _sendMessage(connOrId, obj) {
    let conn;
    if (typeof connOrId === 'string') {
      conn = this.connections.get(connOrId);
    } else {
      conn = connOrId;
    }
    
    if (!conn || !conn.open) {
      console.warn("[Sync] Connection not ready to", conn?.peer || connOrId);
      return false;
    }
    
    conn.send(JSON.stringify({ ...obj, version: APP_VERSION }));
    return true;
  }

  _handleIncomingMessage(peerId, msg) {
    switch (msg.type) {
      case "handshake":
        this._addDevice({ 
          id: msg.deviceId, 
          peerId: peerId,
          name: msg.deviceName 
        });
        break;
      
      case "sync-request":
        console.log("[Sync] Sync request from", peerId);
        this._sendMessage(peerId, { 
          type: "sync-data", 
          payload: this._serializeState() 
        });
        break;
      
      case "sync-data":
        console.log("[Sync] Sync data from", peerId);
        if (this.syncInProgress.has(peerId)) {
          console.warn("[Sync] Sync already in progress from", peerId);
          return;
        }
        
        this.syncInProgress.add(peerId);
        document.dispatchEvent(new CustomEvent("sync:inProgress", { detail: { peerId } }));
        
        const changesMade = this._mergeState(msg.payload, peerId);
        this.lastSyncTime = Date.now();
        
        this.syncInProgress.delete(peerId);
        document.dispatchEvent(new CustomEvent("sync:complete", { 
          detail: { peerId, changesMade, timestamp: this.lastSyncTime }
        }));
        break;
      
      default:
        console.warn("[Sync] Unknown message type:", msg.type);
    }
  }

  _serializeState() {
    return {
      highlights: { ...state.highlights },
      notes: state.notes,
      settings: { ...state.settings },
      _syncMeta: { ...state._syncMeta },
      deviceId: this.localDeviceId,
      timestamp: Date.now()
    };
  }

  _mergeState(incomingState, peerId) {
    if (!incomingState) return false;

    let changesMade = false;
    const remoteDeviceId = incomingState.deviceId;

    // Merge highlights (per-reference timestamp, with deletion support)
    if (incomingState.highlights || incomingState._syncMeta?.highlights) {
        console.log('[Sync] Merging highlights:', {
            incoming: Object.keys(incomingState.highlights || {}).length,
            local: Object.keys(state.highlights).length
        });

        // Process all references from both incoming data AND metadata (to catch deletions)
        const allRefs = new Set([
            ...Object.keys(incomingState.highlights || {}),
            ...Object.keys(incomingState._syncMeta?.highlights || {})
        ]);

        allRefs.forEach(ref => {
            const incomingColor = incomingState.highlights?.[ref];
            const incomingMeta = incomingState._syncMeta?.highlights?.[ref] || {};
            const incomingTs = incomingMeta.ts || 0;
            const incomingDeleted = incomingMeta.deleted || false;

            const localMeta = state._syncMeta?.highlights?.[ref] || {};
            const localTs = localMeta.ts || 0;

            // Remote is newer
            if (incomingTs > localTs) {
                if (incomingDeleted) {
                    // Remote deleted it
                    if (state.highlights[ref]) {
                        delete state.highlights[ref];
                        changesMade = true;
                    }
                    if (!state._syncMeta.highlights) state._syncMeta.highlights = {};
                    state._syncMeta.highlights[ref] = { ts: incomingTs, deleted: true };
                } else if (incomingColor) {
                    // Remote added/updated it
                    if (state.highlights[ref] !== incomingColor) {
                        state.highlights[ref] = incomingColor;
                        changesMade = true;
                    }
                    if (!state._syncMeta.highlights) state._syncMeta.highlights = {};
                    state._syncMeta.highlights[ref] = { ts: incomingTs };
                }
            }
        });
    }

    // Merge notes (existing code)
    if (incomingState.notes !== undefined) {
        const incomingTs = incomingState._syncMeta?.notes?.ts || 0;
        const localTs = state._syncMeta?.notes?.ts || 0;
        
        if (incomingTs > localTs) {
            state.notes = incomingState.notes;
            if (!state._syncMeta.notes) state._syncMeta.notes = {};
            state._syncMeta.notes.ts = incomingTs;
            changesMade = true;
            console.log('[Sync] Notes updated from remote');
        }
    }

    // Merge settings (per-key timestamp, skip UI-only)
    if (incomingState.settings) {
      const skipKeys = [
        // Per-device UI state
        'collapsedSections', 'collapsedPanels', 'panelWidths', 
        'referencePanelOpen', 'hotkeys', 'hotkeysEnabled', 
        
        // Navigation/transient state
        'currentPassageReference', 'manualBook', 'manualChapter',
        'audioPlayer', 'currentChapterData', 'footnotes', 'footnotesCollapsed',
        
        // Sync system
        'myPeerId', 'connectedDevices',
        
        // Per-device display preferences 
        'scriptureFontSize', 'notesFontSize'
    ];
      
      Object.entries(incomingState.settings).forEach(([key, value]) => {
        if (skipKeys.includes(key)) return;
        
        const incomingTs = incomingState._syncMeta?.settings?.[key]?.ts || 0;
        const localTs = state._syncMeta?.settings?.[key]?.ts || 0;
        
        if (incomingTs > localTs) {
          if (state.settings[key] !== value) {
            state.settings[key] = value;
            if (!state._syncMeta.settings) state._syncMeta.settings = {};
            state._syncMeta.settings[key] = { ts: incomingTs };
            changesMade = true;
          }
        }
      });
    }

    // Update device last seen
    if (remoteDeviceId) {
      const device = this.connectedDevices.find(d => d.id === remoteDeviceId || d.peerId === peerId);
      if (device) {
        device.lastConnectedAt = Date.now();
        device.peerId = peerId;
        state.settings.connectedDevices = [...this.connectedDevices];
      }
    }

    if (changesMade) {
      saveToStorage();
      document.dispatchEvent(new CustomEvent("sync:merged", { 
        detail: { peerId, changesMade, timestamp: Date.now() }
      }));
    }

    return changesMade;
  }

  _addDevice(info) {
    let device = this.connectedDevices.find(d => d.peerId === info.peerId);
    
    const deviceInfo = {
      id: info.id,
      peerId: info.peerId,
      name: info.name || this._deviceName(),
      customName: device?.customName || null,
      connectedAt: device?.connectedAt || Date.now(),
      lastConnectedAt: Date.now()
    };

    const index = this.connectedDevices.findIndex(d => d.peerId === deviceInfo.peerId);
    if (index > -1) {
      this.connectedDevices[index] = deviceInfo;
    } else {
      this.connectedDevices.push(deviceInfo);
    }

    state.settings.connectedDevices = [...this.connectedDevices];
    saveToStorage();

    const eventType = index > -1 ? "sync:deviceUpdated" : "sync:deviceAdded";
    document.dispatchEvent(new CustomEvent(eventType, { detail: deviceInfo }));
  }

  /* -----------------------------------------------------------------
     Auto-Reconnect (PeerJS + Local Broadcast)
  ----------------------------------------------------------------- */
  _startReconnectPolling() {
    if (this.reconnectTimer || this.connectedDevices.length === 0) {
        return;
    }

    console.log("[Sync] Starting auto-reconnect polling...");
    
    // Reset retry counters when starting fresh
    this.reconnectAttempts.clear();
    
    this.reconnectTimer = setInterval(() => {
        let allDevicesExhausted = true; // Track if all devices have given up
        
        this.connectedDevices.forEach(device => {
            // Skip if already connected
            if (this.connections.has(device.peerId)) {
                // Reset counter on successful connection
                this.reconnectAttempts.delete(device.peerId);
                allDevicesExhausted = false; // At least one device is active
                return;
            }
            
            // Check retry count
            const attempts = this.reconnectAttempts.get(device.peerId) || 0;
            
            if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
                // Max attempts reached - skip this device
                return;
            }
            
            // At least one device still trying
            allDevicesExhausted = false;
            
            console.log(`[Sync] Attempting reconnect to ${device.peerId} (polling attempt ${attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
            
            // Increment counter
            this.reconnectAttempts.set(device.peerId, attempts + 1);
            
            // Try to connect (with individual retry logic)
            this.connectToPeer(device.peerId, 1); // Only 1 immediate retry per polling cycle
        });
        
        // Stop polling if all devices have exhausted retries
        if (allDevicesExhausted && this.connectedDevices.length > 0) {
            console.warn('[Sync] All devices exhausted reconnect attempts - stopping auto-reconnect');
            this._stopReconnectPolling();
            
            // Emit event for UI notification
            document.dispatchEvent(new CustomEvent('sync:allReconnectsFailed', {
                detail: { 
                    devices: this.connectedDevices.map(d => d.peerId),
                    message: 'All reconnection attempts failed. Check device connectivity or remove offline devices.'
                }
            }));
        }
    }, this.RECONNECT_INTERVAL_MS);

    // Initial attempt
    this.connectedDevices.forEach(device => {
        this.reconnectAttempts.set(device.peerId, 1);
        this.connectToPeer(device.peerId, 1);
    });

    // Local multi-tab broadcast
    this._broadcastReconnectIntent();
  }

  _stopReconnectPolling() {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
      console.log("[Sync] Stopped auto-reconnect polling");
    }
  }

  _broadcastReconnectIntent() {
    try {
      if (!this.broadcastChannel) {
        this.broadcastChannel = new BroadcastChannel('provinent-sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data.type === 'reconnect-request' && 
              event.data.deviceId !== this.localDeviceId) {
            console.log("[Sync] Reconnect request from peer tab");
            this._startReconnectPolling();
          }
        };
      }
      
      this.broadcastChannel.postMessage({
        type: 'reconnect-request',
        deviceId: this.localDeviceId,
        timestamp: Date.now()
      });
    } catch (e) {
      console.warn("[Sync] BroadcastChannel unsupported");
    }
  }

  /* -----------------------------------------------------------------
     Public API
  ----------------------------------------------------------------- */
  async startPairing() {
    // Force new peer ID generation
    this._myPeerId = this._generatePairingCode();
    state.settings.myPeerId = this._myPeerId;
    saveToStorage();
  
    await this.initPeer();

    console.log("[Sync] Pairing code ready:", this._myPeerId);
    document.dispatchEvent(new CustomEvent("sync:pairingStarted", { 
      detail: { peerId: this._myPeerId } 
    }));
  
    return { code: this._myPeerId };
  }

  connectToPeer(peerId, retries = 1) {
      if (!this.peer || this.peer.destroyed) {
          console.warn("[Sync] Peer not initialized");
          return false;
      }
    
      if (this.connections.has(peerId)) {
          console.log("[Sync] Already connected to", peerId);
          // Reset retry counter on existing connection
          this.reconnectAttempts.delete(peerId);
          return false;
      }

      if (peerId === this._myPeerId) {
          console.warn("[Sync] Cannot connect to self");
          return false;
      }

      const pollingAttempt = this.reconnectAttempts.get(peerId) || 0;
      console.log(`[Sync] Connecting to ${peerId} (immediate retry ${2 - retries}/1, polling cycle ${pollingAttempt}/${this.MAX_RECONNECT_ATTEMPTS})`);
      
      const conn = this.peer.connect(peerId, { reliable: true });
    
      // Only retry once immediately, then let polling handle it
      conn.on('error', (err) => {
          if (err.type === 'peer-unavailable' && retries > 0) {
              console.warn(`[Sync] Peer ${peerId} unavailable, retrying once in 2s...`);
              setTimeout(() => this.connectToPeer(peerId, retries - 1), 2000);
          } else {
              console.error(`[Sync] Connection error for ${peerId}:`, err.type);
              // Don't increment counter here - polling will handle it
          }
      });
    
      this._bindDataChannel(conn);
      return true;
  }

  async syncNow(peerId = null) {
    const targets = peerId ? [peerId] : Array.from(this.connections.keys());
    
    if (targets.length === 0) {
      throw new Error("No active connections");
    }

    let successCount = 0;
    for (const target of targets) {
      if (this.syncInProgress.has(target)) continue;
      
      this.syncInProgress.add(target);

      try {
        await this._sendMessage(target, { type: "sync-request" });
        await this._sendMessage(target, { 
          type: "sync-data", 
          payload: this._serializeState() 
        });
        successCount++;
      } catch (e) {
        console.error("[Sync] Failed sync to", target, ":", e);
      } finally {
        this.syncInProgress.delete(target);
      }
    }

    if (successCount > 0) {
      this.lastSyncTime = Date.now();
      document.dispatchEvent(new CustomEvent("sync:complete", { 
        detail: { targets, timestamp: this.lastSyncTime } 
      }));
      return true;
    }
    
    throw new Error("No successful syncs");
  }

  scheduleAutoSync() {
    if (this.autoSyncTimer) clearTimeout(this.autoSyncTimer);
    
    this.autoSyncTimer = setTimeout(async () => {
      if (state.settings.autoSync && this.connections.size > 0) {
        console.log("[Sync] Auto-sync triggered");
        try {
          await this.syncNow();
        } catch (e) {
          console.error("[Sync] Auto-sync failed:", e);
        }
      }
    }, this.AUTO_SYNC_DELAY_MS);
  }

  closeConnection(peerId) {
    const conn = this.connections.get(peerId);
    if (conn) {
      conn.close();
      this.connections.delete(peerId);
    }
    document.dispatchEvent(new CustomEvent("sync:peerDisconnected", { 
      detail: { peerId } 
    }));
  }

  disconnect(peerId = null) {
    if (peerId) {
      this.closeConnection(peerId);
    } else {
      Array.from(this.connections.keys()).forEach(id => this.closeConnection(id));
      this.connections.clear();
      this.syncInProgress.clear();
      if (this.autoSyncTimer) clearTimeout(this.autoSyncTimer);
    }

    this._stopReconnectPolling();

    state.settings.connectedDevices = [...this.connectedDevices];
    if (this.connectedDevices.length > 0) {
      this._startReconnectPolling();
    }
    saveToStorage();

    if (!peerId) {
      document.dispatchEvent(new CustomEvent("sync:disconnected"));
    }
    
    console.info("[Sync] Disconnected", peerId ? `from ${peerId}` : "all");
  }

  removeDevice(deviceIdOrPeerId) {
    this.connectedDevices = this.connectedDevices.filter(
      d => d.id !== deviceIdOrPeerId && d.peerId !== deviceIdOrPeerId
    );
    
    this.closeConnection(deviceIdOrPeerId);
    this.reconnectAttempts.delete(deviceIdOrPeerId);

    state.settings.connectedDevices = [...this.connectedDevices];
    
    if (this.connectedDevices.length === 0) {
      this._stopReconnectPolling();
      this.reconnectAttempts.clear();
      if (this.peer) this.peer.destroy();
      this.peer = null;
      this._myPeerId = null;
      state.settings.myPeerId = null;
    }
    
    saveToStorage();
    document.dispatchEvent(new CustomEvent("sync:deviceRemoved", { 
      detail: { id: deviceIdOrPeerId } 
    }));
  }

  updateDeviceName(deviceIdOrPeerId, customName) {
    const device = this.connectedDevices.find(
      d => d.id === deviceIdOrPeerId || d.peerId === deviceIdOrPeerId
    );
    
    if (device) {
      device.customName = customName || null;
      state.settings.connectedDevices = [...this.connectedDevices];
      saveToStorage();
      document.dispatchEvent(new CustomEvent("sync:deviceUpdated", { 
        detail: device 
      }));
    }
  }

  resetReconnectAttempts(peerId = null) {
      if (peerId) {
          this.reconnectAttempts.delete(peerId);
          console.log(`[Sync] Reset reconnect attempts for ${peerId}`);
          
          // Try connecting immediately if not already connected
          if (!this.connections.has(peerId)) {
              this.connectToPeer(peerId);
          }
      } else {
          this.reconnectAttempts.clear();
          console.log('[Sync] Reset all reconnect attempts');
          
          // Restart polling
          this._stopReconnectPolling();
          this._startReconnectPolling();
      }
  }

  getConnectedDevices() {
    return [...this.connectedDevices];
  }

  getActiveConnections() {
    return Array.from(this.connections.keys()).filter(
      id => this.connections.get(id)?.open
    );
  }

  isConnected(peerId = null) {
    if (peerId) {
      return this.connections.has(peerId) && this.connections.get(peerId).open;
    }
    return this.connections.size > 0;
  }

  getLastSyncTime() {
    return this.lastSyncTime;
  }

  init() {
    if (state.settings.connectedDevices && Array.isArray(state.settings.connectedDevices)) {
      this.connectedDevices = [...state.settings.connectedDevices];
      this.connectedDevices.forEach(d => {
        if (!d.peerId) d.peerId = d.id;
      });
      console.info("[Sync] Loaded", this.connectedDevices.length, "device(s)");
    }

    // Restore peer ID if available
    if (state.settings.myPeerId && typeof state.settings.myPeerId === 'string') {
        this._myPeerId = state.settings.myPeerId;
    }

    // Attach the state‑change listener **first**
    onStateChange((detail) => {
        if (state.settings.autoSync && this.isConnected()) {
            this.scheduleAutoSync();
        }
    });

    // Immediately schedule auto‑sync if the flag is already true
    if (state.settings.autoSync && this.isConnected()) {
        this.scheduleAutoSync();
    }

    // Auto‑reconnect if devices exist
    if (this.connectedDevices.length > 0) {
        if (!this._myPeerId) {
            this.generateNewPeerId();
        }
        this.initPeer();
        this._startReconnectPolling();
    }

    console.info("[Sync] Initialized – Device ID:", this.localDeviceId);
  }

  destroy() {
    this.disconnect();
    if (this.peer) this.peer.destroy();
    this._stopReconnectPolling();
    if (this.broadcastChannel) this.broadcastChannel.close();
  }
}

/* -----------------------------------------------------------------
   Exports
----------------------------------------------------------------- */
export const syncManager = new SyncManager();
export const initSync = () => syncManager.init();
export const startPairing = () => syncManager.startPairing();
export const connectToPeer = (id) => syncManager.connectToPeer(id);
export const syncNow = () => syncManager.syncNow();
export const disconnect = (id) => syncManager.disconnect(id);
export const removeDevice = (id) => syncManager.removeDevice(id);
export const updateDeviceName = (id, name) => syncManager.updateDeviceName(id, name);
export const getConnectedDevices = () => syncManager.getConnectedDevices();
export const getActiveConnections = () => syncManager.getActiveConnections();
export const isConnected = () => syncManager.isConnected();
export const getLastSyncTime = () => syncManager.getLastSyncTime();
export const getMyPeerId = () => syncManager.getMyPeerId();
export const hasPriorConnection = () => getConnectedDevices().length > 0;
export const resetReconnectAttempts = (id) => syncManager.resetReconnectAttempts(id);
