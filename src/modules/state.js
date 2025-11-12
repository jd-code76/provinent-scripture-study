/*=====================================================================
  Provinent Scripture Study – state.js
=====================================================================*/

/* Global imports */
import { handleError } from '../main.js'

/* Global constants */
export const APP_VERSION = '1.3.2025.11.11';
let saveTimeout = null;
const SAVE_DEBOUNCE_MS = 500;

/**
 * BOOK_ORDER
 * Complete list of all 66 Bible books in canonical order
 * Used for populating dropdowns and navigation
 */
export const BOOK_ORDER = [
    // Old Testament - Pentateuch (5 books)
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    
    // Old Testament - Historical Books (12 books)
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
    '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther',
    
    // Old Testament - Wisdom Literature (5 books)
    'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
    
    // Old Testament - Major Prophets (5 books)
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
    
    // Old Testament - Minor Prophets (12 books)
    'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum',
    'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    
    // New Testament - Gospels (4 books)
    'Matthew', 'Mark', 'Luke', 'John',
    
    // New Testament - History (1 book)
    'Acts',
    
    // New Testament - Pauline Epistles (13 books)
    'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
    'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
    
    // New Testament - General Epistles (8 books)
    'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude',
    
    // New Testament - Apocalyptic (1 book)
    'Revelation'
];

/**
 * CHAPTER_COUNTS
 * Number of chapters in each book (for validation and navigation)
 */
export const CHAPTER_COUNTS = {
    // Pentateuch
    Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34,
    
    // Historical Books
    Joshua: 24, Judges: 21, Ruth: 4, '1 Samuel': 31, '2 Samuel': 24,
    '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
    Ezra: 10, Nehemiah: 13, Esther: 10,
    
    // Wisdom Literature
    Job: 42, Psalms: 150, Proverbs: 31, Ecclesiastes: 12, 'Song of Solomon': 8,
    
    // Major Prophets
    Isaiah: 66, Jeremiah: 52, Lamentations: 5, Ezekiel: 48, Daniel: 12,
    
    // Minor Prophets
    Hosea: 14, Joel: 3, Amos: 9, Obadiah: 1, Jonah: 4, Micah: 7,
    Nahum: 3, Habakkuk: 3, Zephaniah: 3, Haggai: 2, Zechariah: 14, Malachi: 4,
    
    // Gospels
    Matthew: 28, Mark: 16, Luke: 24, John: 21,
    
    // Acts
    Acts: 28,
    
    // Pauline Epistles
    Romans: 16, '1 Corinthians': 16, '2 Corinthians': 13, Galatians: 6,
    Ephesians: 6, Philippians: 4, Colossians: 4, '1 Thessalonians': 5,
    '2 Thessalonians': 3, '1 Timothy': 6, '2 Timothy': 4, Titus: 3, Philemon: 1,
    
    // General Epistles
    Hebrews: 13, James: 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5,
    '2 John': 1, '3 John': 1, Jude: 1,
    
    // Revelation
    Revelation: 22
};

/**
 * BOOKS_ABBREVIATED
 * Array of Bible book abbreviations for URL validation
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
 * AVAILABLE_TRANSLATIONS
 * Supported Bible translations for URL validation
 */
export const AVAILABLE_TRANSLATIONS = [
    'ASV', 'KJV', 'GNV', 'BSB', 'NET'
];

// Add to state.js - Simple mapping between abbreviations and full names
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

/* ====================================================================
   APPLICATION STATE
   Central state object holding all app data and settings
   This object is saved to localStorage and restored on app load
==================================================================== */
export const state = {
    // Current verse selection
    currentVerse: null,
    currentVerseData: null,
    
    // User data
    highlights: {},
    notes: '',
    
    // Application settings
    settings: {
        // Bible translations
        bibleTranslation: 'BSB',
        referenceVersion: 'NASB1995',
        footnotes: {},
        
        // Audio settings
        audioNarrator: 'gilbert',
        
        // Manual navigation only
        manualBook: BOOK_ORDER[0],
        manualChapter: 1,
        
        // UI preferences
        theme: 'dark',
        colorTheme: 'blue',
        notesView: 'text',
        
        // Panel states
        referencePanelOpen: false,
        referenceSource: 'biblegateway',
        collapsedSections: {},
        collapsedPanels: {},
        
        // Panel dimensions
        panelWidths: {
            sidebar: 280,
            referencePanel: 400,
            scriptureSection: null,
            notesSection: 400
        }
    },

    // Runtime state
    currentPassageReference: '',
    
    // Audio state
    audioPlayer: null,
    
    // Current chapter data for audio
    currentChapterData: null
};

/* ====================================================================
   BOOK FORMATTING
   Static data defining the structure of the Bible
==================================================================== */

/* Proper book name formats for other reference Bibles. */
export function formatBookNameForSource(bookName, source) {
    const book = bookName.toLowerCase();
    
    switch(source) {
        case 'biblecom':
            // Bible.com uses specific book codes that don't always match standard abbreviations
            const bibleComCodes = {
                'genesis': 'GEN', 'exodus': 'EXO', 'leviticus': 'LEV', 'numbers': 'NUM',
                'deuteronomy': 'DEU', 'joshua': 'JOS', 'judges': 'JDG', 'ruth': 'RUT',
                '1 samuel': '1SA', '2 samuel': '2SA', '1 kings': '1KI', '2 kings': '2KI',
                '1 chronicles': '1CH', '2 chronicles': '2CH', 'ezra': 'EZR', 'nehemiah': 'NEH',
                'esther': 'EST', 'job': 'JOB', 'psalms': 'PSA', 'proverbs': 'PRO',
                'ecclesiastes': 'ECC', 'song of solomon': 'SNG', 'isaiah': 'ISA', 'jeremiah': 'JER',
                'lamentations': 'LAM', 'ezekiel': 'EZK', 'daniel': 'DAN', 'hosea': 'HOS',
                'joel': 'JOL', 'amos': 'AMO', 'obadiah': 'OBA', 'jonah': 'JON',
                'micah': 'MIC', 'nahum': 'NAM', 'habakkuk': 'HAB', 'zephaniah': 'ZEP',
                'haggai': 'HAG', 'zechariah': 'ZEC', 'malachi': 'MAL', 'matthew': 'MAT',
                'mark': 'MRK', 'luke': 'LUK', 'john': 'JHN', 'acts': 'ACT',
                'romans': 'ROM', '1 corinthians': '1CO', '2 corinthians': '2CO', 'galatians': 'GAL',
                'ephesians': 'EPH', 'philippians': 'PHP', 'colossians': 'COL', '1 thessalonians': '1TH',
                '2 thessalonians': '2TH', '1 timothy': '1TI', '2 timothy': '2TI', 'titus': 'TIT',
                'philemon': 'PHM', 'hebrews': 'HEB', 'james': 'JAS', '1 peter': '1PE',
                '2 peter': '2PE', '1 john': '1JN', '2 john': '2JN', '3 john': '3JN',
                'jude': 'JUD', 'revelation': 'REV'
            };
            return bibleComCodes[book] || book.substring(0, 3).toUpperCase();
            
        case 'ebibleorg':
            // eBible.org uses specific referencing
            if (book === 'psalms') return 'PS1';
            return book.substring(0, 3).toUpperCase() + '1';
            
        default:
            return book.replace(/\s+/g, '_');
    }
}

/* ====================================================================
   PERSISTENCE
   Save and load state from localStorage and cookies
==================================================================== */

/* Save current state to localStorage */
export function saveToStorage() {
    // Cancel pending save
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    // Debounce the save operation
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
        } catch (e) {
            console.error('Storage error:', e);
        }
    }, SAVE_DEBOUNCE_MS);
}

/* Load state from localStorage */
export function loadFromStorage() {
    const raw = localStorage.getItem('bibleStudyState');
    if (!raw) return;
    
    try {
        const parsed = JSON.parse(raw);
        Object.assign(state, parsed);
        document.getElementById('notesInput').value = state.notes;
    } catch (e) {
        handleError(e, 'loadFromStorage');
    }
}

/* Save critical settings to cookies (10-year expiry) */
export function saveToCookies() {
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 10);
    
    const cookieVal = encodeURIComponent(JSON.stringify({
        ...state.settings
    }));
    
    document.cookie = `bibleStudySettings=${cookieVal}; expires=${exp.toUTCString()}; path=/; SameSite=Strict`;
}

/* Load settings from cookies */
export function loadFromCookies() {
    const pairs = document.cookie.split(';');
    for (let pair of pairs) {
        const [k, v] = pair.trim().split('=');
        if (k === 'bibleStudySettings') {
            try {
                const settings = JSON.parse(decodeURIComponent(v));
                Object.assign(state.settings, settings);
            } catch (e) {
                console.error('Cookie parse error:', e);
            }
        }
    }
}

/* ====================================================================
   BOOK-NAME MAPPINGS
   API book code mappings
==================================================================== */

/**
 * bookNameMapping
 * Maps display names to USFM/API book codes
 * Reference: https://ubsicap.github.io/usfm/identification/books.html
 */
export const bookNameMapping = {
    // Old Testament
    Genesis: 'GEN', Exodus: 'EXO', Leviticus: 'LEV', Numbers: 'NUM', Deuteronomy: 'DEU',
    Joshua: 'JOS', Judges: 'JDG', Ruth: 'RUT', '1 Samuel': '1SA', '2 Samuel': '2SA',
    '1 Kings': '1KI', '2 Kings': '2KI', '1 Chronicles': '1CH', '2 Chronicles': '2CH',
    Ezra: 'EZR', Nehemiah: 'NEH', Esther: 'EST', Job: 'JOB', Psalms: 'PSA',
    Proverbs: 'PRO', Ecclesiastes: 'ECC', 'Song of Solomon': 'SNG', Isaiah: 'ISA', Jeremiah: 'JER',
    Lamentations: 'LAM', Ezekiel: 'EZK', Daniel: 'DAN', Hosea: 'HOS', Joel: 'JOL',
    Amos: 'AMO', Obadiah: 'OBA', Jonah: 'JON', Micah: 'MIC', Nahum: 'NAM',
    Habakkuk: 'HAB', Zephaniah: 'ZEP', Haggai: 'HAG', Zechariah: 'ZEC', Malachi: 'MAL',
    
    // New Testament
    Matthew: 'MAT', Mark: 'MRK', Luke: 'LUK', John: 'JHN', Acts: 'ACT',
    Romans: 'ROM', '1 Corinthians': '1CO', '2 Corinthians': '2CO', Galatians: 'GAL',
    Ephesians: 'EPH', Philippians: 'PHP', Colossians: 'COL', '1 Thessalonians': '1TH',
    '2 Thessalonians': '2TH', '1 Timothy': '1TI', '2 Timothy': '2TI', Titus: 'TIT',
    Philemon: 'PHM', Hebrews: 'HEB', James: 'JAS', '1 Peter': '1PE', '2 Peter': '2PE',
    '1 John': '1JN', '2 John': '2JN', '3 John': '3JN', Jude: 'JUD', Revelation: 'REV'
};

/* Bible Hub translation URL mappings */
export const bibleHubUrlMap = {
    'NASB1995': 'nasb',      // Bible Hub uses 'nasb' for NASB 1995
    'NASB': 'nasb_',         // Bible Hub uses 'nasb_' for NASB 2020
    'ASV': 'asv',            // American Standard Version
    'ESV': 'esv',            // English Standard Version
    'KJV': 'kjv',            // King James Version
    'NKJV': 'nkjv',          // New King James Version
    'BSB': 'bsb',            // Berean Standard Bible
    'CSB': 'csb',            // Christian Standard Bible
    'NET': 'net',             // New English Translation
    'NIV': 'niv',            // New International Version
    'NLT': 'nlt'            // New Living Translation
    // GNV not supported
};

/* Bible.com (YouVersion) translation URL mappings */
export const bibleComUrlMap = {
    'NASB1995': '100',
    'NASB': '2692',
    'ASV': '12',
    'ESV': '59',
    'KJV': '1',
    'GNV': '2163',
    'NKJV': '114',
    'BSB': '3034',
    'CSB': '1713',
    'NET': '107',
    'NIV': '111',
    'NLT': '116'
};

/* eBible.org translation URL mappings */
export const ebibleOrgUrlMap = {
    'NASB1995': 'local:engnasb',
    'ASV': 'local:eng-asv',
    'KJV': 'local:eng-kjv2006',
    'GNV': 'local:enggnv',
    'BSB': 'local:engbsb',
    'NET': 'local:engnet'
    // NASB, ESV, NKJV, CSB, NIV, NLT not supported
};

/* STEP Bible translation URL mappings */
export const stepBibleUrlMap = {
    'NASB1995': 'NASB1995',
    'NASB': 'NASB2020',
    'ASV': 'ASV',
    'ESV': 'ESV',
    'KJV': 'KJV',
    'GNV': 'Gen',           // Geneva Bible
    'BSB': 'BSB',
    'NET': 'NET2full',      // NET Bible
    'NIV': 'NIV'
    // NKJV, CSB, NLT not supported
};

/* Version map for Bible Gateway search button */
function getBibleGatewayVersionCode(appTranslation) {
    const versionMap = {
        'NASB1995': 'NASB1995',
        'NASB': 'NASB',
        'ASV': 'ASV',
        'ESV': 'ESV', 
        'KJV': 'KJV',
        'GNV': 'GNV',
        'NKJV': 'NKJV',
        'BSB': 'BSB',
        'CSB': 'CSB',
        'NET': 'NET',
        'NIV': 'NIV',
        'NLT': 'NLT'
    };
    return versionMap[appTranslation] || 'NASB1995'; // fallback to NASB1995
}

/* For updating translation of Bible Gateway search in the sidebar */
export function updateBibleGatewayVersion() {
    const versionCode = getBibleGatewayVersionCode(state.settings.referenceVersion);
    const versionInput = document.getElementById('bgVersion');
    
    if (versionCode === 'BSB') {
        versionInput.value = 'NASB1995';
    } else {
        versionInput.value = versionCode;
    }
}

/* ====================================================================
   URL UPDATES AND PARSING
   Handle navigation via URL parameters
==================================================================== */

/**
 * Update URL to reflect current translation, book, and chapter
 * @param {string} translation - Bible translation code (e.g., 'BSB')
 * @param {string} book - Book name (e.g., 'GEN')
 * @param {number} chapter - Chapter number
 */
export function updateURL(translation, book, chapter) {
    const cleanTranslation = translation.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    const bookAbbr = BOOK_NAME_TO_ABBREVIATION[book];
    if (!bookAbbr) {
        console.warn('No abbreviation found for book:', book);
        return;
    }
    
    const cleanBook = bookAbbr.toLowerCase();
    const cleanChapter = Math.max(1, parseInt(chapter) || 1);
    const newQuery = `?p=${cleanTranslation}/${cleanBook}/${cleanChapter}`;
    const newState = { translation, book, chapter };
    
    window.history.pushState(newState, '', newQuery);
}

/**
 * Parse URL parameters to extract translation, book, and chapter
 * @returns {Object|null} Object with translation, book, chapter or null if invalid
 */
export function parseURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const path = urlParams.get('p');
    
    if (!path) {
        return null;
    }
    
    const pathParts = path.split('/').filter(part => part !== '');
    
    if (pathParts.length >= 3) {
        const translation = pathParts[0].toUpperCase();
        let bookAbbreviation = pathParts[1].toUpperCase();
        const chapter = parseInt(pathParts[2], 10);
        
        const book = ABBREVIATION_TO_BOOK_NAME[bookAbbreviation];
        
        if (!book) {
            console.warn('Invalid book abbreviation in query:', bookAbbreviation);
            return null;
        }
        
        if (!AVAILABLE_TRANSLATIONS.includes(translation)) {
            console.warn('Invalid translation in query:', translation);
            return null;
        }
        
        if (isNaN(chapter) || chapter <= 0 || chapter > 150) {
            console.warn('Invalid chapter in query:', chapter);
            return null;
        }
        
        return { translation, book, chapter };
    }
    
    return null;
}
