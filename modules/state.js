import { handleError } from '../main.js';
export const APP_VERSION = '2.3.2026.01.23';
const COOKIE_LENGTH = 10;
let saveTimeout = null;
export const BOOK_ORDER = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
    '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther',
    'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
    'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum',
    'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    'Matthew', 'Mark', 'Luke', 'John',
    'Acts',
    'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
    'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
    'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude',
    'Revelation'
];
export const CHAPTER_COUNTS = {
    Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34,
    Joshua: 24, Judges: 21, Ruth: 4, '1 Samuel': 31, '2 Samuel': 24,
    '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
    Ezra: 10, Nehemiah: 13, Esther: 10,
    Job: 42, Psalms: 150, Proverbs: 31, Ecclesiastes: 12, 'Song of Solomon': 8,
    Isaiah: 66, Jeremiah: 52, Lamentations: 5, Ezekiel: 48, Daniel: 12,
    Hosea: 14, Joel: 3, Amos: 9, Obadiah: 1, Jonah: 4, Micah: 7,
    Nahum: 3, Habakkuk: 3, Zephaniah: 3, Haggai: 2, Zechariah: 14, Malachi: 4,
    Matthew: 28, Mark: 16, Luke: 24, John: 21,
    Acts: 28,
    Romans: 16, '1 Corinthians': 16, '2 Corinthians': 13, Galatians: 6,
    Ephesians: 6, Philippians: 4, Colossians: 4, '1 Thessalonians': 5,
    '2 Thessalonians': 3, '1 Timothy': 6, '2 Timothy': 4, Titus: 3, Philemon: 1,
    Hebrews: 13, James: 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5,
    '2 John': 1, '3 John': 1, Jude: 1,
    Revelation: 22
};
export const BOOKS_ABBREVIATED = [
    'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', 
    '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 
    'LAM', 'EZE', 'DAN', 'HOS', 'JOE', 'AMO', 'OBA', 'JON', 'MIC', 'NAH', 'HAB', 'ZEP', 
    'HAG', 'ZEC', 'MAL', 'MAT', 'MAR', 'LUK', 'JOH', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 
    'EPH', 'PHI', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAM', '1PE', 
    '2PE', '1JO', '2JO', '3JO', 'JUD', 'REV'
];
export const AVAILABLE_TRANSLATIONS = ['ASV', 'KJV', 'GNV', 'BSB', 'NET'];
export const ABBREVIATION_TO_BOOK_NAME = {
    'GEN': 'Genesis', 'EXO': 'Exodus', 'LEV': 'Leviticus', 'NUM': 'Numbers', 'DEU': 'Deuteronomy',
    'JOS': 'Joshua', 'JDG': 'Judges', 'RUT': 'Ruth', '1SA': '1 Samuel', '2SA': '2 Samuel',
    '1KI': '1 Kings', '2KI': '2 Kings', '1CH': '1 Chronicles', '2CH': '2 Chronicles',
    'EZR': 'Ezra', 'NEH': 'Nehemiah', 'EST': 'Esther', 'JOB': 'Job', 'PSA': 'Psalms',
    'PRO': 'Proverbs', 'ECC': 'Ecclesiastes', 'SNG': 'Song of Solomon', 'ISA': 'Isaiah', 'JER': 'Jeremiah',
    'LAM': 'Lamentations', 'EZE': 'Ezekiel', 'DAN': 'Daniel', 'HOS': 'Hosea', 'JOE': 'Joel',
    'AMO': 'Amos', 'OBA': 'Obadiah', 'JON': 'Jonah', 'MIC': 'Micah', 'NAH': 'Nahum',
    'HAB': 'Habakkuk', 'ZEP': 'Zephaniah', 'HAG': 'Haggai', 'ZEC': 'Zechariah', 'MAL': 'Malachi',
    'MAT': 'Matthew', 'MAR': 'Mark', 'LUK': 'Luke', 'JOH': 'John', 'ACT': 'Acts',
    'ROM': 'Romans', '1CO': '1 Corinthians', '2CO': '2 Corinthians', 'GAL': 'Galatians',
    'EPH': 'Ephesians', 'PHI': 'Philippians', 'COL': 'Colossians', '1TH': '1 Thessalonians',
    '2TH': '2 Thessalonians', '1TI': '1 Timothy', '2TI': '2 Timothy', 'TIT': 'Titus',
    'PHM': 'Philemon', 'HEB': 'Hebrews', 'JAM': 'James', '1PE': '1 Peter', '2PE': '2 Peter',
    '1JO': '1 John', '2JO': '2 John', '3JO': '3 John', 'JUD': 'Jude', 'REV': 'Revelation'
};
export const BOOK_NAME_TO_ABBREVIATION = Object.fromEntries(
    Object.entries(ABBREVIATION_TO_BOOK_NAME).map(([abbr, name]) => [name, abbr])
);
const stateInternal = {
    currentVerse: null,
    currentVerseData: null,
    highlights: {},
    notes: '',
    settings: {
        bibleTranslation: 'BSB',
        referenceVersion: 'NASB',
        footnotes: {},
        audioControlsVisible: true,
        audioNarrator: 'gilbert',
        manualBook: BOOK_ORDER[0],
        manualChapter: 1,
        theme: 'dark',
        colorTheme: 'blue',
        notesView: 'text',
        referencePanelOpen: true,
        referenceSource: 'biblegateway',
        collapsedSections: {},
        collapsedPanels: {},
        panelWidths: {
            sidebar: 280,
            referencePanel: 350,
            scriptureSection: null,
            notesSection: 350
        },
        scriptureFontSize: 16,
        notesFontSize: 16,
        autoplayAudio: true,
        footnotesCollapsed: false,
        syncEnabled: false,
        autoSync: false,
        connectedDevices: [],
        myPeerId: null  
    },
    hotkeys: {
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
    },
    hotkeysEnabled: true,
    currentPassageReference: '',
    audioPlayer: null,
    currentChapterData: null,
    _syncMeta: {
        highlights: {},  
        notes: null,     
        settings: {}     
    }
};
let stateChangeListeners = [];
export function onStateChange(listener) {
    stateChangeListeners.push(listener);
    return () => {
        const idx = stateChangeListeners.indexOf(listener);
        if (idx > -1) stateChangeListeners.splice(idx, 1);
    };
}
function emitStateChange(type, key, oldValue, newValue) {
    const detail = { type, key, oldValue, newValue, timestamp: Date.now() };
    stateChangeListeners.forEach(listener => {
        try {
            listener(detail);
        } catch (e) {
            console.error('State change listener error:', e);
        }
    });
    const ev = new CustomEvent('state:changed', { detail });
    document.dispatchEvent(ev);
}
export const state = new Proxy(stateInternal, {
    set(target, prop, value) {
        const oldValue = target[prop];
        if (oldValue === value) return true;
        let syncType = null;
        if (prop === 'highlights') {
            syncType = 'highlights';
            if (typeof value === 'object' && value !== null) {
                value = new Proxy(value, {
                    set(highlightsTarget, ref, color) {
                        const oldColor = highlightsTarget[ref];
                        if (oldColor === color) return true;
                        if (!target._syncMeta.highlights[ref]) {
                            target._syncMeta.highlights[ref] = {};
                        }
                        target._syncMeta.highlights[ref].ts = Date.now();
                        const success = Reflect.set(highlightsTarget, ref, color);
                        if (success) {
                            saveToStorageImmediate();
                            emitStateChange('highlight', ref, oldColor, color);
                        }
                        return success;
                    },
                    deleteProperty(highlightsTarget, ref) {
                        const success = Reflect.deleteProperty(highlightsTarget, ref);
                        if (success) {
                            Reflect.deleteProperty(target._syncMeta.highlights, ref);
                            saveToStorageImmediate();
                            emitStateChange('highlight', ref, highlightsTarget[ref], undefined);
                        }
                        return success;
                    }
                });
            }
            emitStateChange('highlights', prop, oldValue, value);
        } else if (prop === 'notes') {
            target._syncMeta.notes = { ts: Date.now() };
            syncType = 'notes';
            emitStateChange('notes', prop, oldValue, value);
        } else if (prop === 'settings') {
            syncType = 'settings';
            if (typeof value === 'object' && value !== null) {
                const skipKeys = [
                    'collapsedSections', 'collapsedPanels', 'panelWidths', 
                    'referencePanelOpen', 'hotkeys', 'hotkeysEnabled', 
                    'currentPassageReference', 'audioPlayer', 'currentChapterData',
                    'myPeerId'
                ];
                Object.entries(value).forEach(([k, v]) => {
                    if (!skipKeys.includes(k) && (k in oldValue ? v !== oldValue[k] : v !== undefined)) {
                        if (!target._syncMeta.settings[k]) {
                            target._syncMeta.settings[k] = {};
                        }
                        target._syncMeta.settings[k].ts = Date.now();
                    }
                });
            }
            emitStateChange('settings', prop, oldValue, value);
        }
        const success = Reflect.set(target, prop, value);
        if (success && prop !== '_syncMeta') {
            saveToStorage();
        }
        return success;
    },
    get(target, prop) {
        if (prop === 'highlights') {
            const highlights = Reflect.get(target, prop);
            if (highlights && typeof highlights === 'object' && !highlights.__isProxy) {
                const proxied = new Proxy(highlights, {
                    set(highlightsTarget, ref, color) {
                        const oldColor = highlightsTarget[ref];
                        if (oldColor === color) return true;
                        if (!target._syncMeta.highlights[ref]) {
                            target._syncMeta.highlights[ref] = {};
                        }
                        target._syncMeta.highlights[ref].ts = Date.now();
                        const success = Reflect.set(highlightsTarget, ref, color);
                        if (success) {
                            saveToStorageImmediate();
                            emitStateChange('highlight', ref, oldColor, color);
                        }
                        return success;
                    },
                    deleteProperty(highlightsTarget, ref) {
                        const success = Reflect.deleteProperty(highlightsTarget, ref);
                        if (success) {
                            Reflect.deleteProperty(target._syncMeta.highlights, ref);
                            saveToStorageImmediate();
                            emitStateChange('highlight', ref, highlightsTarget[ref], undefined);
                        }
                        return success;
                    }
                });
                Object.defineProperty(proxied, '__isProxy', {
                    value: true,
                    enumerable: false
                });
                Reflect.set(target, prop, proxied);
                return proxied;
            }
        }
        return Reflect.get(target, prop);
    }
});
export function setHighlight(reference, color) {
    if (color === 'none' || !color) {
        delete state.highlights[reference];
        delete state._syncMeta.highlights[reference];
    } else {
        state.highlights[reference] = color;
        if (!state._syncMeta.highlights[reference]) {
            state._syncMeta.highlights[reference] = {};
        }
        state._syncMeta.highlights[reference].ts = Date.now();
    }
    saveToStorageImmediate();
    const ev = new CustomEvent('state:changed', { 
        detail: { 
            type: 'highlight', 
            reference, 
            color, 
            timestamp: Date.now() 
        } 
    });
    document.dispatchEvent(ev);
}
export function removeHighlight(reference) {
    setHighlight(reference, 'none');
}
export function formatBookNameForSource(bookName, source) {
    const book = bookName.toLowerCase();
    switch(source) {
        case 'biblecom': {
            const bibleComCodes = {
                genesis: 'GEN', exodus: 'EXO', leviticus: 'LEV', numbers: 'NUM',
                deuteronomy: 'DEU', joshua: 'JOS', judges: 'JDG', ruth: 'RUT',
                '1 samuel': '1SA', '2 samuel': '2SA', '1 kings': '1KI', '2 kings': '2KI',
                '1 chronicles': '1CH', '2 chronicles': '2CH', ezra: 'EZR', nehemiah: 'NEH',
                esther: 'EST', job: 'JOB', psalms: 'PSA', proverbs: 'PRO',
                ecclesiastes: 'ECC', 'song of solomon': 'SNG', isaiah: 'ISA', jeremiah: 'JER',
                lamentations: 'LAM', ezekiel: 'EZK', daniel: 'DAN', hosea: 'HOS',
                joel: 'JOL', amos: 'AMO', obadiah: 'OBA', jonah: 'JON',
                micah: 'MIC', nahum: 'NAM', habakkuk: 'HAB', zephaniah: 'ZEP',
                haggai: 'HAG', zechariah: 'ZEC', malachi: 'MAL', matthew: 'MAT',
                mark: 'MRK', luke: 'LUK', john: 'JHN', acts: 'ACT',
                romans: 'ROM', '1 corinthians': '1CO', '2 corinthians': '2CO', galatians: 'GAL',
                ephesians: 'EPH', philippians: 'PHP', colossians: 'COL', '1 thessalonians': '1TH',
                '2 thessalonians': '2TH', '1 timothy': '1TI', '2 timothy': '2TI', titus: 'TIT',
                philemon: 'PHM', hebrews: 'HEB', james: 'JAS', '1 peter': '1PE',
                '2 peter': '2PE', '1 john': '1JN', '2 john': '2JN', '3 john': '3JN',
                jude: 'JUD', revelation: 'REV'
            };
            return bibleComCodes[book] || book.substring(0, 3).toUpperCase();
        }
        case 'ebibleorg':
            return book === 'psalms' ? 'PS1' : book.substring(0, 3).toUpperCase() + '1';
        default:
            return book.replace(/\s+/g, '_');
    }
}
export function saveToStorage() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    try {
        const cleanState = {
            currentVerse: null,
            currentVerseData: state.currentVerseData,
            highlights: state.highlights,
            notes: state.notes,
            settings: { ...state.settings },
            hotkeys: { ...state.hotkeys },
            hotkeysEnabled: state.hotkeysEnabled,
            currentPassageReference: state.currentPassageReference,
            _syncMeta: state._syncMeta
        };
        localStorage.setItem('bibleStudyState', JSON.stringify(cleanState));
        saveToCookies();
    } catch (error) {
        console.error('Storage save error:', error);
        handleError(error, 'saveToStorage');
    }
}
export function loadFromStorage() {
    try {
        const raw = localStorage.getItem('bibleStudyState');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed.settings && typeof parsed.settings === 'object') {
            const validSettings = {
                bibleTranslation: AVAILABLE_TRANSLATIONS.includes(parsed.settings.bibleTranslation) ? parsed.settings.bibleTranslation : 'BSB',
                referenceVersion: parsed.settings.referenceVersion || 'NASB',
                footnotes: typeof parsed.settings.footnotes === 'object' ? parsed.settings.footnotes : {},
                audioControlsVisible: typeof parsed.settings.audioControlsVisible === 'boolean' ? parsed.settings.audioControlsVisible : true,
                audioNarrator: parsed.settings.audioNarrator || 'gilbert',
                manualBook: BOOK_ORDER.includes(parsed.settings.manualBook) ? parsed.settings.manualBook : BOOK_ORDER[0],
                manualChapter: Math.max(1, Math.min(150, parseInt(parsed.settings.manualChapter) || 1)),
                theme: ['light', 'dark'].includes(parsed.settings.theme) ? parsed.settings.theme : 'dark',
                colorTheme: parsed.settings.colorTheme || 'blue',
                notesView: ['text', 'markdown'].includes(parsed.settings.notesView) ? parsed.settings.notesView : 'text',
                referencePanelOpen: typeof parsed.settings.referencePanelOpen === 'boolean' ? parsed.settings.referencePanelOpen : true,
                referenceSource: ['biblegateway', 'biblecom', 'ebibleorg', 'stepbible'].includes(parsed.settings.referenceSource) ? parsed.settings.referenceSource : 'biblegateway',
                collapsedSections: typeof parsed.settings.collapsedSections === 'object' ? parsed.settings.collapsedSections : {},
                collapsedPanels: typeof parsed.settings.collapsedPanels === 'object' ? parsed.settings.collapsedPanels : {},
                panelWidths: {
                    sidebar: Math.max(200, Math.min(500, parseInt(parsed.settings.panelWidths?.sidebar) || 280)),
                    referencePanel: Math.max(250, Math.min(500, parseInt(parsed.settings.panelWidths?.referencePanel) || 350)),
                    scriptureSection: parsed.settings.panelWidths?.scriptureSection || null,
                    notesSection: Math.max(250, Math.min(500, parseInt(parsed.settings.panelWidths?.notesSection) || 350))
                },
                scriptureFontSize: Math.max(12, Math.min(32, parseInt(parsed.settings.scriptureFontSize) || 16)),
                notesFontSize: Math.max(12, Math.min(32, parseInt(parsed.settings.notesFontSize) || 16)),
                autoplayAudio: typeof parsed.settings.autoplayAudio === 'boolean' ? parsed.settings.autoplayAudio : true,
                footnotesCollapsed: typeof parsed.settings.footnotesCollapsed === 'boolean' ? parsed.settings.footnotesCollapsed : false,
                syncEnabled: typeof parsed.settings.syncEnabled === 'boolean' ? parsed.settings.syncEnabled : false,
                autoSync: typeof parsed.settings.autoSync === 'boolean' ? parsed.settings.autoSync : false,
                autoSync: parsed.settings.autoSync === true || parsed.settings.autoSync === false,
                connectedDevices: Array.isArray(parsed.settings.connectedDevices) ? parsed.settings.connectedDevices.map(d => ({
                    id: typeof d.id === 'string' ? d.id : '',
                    peerId: typeof d.peerId === 'string' && d.peerId.length === 8 ? d.peerId : d.id,
                    name: typeof d.name === 'string' ? d.name : 'Unknown',
                    customName: d.customName || null,
                    connectedAt: typeof d.connectedAt === 'number' ? d.connectedAt : Date.now(),
                    lastConnectedAt: typeof d.lastConnectedAt === 'number' ? d.lastConnectedAt : Date.now()
                })).filter(d => d.peerId && d.id) : [],
                myPeerId: typeof parsed.settings.myPeerId === 'string' && parsed.settings.myPeerId.length === 8 ? parsed.settings.myPeerId : null
            };
            Object.assign(stateInternal.settings, validSettings);
            if (parsed.hotkeys && typeof parsed.hotkeys === 'object') {
                stateInternal.hotkeys = { ...parsed.hotkeys };
            }
            stateInternal.hotkeysEnabled = parsed.hotkeysEnabled === true || false;
        }
        if (parsed.highlights && typeof parsed.highlights === 'object') {
            const tempHighlights = {};
            Object.entries(parsed.highlights).forEach(([ref, color]) => {
                if (typeof ref === 'string' && /^[^ ]+ \d+:\d+$/.test(ref) && 
                    ['yellow', 'orange', 'red', 'blue', 'green', 'purple', 'pink'].includes(color)) {
                tempHighlights[ref] = color;
                }
            });
            state.highlights = tempHighlights;
        }
        Object.keys(state.highlights).forEach(ref => {
            if (!state._syncMeta.highlights[ref]) {
                state._syncMeta.highlights[ref] = { 
                    ts: parsed._syncMeta?.highlights?.[ref]?.ts || Date.now() 
                };
            }
        });
        if (parsed.notes !== undefined && typeof parsed.notes === 'string') {
            stateInternal.notes = parsed.notes;
        }
        if (typeof parsed.currentPassageReference === 'string') {
            stateInternal.currentPassageReference = parsed.currentPassageReference;
        }
        if (parsed._syncMeta && typeof parsed._syncMeta === 'object') {
            stateInternal._syncMeta = {
                highlights: {},
                notes: null,
                settings: {}
            };
            if (parsed._syncMeta.highlights && typeof parsed._syncMeta.highlights === 'object') {
                Object.entries(parsed._syncMeta.highlights).forEach(([ref, meta]) => {
                    if (typeof ref === 'string' && meta && typeof meta === 'object' && typeof meta.ts === 'number') {
                        stateInternal._syncMeta.highlights[ref] = { ts: meta.ts };
                    }
                });
            }
            if (parsed._syncMeta.notes && typeof parsed._syncMeta.notes === 'object' && typeof parsed._syncMeta.notes.ts === 'number') {
                stateInternal._syncMeta.notes = { ts: parsed._syncMeta.notes.ts };
            }
            if (parsed._syncMeta.settings && typeof parsed._syncMeta.settings === 'object') {
                Object.entries(parsed._syncMeta.settings).forEach(([key, meta]) => {
                    if (typeof key === 'string' && meta && typeof meta === 'object' && typeof meta.ts === 'number') {
                        stateInternal._syncMeta.settings[key] = { ts: meta.ts };
                    }
                });
            }
        }
        const notesInput = document.getElementById('notesInput');
        if (notesInput) notesInput.value = stateInternal.notes;
    } catch (error) {
        console.error('Storage load error:', error);
        handleError(error, 'loadFromStorage');
        initializeDefaultState();
    }
}
function initializeDefaultState() {
    stateInternal.highlights = {};
    stateInternal.notes = '';
    stateInternal.currentPassageReference = '';
    stateInternal._syncMeta = { highlights: {}, notes: null, settings: {} };
}
export function saveToCookies() {
    try {
        const expiry = new Date();
        expiry.setFullYear(expiry.getFullYear() + COOKIE_LENGTH);
        const cookieSettings = {
            bibleTranslation: state.settings.bibleTranslation,
            referenceVersion: state.settings.referenceVersion,
            theme: state.settings.theme,
            colorTheme: state.settings.colorTheme,
            audioNarrator: state.settings.audioNarrator,
            audioControlsVisible: state.settings.audioControlsVisible,
            autoplayAudio: state.settings.autoplayAudio,
            syncEnabled: state.settings.syncEnabled,
            autoSync: state.settings.autoSync,
            myPeerId: state.settings.myPeerId,  
            manualBook: state.settings.manualBook,
            manualChapter: state.settings.manualChapter
        };
        const cookieData = encodeURIComponent(JSON.stringify(cookieSettings));
        const cookieParts = [
            `bibleStudySettings=${cookieData}`,
            `expires=${expiry.toUTCString()}`,
            'path=/',
            'SameSite=None',
            'Secure'
        ];
        document.cookie = cookieParts.join('; ');
    } catch (error) {
        console.error('Cookie save error:', error);
        handleError(error, 'saveToCookies');
    }
}
export function loadFromCookies() {
    try {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [key, value] = cookie.trim().split('=');
            if (key === 'bibleStudySettings') {
                const settings = JSON.parse(decodeURIComponent(value));
                if (settings && typeof settings === 'object') {
                    Object.assign(stateInternal.settings, {
                        bibleTranslation: AVAILABLE_TRANSLATIONS.includes(settings.bibleTranslation) ? settings.bibleTranslation : 'BSB',
                        referenceVersion: settings.referenceVersion || 'NASB',
                        theme: ['light', 'dark'].includes(settings.theme) ? settings.theme : 'dark',
                        colorTheme: settings.colorTheme || 'blue',
                        audioNarrator: settings.audioNarrator || 'gilbert',
                        audioControlsVisible: typeof settings.audioControlsVisible === 'boolean' ? settings.audioControlsVisible : true,
                        autoplayAudio: typeof settings.autoplayAudio === 'boolean' ? settings.autoplayAudio : true,
                        syncEnabled: typeof settings.syncEnabled === 'boolean' ? settings.syncEnabled : false,
                        autoSync: typeof settings.autoSync === 'boolean' ? settings.autoSync : false,
                        myPeerId: typeof settings.myPeerId === 'string' && settings.myPeerId.length === 8 ? settings.myPeerId : null,
                        manualBook: BOOK_ORDER.includes(settings.manualBook) ? settings.manualBook : BOOK_ORDER[0],
                        manualChapter: Math.max(1, parseInt(settings.manualChapter) || 1)
                    });
                }
                break;
            }
        }
    } catch (error) {
        console.error('Cookie load error:', error);
        handleError(error, 'loadFromCookies');
    }
}
export const bookNameMapping = {
    Genesis: 'GEN', Exodus: 'EXO', Leviticus: 'LEV', Numbers: 'NUM', Deuteronomy: 'DEU',
    Joshua: 'JOS', Judges: 'JDG', Ruth: 'RUT', '1 Samuel': '1SA', '2 Samuel': '2SA',
    '1 Kings': '1KI', '2 Kings': '2KI', '1 Chronicles': '1CH', '2 Chronicles': '2CH',
    Ezra: 'EZR', Nehemiah: 'NEH', Esther: 'EST', Job: 'JOB', Psalms: 'PSA',
    Proverbs: 'PRO', Ecclesiastes: 'ECC', 'Song of Solomon': 'SNG', Isaiah: 'ISA', Jeremiah: 'JER',
    Lamentations: 'LAM', Ezekiel: 'EZK', Daniel: 'DAN', Hosea: 'HOS', Joel: 'JOL',
    Amos: 'AMO', Obadiah: 'OBA', Jonah: 'JON', Micah: 'MIC', Nahum: 'NAM',
    Habakkuk: 'HAB', Zephaniah: 'ZEP', Haggai: 'HAG', Zechariah: 'ZEC', Malachi: 'MAL',
    Matthew: 'MAT', Mark: 'MRK', Luke: 'LUK', John: 'JHN', Acts: 'ACT',
    Romans: 'ROM', '1 Corinthians': '1CO', '2 Corinthians': '2CO', Galatians: 'GAL',
    Ephesians: 'EPH', Philippians: 'PHP', Colossians: 'COL', '1 Thessalonians': '1TH',
    '2 Thessalonians': '2TH', '1 Timothy': '1TI', '2 Timothy': '2TI', Titus: 'TIT',
    Philemon: 'PHM', Hebrews: 'HEB', James: 'JAS', '1 Peter': '1PE', '2 Peter': '2PE',
    '1 John': '1JN', '2 John': '2JN', '3 John': '3JN', Jude: 'JUD', Revelation: 'REV'
};
export const bibleHubUrlMap = {
    LSB: 'lsb', NASB1995: 'nasb', NASB: 'nasb_', ASV: 'asv', ESV: 'esv', 
    KJV: 'kjv', GNV: 'geneva', NKJV: 'nkjv', BSB: 'bsb', CSB: 'csb', 
    NET: 'net', NIV: 'niv', NLT: 'nlt'
};
export const bibleComUrlMap = {
    LSB: '3345', NASB1995: '100', NASB: '2692', ASV: '12', ESV: '59',
    KJV: '1', GNV: '2163', NKJV: '114', BSB: '3034', CSB: '1713',
    NET: '107', NIV: '111', NLT: '116'
};
export const ebibleOrgUrlMap = {
    NASB1995: 'local:engnasb', ASV: 'local:eng-asv', KJV: 'local:eng-kjv2006',
    GNV: 'local:enggnv', BSB: 'local:engbsb', NET: 'local:engnet'
};
export const stepBibleUrlMap = {
    LSB: 'LSB', NASB1995: 'NASB1995', NASB: 'NASB2020', ASV: 'ASV',
    ESV: 'ESV', KJV: 'KJV', GNV: 'Gen', BSB: 'BSB', NET: 'NET2full', NIV: 'NIV'
};
function getBibleGatewayVersionCode(appTranslation) {
    const versionMap = {
        LSB: 'LSB', NASB1995: 'NASB1995', NASB: 'NASB', ASV: 'ASV',
        ESV: 'ESV', KJV: 'KJV', GNV: 'GNV', NKJV: 'NKJV', BSB: 'BSB',
        CSB: 'CSB', NET: 'NET', NIV: 'NIV', NLT: 'NLT'
    };
    return versionMap[appTranslation] || 'NASB1995';
}
export function updateBibleGatewayVersion() {
    try {
        const versionCode = getBibleGatewayVersionCode(state.settings.referenceVersion);
        const versionInput = document.getElementById('bgVersion');
        if (versionInput) {
            versionInput.value = versionCode === 'BSB' ? 'NASB1995' : versionCode;
        }
    } catch (error) {
        console.error('Bible Gateway version update error:', error);
        handleError(error, 'updateBibleGatewayVersion');
    }
}
export function updateURL(translation, book, chapter, action = 'push') {
    try {
        const cleanTranslation = translation.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const bookAbbr = BOOK_NAME_TO_ABBREVIATION[book];
        if (!bookAbbr) {
            console.warn('Invalid book name:', book);
            return;
        }
        const cleanBook = bookAbbr.toLowerCase();
        const cleanChapter = Math.max(1, parseInt(chapter) || 1);
        const newQuery = `?p=${cleanTranslation}/${cleanBook}/${cleanChapter}`;
        const newState = { translation, book, chapter };
        if (action === 'replace') {
            window.history.replaceState(newState, '', newQuery);
        } else {
            window.history.pushState(newState, '', newQuery);
        }
    } catch (error) {
        console.error('URL update error:', error);
        handleError(error, 'updateURL');
    }
}
export function parseURL() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const path = urlParams.get('p');
        if (!path) return null;
        const pathParts = path.split('/').filter(part => part !== '');
        if (pathParts.length >= 3) {
            const translation = pathParts[0].toUpperCase();
            const bookAbbreviation = pathParts[1].toUpperCase();
            const chapter = parseInt(pathParts[2], 10);
            const book = ABBREVIATION_TO_BOOK_NAME[bookAbbreviation];
            if (!book) {
                console.warn('Invalid book abbreviation:', bookAbbreviation);
                return null;
            }
            if (!AVAILABLE_TRANSLATIONS.includes(translation)) {
                console.warn('Invalid translation:', translation);
                return null;
            }
            if (isNaN(chapter) || chapter <= 0 || chapter > CHAPTER_COUNTS[book]) {
                console.warn('Invalid chapter:', chapter);
                return null;
            }
            return { translation, book, chapter };
        }
        return null;
    } catch (error) {
        console.error('URL parse error:', error);
        handleError(error, 'parseURL');
        return null;
    }
}