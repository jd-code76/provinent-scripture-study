import { state, onStateChange, saveToStorageImmediate, APP_VERSION } from "./state.js";
function safeJSONParse(str) {
  try {
    const obj = JSON.parse(str);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
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
    this.connections = new Map(); 
    this.connectedDevices = [];
    this.localDeviceId = this._genDeviceId();
    this.syncInProgress = new Set();
    this.lastSyncTime = null;
    this.autoSyncTimer = null;
    this.AUTO_SYNC_DELAY_MS = 5000;
    this.reconnectTimer = null;
    this.RECONNECT_INTERVAL_MS = 10000;
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
      if (/iPhone/.test(ua)) return "iPhone";
      if (/iPad/.test(ua)) return "iPad";
      if (/iPod/.test(ua)) return "iPod Touch";
      if (/Android/.test(ua)) {
          const modelMatch = ua.match(/Android.*;\s*([^)]+)\s*Build/);
          if (modelMatch && modelMatch[1]) {
              const model = modelMatch[1].trim();
              if (/Samsung/i.test(model)) return `Samsung ${model.replace(/Samsung/gi, '').trim()}`;
              if (/Pixel/i.test(model)) return `Google ${model}`;
              if (/OnePlus/i.test(model)) return model;
              return `Android: ${model}`;
          }
          return "Android Device";
      }
      if (/Linux/.test(ua) || /X11/.test(ua)) {
          if (/CrOS/.test(ua)) return "Chromebook";
          if (/Ubuntu/.test(ua)) return "Ubuntu Linux";
          if (/Fedora/.test(ua)) return "Fedora Linux";
          if (/Debian/.test(ua)) return "Debian Linux";
          if (/Linux armv/.test(platform)) return "Linux (ARM)"; 
          if (/Linux x86_64/.test(platform)) return "Linux (64-bit)";
          if (/Linux i686/.test(platform)) return "Linux (32-bit)";
          return "Linux Desktop";
      }
      if (/Win/.test(ua)) {
          if (/Windows NT 10/.test(ua)) return "Windows 10/11";
          if (/Windows NT 6\.3/.test(ua)) return "Windows 8.1";
          if (/Windows NT 6\.2/.test(ua)) return "Windows 8";
          if (/Windows NT 6\.1/.test(ua)) return "Windows 7";
          if (/Windows NT 6\.0/.test(ua)) return "Windows Vista";
          if (/Windows NT 5\.1/.test(ua)) return "Windows XP";
          return "Windows PC";
      }
      if (/Mac/.test(ua)) {
          if (/Macintosh/.test(ua)) {
              const macVersionMatch = ua.match(/Mac OS X ([\d_]+)/);
              if (macVersionMatch) {
                  const version = macVersionMatch[1].split('_')[0];
                  if (parseInt(version) >= 11) return "macOS (Apple Silicon)"; 
                  return `macOS ${version}`;
              }
              return "macOS";
          }
          return "Mac";
      }
      if (/FreeBSD/.test(ua)) return "FreeBSD";
      if (/OpenBSD/.test(ua)) return "OpenBSD";
      if (/NetBSD/.test(ua)) return "NetBSD";
      if (/SunOS/.test(ua)) return "Solaris";
      if (/AIX/.test(ua)) return "IBM AIX";
      if (/PlayStation/.test(ua)) return "PlayStation";
      if (/Xbox/.test(ua)) return "Xbox";
      if (/Nintendo/.test(ua)) return "Nintendo";
      if (/SmartTV|TV/.test(ua)) return "Smart TV";
      const browserHint = this._getBrowserName(ua);
      return browserHint ? `Unknown Device (${browserHint})` : "Unknown Device";
  }
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
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });
    this.peer.on('open', (id) => {
      console.info("[Sync] Peer ready – ID:", id);
      this._myPeerId = id;
      state.settings.myPeerId = id;
      saveToStorageImmediate();
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
      await this._sendMessage(conn, {
        type: "challenge",
        nonce: challengeNonce
      });
    });
    conn.on('data', (data) => {
      try {
        const now = Date.now();
        if (!this.messageRateLimit.has(conn.peer)) {
          this.messageRateLimit.set(conn.peer, []);
        }
        const timestamps = this.messageRateLimit.get(conn.peer);
        timestamps.push(now);
        const recent = timestamps.filter(t => now - t < 10000);
        this.messageRateLimit.set(conn.peer, recent);
        if (recent.length > 50) { 
          console.warn('[Sync] Rate limit exceeded from', conn.peer);
          conn.close();
          return;
        }
        const msg = safeJSONParse(data);
        if (!msg) {
          console.error('[Sync] Invalid message format from', conn.peer);
          return;
        }
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
              this.reconnectAttempts.delete(conn.peer);
              if (!state.settings.autoSync && this.connections.size === 1) {
                  state.settings.autoSync = true;
                  saveToStorageImmediate();
                  console.log('[Sync] Auto-sync enabled on first connection');
                  const autoSyncToggle = document.getElementById('autoSyncToggle');
                  if (autoSyncToggle) {
                      autoSyncToggle.checked = true;
                  }
              }
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
        if (!authenticated) {
          console.warn('[Sync] Unauthenticated message from', conn.peer);
          return;
        }
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
    if (incomingState.highlights || incomingState._syncMeta?.highlights) {
        console.log('[Sync] Merging highlights:', {
            incoming: Object.keys(incomingState.highlights || {}).length,
            local: Object.keys(state.highlights).length
        });
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
            if (incomingTs > localTs) {
                if (incomingDeleted) {
                    if (state.highlights[ref]) {
                        delete state.highlights[ref];
                        changesMade = true;
                    }
                    if (!state._syncMeta.highlights) state._syncMeta.highlights = {};
                    state._syncMeta.highlights[ref] = { ts: incomingTs, deleted: true };
                } else if (incomingColor) {
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
    if (incomingState.settings) {
      const skipKeys = [
        'collapsedSections', 'collapsedPanels', 'panelWidths', 
        'referencePanelOpen', 'hotkeys', 'hotkeysEnabled', 
        'currentPassageReference', 'manualBook', 'manualChapter',
        'audioPlayer', 'currentChapterData', 'footnotes', 'footnotesCollapsed',
        'myPeerId', 'connectedDevices',
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
    if (remoteDeviceId) {
      const device = this.connectedDevices.find(d => d.id === remoteDeviceId || d.peerId === peerId);
      if (device) {
        device.lastConnectedAt = Date.now();
        device.peerId = peerId;
        state.settings.connectedDevices = [...this.connectedDevices];
      }
    }
    if (changesMade) {
      saveToStorageImmediate();
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
    saveToStorageImmediate();
    const eventType = index > -1 ? "sync:deviceUpdated" : "sync:deviceAdded";
    document.dispatchEvent(new CustomEvent(eventType, { detail: deviceInfo }));
  }
  _startReconnectPolling() {
    if (this.reconnectTimer || this.connectedDevices.length === 0) {
        return;
    }
    console.log("[Sync] Starting auto-reconnect polling...");
    this.reconnectAttempts.clear();
    this.reconnectTimer = setInterval(() => {
        let allDevicesExhausted = true; 
        this.connectedDevices.forEach(device => {
            if (this.connections.has(device.peerId)) {
                this.reconnectAttempts.delete(device.peerId);
                allDevicesExhausted = false; 
                return;
            }
            const attempts = this.reconnectAttempts.get(device.peerId) || 0;
            if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
                return;
            }
            allDevicesExhausted = false;
            console.log(`[Sync] Attempting reconnect to ${device.peerId} (polling attempt ${attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
            this.reconnectAttempts.set(device.peerId, attempts + 1);
            this.connectToPeer(device.peerId, 1); 
        });
        if (allDevicesExhausted && this.connectedDevices.length > 0) {
            console.warn('[Sync] All devices exhausted reconnect attempts - stopping auto-reconnect');
            this._stopReconnectPolling();
            document.dispatchEvent(new CustomEvent('sync:allReconnectsFailed', {
                detail: { 
                    devices: this.connectedDevices.map(d => d.peerId),
                    message: 'All reconnection attempts failed. Check device connectivity or remove offline devices.'
                }
            }));
        }
    }, this.RECONNECT_INTERVAL_MS);
    this.connectedDevices.forEach(device => {
        this.reconnectAttempts.set(device.peerId, 1);
        this.connectToPeer(device.peerId, 1);
    });
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
  async startPairing() {
    this._myPeerId = this._generatePairingCode();
    state.settings.myPeerId = this._myPeerId;
    saveToStorageImmediate();
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
      conn.on('error', (err) => {
          if (err.type === 'peer-unavailable' && retries > 0) {
              console.warn(`[Sync] Peer ${peerId} unavailable, retrying once in 2s...`);
              setTimeout(() => this.connectToPeer(peerId, retries - 1), 2000);
          } else {
              console.error(`[Sync] Connection error for ${peerId}:`, err.type);
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
    saveToStorageImmediate();
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
    saveToStorageImmediate();
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
      saveToStorageImmediate();
      document.dispatchEvent(new CustomEvent("sync:deviceUpdated", { 
        detail: device 
      }));
    }
  }
  resetReconnectAttempts(peerId = null) {
      if (peerId) {
          this.reconnectAttempts.delete(peerId);
          console.log(`[Sync] Reset reconnect attempts for ${peerId}`);
          if (!this.connections.has(peerId)) {
              this.connectToPeer(peerId);
          }
      } else {
          this.reconnectAttempts.clear();
          console.log('[Sync] Reset all reconnect attempts');
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
    if (state.settings.myPeerId && typeof state.settings.myPeerId === 'string') {
      this._myPeerId = state.settings.myPeerId;
    }
    onStateChange(() => {
      if (state.settings.autoSync && this.isConnected()) {
        this.scheduleAutoSync();
      }
    });
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