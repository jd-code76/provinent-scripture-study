/*=====================================================================
  Provinent Scripture Study – state.js
  Central state management and data structures
=====================================================================*/

import { handleError } from '../main.js';

/* ====================================================================
   CONSTANTS
==================================================================== */

export const APP_VERSION = '1.8.2025.11.18';
const SAVE_DEBOUNCE_MS = 500;
const COOKIE_LENGTH = 10;
let saveTimeout = null;

/**
 * BOOK_ORDER - Canonical order of all 66 Bible books
 */
export const BOOK_ORDER = [
    // Pentateuch (5)
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    
    // Historical Books (12)
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
    '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther',
    
    // Wisdom Literature (5)
    'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
    
    // Major Prophets (5)
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
    
    // Minor Prophets (12)
    'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum',
    'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    
    // Gospels (4)
    'Matthew', 'Mark', 'Luke', 'John',
    
    // History (1)
    'Acts',
    
    // Pauline Epistles (13)
    'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
    'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
    
    // General Epistles (8)
    'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude',
    
    // Apocalyptic (1)
    'Revelation'
];

/**
 * CHAPTER_COUNTS - Number of chapters per book
 */
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

/**
 * BOOKS_ABBREVIATED - Standard book abbreviations
 */
export const BOOKS_ABBREVIATED = [
    'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', 
    '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 
    'LAM', 'EZE', 'DAN', 'HOS', 'JOE', 'AMO', 'OBA', 'JON', 'MIC', 'NAH', 'HAB', 'ZEP', 
    'HAG', 'ZEC', 'MAL', 'MAT', 'MAR', 'LUK', 'JOH', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 
    'EPH', 'PHI', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAM', '1PE', 
    '2PE', '1JO', '2JO', '3JO', 'JUD', 'REV'
];

/**
 * AVAILABLE_TRANSLATIONS - Supported Bible translations
 */
export const AVAILABLE_TRANSLATIONS = ['ASV', 'KJV', 'GNV', 'BSB', 'NET'];

/**
 * Book abbreviation to name mapping
 */
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

/**
 * Book name to abbreviation mapping
 */
export const BOOK_NAME_TO_ABBREVIATION = Object.fromEntries(
    Object.entries(ABBREVIATION_TO_BOOK_NAME).map(([abbr, name]) => [name, abbr])
);

/* ====================================================================
   APPLICATION STATE
   Central state object for app data and settings
==================================================================== */
export const state = {
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
        fontSize: 16
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
        toggleAudio: { key: 'p', altKey: true, shiftKey: false, ctrlKey: false }
    },
    
    hotkeysEnabled: true,
    currentPassageReference: '',
    audioPlayer: null,
    currentChapterData: null
};

/* ====================================================================
   BOOK FORMATTING
   Source-specific book name formatting
==================================================================== */

/**
 * Format book name for specific reference source
 * @param {string} bookName - Full book name
 * @param {string} source - Reference source
 * @returns {string} - Formatted book identifier
 */
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

/* ====================================================================
   PERSISTENCE
   State save/load operations
==================================================================== */

/**
 * Save state to localStorage with debouncing
 */
export function saveToStorage() {
    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(() => {
        try {
            const cleanState = {
                currentVerse: null,
                currentVerseData: state.currentVerseData,
                highlights: state.highlights,
                notes: state.notes,
                settings: { ...state.settings },
                currentPassageReference: state.currentPassageReference
            };
            
            localStorage.setItem('bibleStudyState', JSON.stringify(cleanState));
            saveToCookies();
        } catch (error) {
            console.error('Storage save error:', error);
            handleError(error, 'saveToStorage');
        }
    }, SAVE_DEBOUNCE_MS);
}

/**
 * Load state from localStorage
 */
export function loadFromStorage() {
    try {
        const raw = localStorage.getItem('bibleStudyState');
        if (!raw) return;
        
        const parsed = JSON.parse(raw);
        
        if (parsed.settings) {
            state.settings = { ...state.settings, ...parsed.settings };
        }
        
        if (parsed.highlights) {
            state.highlights = parsed.highlights;
        }
        
        if (parsed.notes !== undefined) {
            state.notes = parsed.notes;
        }
        
        if (parsed.currentPassageReference !== undefined) {
            state.currentPassageReference = parsed.currentPassageReference;
        }
        
        const notesInput = document.getElementById('notesInput');
        if (notesInput) notesInput.value = state.notes;
        
    } catch (error) {
        console.error('Storage load error:', error);
        handleError(error, 'loadFromStorage');
    }
}

/**
 * Save critical settings to cookies
 */
export function saveToCookies() {
    try {
        const expiry = new Date();
        expiry.setFullYear(expiry.getFullYear() + COOKIE_LENGTH);
        
        const cookieData = encodeURIComponent(JSON.stringify({
            ...state.settings
        }));
        
        document.cookie = `bibleStudySettings=${cookieData}; expires=${expiry.toUTCString()}; path=/; SameSite=Strict`;
    } catch (error) {
        console.error('Cookie save error:', error);
        handleError(error, 'saveToCookies');
    }
}

/**
 * Load settings from cookies
 */
export function loadFromCookies() {
    try {
        const cookies = document.cookie.split(';');
        
        for (let cookie of cookies) {
            const [key, value] = cookie.trim().split('=');
            if (key === 'bibleStudySettings') {
                const settings = JSON.parse(decodeURIComponent(value));
                Object.assign(state.settings, settings);
                break;
            }
        }
    } catch (error) {
        console.error('Cookie load error:', error);
        handleError(error, 'loadFromCookies');
    }
}

/* ====================================================================
   BOOK-NAME MAPPINGS
   API and reference source mappings
==================================================================== */

/**
 * USFM/API book code mappings
 */
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

/**
 * Bible Hub translation URL mappings
 */
export const bibleHubUrlMap = {
    LSB: 'lsb',
    NASB1995: 'nasb',
    NASB: 'nasb_',
    ASV: 'asv', 
    ESV: 'esv', 
    KJV: 'kjv', 
    GNV: 'geneva',
    NKJV: 'nkjv', 
    BSB: 'bsb', 
    CSB: 'csb', 
    NET: 'net', 
    NIV: 'niv', 
    NLT: 'nlt'
};

/**
 * Bible.com translation URL mappings
 */
export const bibleComUrlMap = {
    LSB: '3345',
    NASB1995: '100',
    NASB: '2692',
    ASV: '12',
    ESV: '59',
    KJV: '1',
    GNV: '2163',
    NKJV: '114',
    BSB: '3034',
    CSB: '1713',
    NET: '107',
    NIV: '111',
    NLT: '116'
};

/**
 * eBible.org translation URL mappings
 */
export const ebibleOrgUrlMap = {
    NASB1995: 'local:engnasb',
    ASV: 'local:eng-asv',
    KJV: 'local:eng-kjv2006',
    GNV: 'local:enggnv',
    BSB: 'local:engbsb',
    NET: 'local:engnet'
};

/**
 * STEP Bible translation URL mappings
 */
export const stepBibleUrlMap = {
    LSB: 'LSB',
    NASB1995: 'NASB1995',
    NASB: 'NASB2020',
    ASV: 'ASV',
    ESV: 'ESV',
    KJV: 'KJV',
    GNV: 'Gen',
    BSB: 'BSB',
    NET: 'NET2full',
    NIV: 'NIV'
};

/**
 * Bible Gateway version code mapping
 * @param {string} appTranslation - App translation code
 * @returns {string} Bible Gateway version code
 */
function getBibleGatewayVersionCode(appTranslation) {
    const versionMap = {
        LSB: 'LSB',
        NASB1995: 'NASB1995',
        NASB: 'NASB',
        ASV: 'ASV',
        ESV: 'ESV', 
        KJV: 'KJV',
        GNV: 'GNV',
        NKJV: 'NKJV',
        BSB: 'BSB',
        CSB: 'CSB',
        NET: 'NET',
        NIV: 'NIV',
        NLT: 'NLT'
    };
    return versionMap[appTranslation] || 'NASB1995';
}

/**
 * Update Bible Gateway version in UI
 */
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

/* ====================================================================
   URL HANDLING
   URL parsing and updating
==================================================================== */

/**
 * Update URL with current navigation state and manage history
 * @param {string} translation - Bible translation
 * @param {string} book - Book name
 * @param {number} chapter - Chapter number
 * @param {number} verse - Verse number (optional)
 * @param {string} action - History action ('push' or 'replace')
 */
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
        
        const newState = { 
            translation, 
            book, 
            chapter
        };
        
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

/**
 * Parse URL parameters for navigation
 * @returns {Object|null} - Parsed navigation data or null
 */
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
            
            if (isNaN(chapter) || chapter <= 0 || chapter > 150) {
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
