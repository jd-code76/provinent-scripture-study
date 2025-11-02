import { handleError } from '../main.js'
import { loadPDFFromIndexedDB } from './pdf.js'
export const APP_VERSION = '1.0.2025.11.01';
let saveTimeout = null;
const SAVE_DEBOUNCE_MS = 500;
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
export const state = {
    currentVerse: null,                 
    currentVerseData: null,             
    highlights: {},                     
    notes: '',                          // User's study notes (plain text/markdown)
    settings: {
        bibleTranslation: 'BSB',        
        referenceVersion: 'NASB1995',   
        footnotes: {},                  
        passageType: 'default',         
        readingMode: 'readingPlan',     // 'readingPlan' | 'manual'
        manualBook: BOOK_ORDER[0],      
        manualChapter: 1,               
        lastUpdate: null,               
        currentPassageIndex: 0,         
        theme: 'light',                 // 'light' | 'dark'
        colorTheme: 'blue',             
        notesView: 'text',              // 'text' | 'markdown'
        hasSeenWelcome: false,          
        referencePanelOpen: false,      
        referenceSource: 'biblegateway',// 'biblegateway' | 'biblehub' | 'pdf'
        collapsedSections: {},          
        collapsedPanels: {},            
        panelWidths: {
            sidebar: 280,
            referencePanel: 400,
            scriptureSection: null,     
            notesSection: 400
        },
        customPdf: null,                
        pdfZoom: 1                      
    },
    currentPassageReference: '',        
    pdf: {
        doc: null,                      
        currentPage: 1,                 
        renderTask: null,               
        zoomLevel: 1                    
    },
    welcomePdfFile: null                
};
export function formatBookNameForSource(bookName, source) {
    const book = bookName.toLowerCase();
    switch(source) {
        case 'biblecom':
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
            if (book === 'psalms') return 'PS1';
            return book.substring(0, 3).toUpperCase() + '1';
        default:
            return book.replace(/\s+/g, '_');
    }
}
export function saveToStorage() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
        try {
            const cleanState = {
                currentVerse: null,
                currentVerseData: state.currentVerseData,
                highlights: state.highlights,
                notes: state.notes,
                settings: { ...state.settings },
                currentPassageReference: state.currentPassageReference,
                pdf: {
                    currentPage: state.pdf.currentPage,
                    zoomLevel: state.pdf.zoomLevel
                },
                welcomePdfFile: null
            };
            if (cleanState.settings.customPdf && cleanState.settings.customPdf.data) {
                const { data, ...meta } = cleanState.settings.customPdf;
                cleanState.settings.customPdf = { ...meta, storedInDB: true };
            }
            localStorage.setItem('bibleStudyState', JSON.stringify(cleanState));
            saveToCookies();
        } catch (e) {
            console.error('Storage error:', e);
        }
    }, SAVE_DEBOUNCE_MS);
}
export async function loadFromStorage() {
    const raw = localStorage.getItem('bibleStudyState');
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        Object.assign(state, parsed);
        if (parsed.pdf) {
            state.pdf.currentPage = parsed.pdf.currentPage || 1;
            state.pdf.zoomLevel = parsed.pdf.zoomLevel || state.settings.pdfZoom;
        }
        if (state.settings.customPdf && state.settings.customPdf.storedInDB) {
            const pdfMeta = await loadPDFFromIndexedDB();
            if (!pdfMeta) {
                console.warn('PDF metadata present but DB entry missing');
                state.settings.customPdf = null;
            }
        }
        document.getElementById('notesInput').value = state.notes;
    } catch (e) {
        handleError(err, 'loadFromStorage');
    }
}
export function saveToCookies() {
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 10);
    const cookieVal = encodeURIComponent(JSON.stringify({
        ...state.settings,
        customPdf: undefined
    }));
    document.cookie = `bibleStudySettings=${cookieVal}; expires=${exp.toUTCString()}; path=/; SameSite=Strict`;
}
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
export const readingPlan = [
    { book: 'Genesis', chapter: 1, startVerse: 1, endVerse: 31, displayRef: 'Genesis 1' },
    { book: 'Genesis', chapter: 2, startVerse: 1, endVerse: 25, displayRef: 'Genesis 2' },
    { book: 'Genesis', chapter: 3, startVerse: 1, endVerse: 24, displayRef: 'Genesis 3' },
    { book: 'Genesis', chapter: 6, startVerse: 5, endVerse: 22, displayRef: 'Genesis 6:5-22' },
    { book: 'Genesis', chapter: 12, startVerse: 1, endVerse: 9, displayRef: 'Genesis 12:1-9' },
    { book: 'Genesis', chapter: 22, startVerse: 1, endVerse: 19, displayRef: 'Genesis 22:1-19' },
    { book: 'Exodus', chapter: 3, startVerse: 1, endVerse: 22, displayRef: 'Exodus 3' },
    { book: 'Exodus', chapter: 20, startVerse: 1, endVerse: 21, displayRef: 'Exodus 20:1-21' },
    { book: 'Leviticus', chapter: 19, startVerse: 1, endVerse: 18, displayRef: 'Leviticus 19:1-18' },
    { book: 'Numbers', chapter: 14, startVerse: 1, endVerse: 38, displayRef: 'Numbers 14:1-38' },
    { book: 'Deuteronomy', chapter: 6, startVerse: 1, endVerse: 25, displayRef: 'Deuteronomy 6' },
    { book: 'Deuteronomy', chapter: 30, startVerse: 1, endVerse: 20, displayRef: 'Deuteronomy 30' },
    { book: 'Joshua', chapter: 1, startVerse: 1, endVerse: 9, displayRef: 'Joshua 1:1-9' },
    { book: 'Judges', chapter: 2, startVerse: 6, endVerse: 23, displayRef: 'Judges 2:6-23' },
    { book: 'Ruth', chapter: 1, startVerse: 1, endVerse: 22, displayRef: 'Ruth 1' },
    { book: '1 Samuel', chapter: 16, startVerse: 1, endVerse: 13, displayRef: '1 Samuel 16:1-13' },
    { book: '2 Samuel', chapter: 7, startVerse: 1, endVerse: 29, displayRef: '2 Samuel 7' },
    { book: '1 Kings', chapter: 18, startVerse: 1, endVerse: 46, displayRef: '1 Kings 18' },
    { book: '2 Kings', chapter: 22, startVerse: 1, endVerse: 20, displayRef: '2 Kings 22' },
    { book: 'Ezra', chapter: 1, startVerse: 1, endVerse: 11, displayRef: 'Ezra 1' },
    { book: 'Nehemiah', chapter: 1, startVerse: 1, endVerse: 11, displayRef: 'Nehemiah 1' },
    { book: 'Esther', chapter: 4, startVerse: 1, endVerse: 17, displayRef: 'Esther 4' },
    { book: 'Job', chapter: 1, startVerse: 1, endVerse: 22, displayRef: 'Job 1' },
    { book: 'Psalms', chapter: 1, startVerse: 1, endVerse: 6, displayRef: 'Psalm 1' },
    { book: 'Psalms', chapter: 19, startVerse: 1, endVerse: 14, displayRef: 'Psalm 19' },
    { book: 'Psalms', chapter: 23, startVerse: 1, endVerse: 6, displayRef: 'Psalm 23' },
    { book: 'Psalms', chapter: 51, startVerse: 1, endVerse: 19, displayRef: 'Psalm 51' },
    { book: 'Psalms', chapter: 103, startVerse: 1, endVerse: 22, displayRef: 'Psalm 103' },
    { book: 'Psalms', chapter: 119, startVerse: 1, endVerse: 16, displayRef: 'Psalm 119:1-16' },
    { book: 'Proverbs', chapter: 3, startVerse: 1, endVerse: 12, displayRef: 'Proverbs 3:1-12' },
    { book: 'Ecclesiastes', chapter: 3, startVerse: 1, endVerse: 22, displayRef: 'Ecclesiastes 3' },
    { book: 'Song of Solomon', chapter: 2, startVerse: 1, endVerse: 17, displayRef: 'Song of Solomon 2' },
    { book: 'Isaiah', chapter: 6, startVerse: 1, endVerse: 13, displayRef: 'Isaiah 6' },
    { book: 'Isaiah', chapter: 9, startVerse: 1, endVerse: 7, displayRef: 'Isaiah 9:1-7' },
    { book: 'Isaiah', chapter: 40, startVerse: 1, endVerse: 31, displayRef: 'Isaiah 40' },
    { book: 'Isaiah', chapter: 53, startVerse: 1, endVerse: 12, displayRef: 'Isaiah 53' },
    { book: 'Jeremiah', chapter: 29, startVerse: 1, endVerse: 14, displayRef: 'Jeremiah 29:1-14' },
    { book: 'Lamentations', chapter: 3, startVerse: 1, endVerse: 33, displayRef: 'Lamentations 3:1-33' },
    { book: 'Ezekiel', chapter: 36, startVerse: 22, endVerse: 38, displayRef: 'Ezekiel 36:22-38' },
    { book: 'Daniel', chapter: 3, startVerse: 1, endVerse: 30, displayRef: 'Daniel 3' },
    { book: 'Daniel', chapter: 6, startVerse: 1, endVerse: 28, displayRef: 'Daniel 6' },
    { book: 'Hosea', chapter: 6, startVerse: 1, endVerse: 11, displayRef: 'Hosea 6' },
    { book: 'Joel', chapter: 2, startVerse: 12, endVerse: 32, displayRef: 'Joel 2:12-32' },
    { book: 'Jonah', chapter: 1, startVerse: 1, endVerse: 17, displayRef: 'Jonah 1' },
    { book: 'Micah', chapter: 6, startVerse: 1, endVerse: 16, displayRef: 'Micah 6' },
    { book: 'Habakkuk', chapter: 3, startVerse: 1, endVerse: 19, displayRef: 'Habakkuk 3' },
    { book: 'Malachi', chapter: 3, startVerse: 1, endVerse: 18, displayRef: 'Malachi 3' },
    { book: 'Matthew', chapter: 5, startVerse: 1, endVerse: 30, displayRef: 'Matthew 5:1-30' },
    { book: 'Matthew', chapter: 6, startVerse: 1, endVerse: 34, displayRef: 'Matthew 6' },
    { book: 'Matthew', chapter: 7, startVerse: 1, endVerse: 29, displayRef: 'Matthew 7' },
    { book: 'Mark', chapter: 10, startVerse: 17, endVerse: 45, displayRef: 'Mark 10:17-45' },
    { book: 'Luke', chapter: 15, startVerse: 1, endVerse: 32, displayRef: 'Luke 15' },
    { book: 'John', chapter: 1, startVerse: 1, endVerse: 51, displayRef: 'John 1:1-51' },
    { book: 'John', chapter: 3, startVerse: 1, endVerse: 36, displayRef: 'John 3:1-36' },
    { book: 'John', chapter: 6, startVerse:30, endVerse: 66, displayRef: 'John 6:30-66' },
    { book: 'John', chapter: 14, startVerse: 1, endVerse: 31, displayRef: 'John 14' },
    { book: 'Acts', chapter: 2, startVerse: 1, endVerse: 47, displayRef: 'Acts 2' },
    { book: 'Romans', chapter: 1, startVerse: 1, endVerse: 32, displayRef: 'Romans 1' },
    { book: 'Romans', chapter: 3, startVerse: 1, endVerse: 31, displayRef: 'Romans 3' },
    { book: 'Romans', chapter: 8, startVerse: 1, endVerse: 39, displayRef: 'Romans 8' },
    { book: 'Romans', chapter: 12, startVerse: 1, endVerse: 21, displayRef: 'Romans 12' },
    { book: '1 Corinthians', chapter: 13, startVerse: 1, endVerse: 13, displayRef: '1 Corinthians 13' },
    { book: '2 Corinthians', chapter: 5, startVerse: 1, endVerse: 21, displayRef: '2 Corinthians 5' },
    { book: 'Galatians', chapter: 5, startVerse: 16, endVerse: 26, displayRef: 'Galatians 5:16-26' },
    { book: 'Ephesians', chapter: 2, startVerse: 1, endVerse: 22, displayRef: 'Ephesians 2' },
    { book: 'Philippians', chapter: 2, startVerse: 1, endVerse: 18, displayRef: 'Philippians 2:1-18' },
    { book: 'Colossians', chapter: 1, startVerse: 1, endVerse: 29, displayRef: 'Colossians 1' },
    { book: '1 Thessalonians', chapter: 4, startVerse: 1, endVerse: 18, displayRef: '1 Thessalonians 4' },
    { book: '1 Timothy', chapter: 3, startVerse: 1, endVerse: 16, displayRef: '1 Timothy 3' },
    { book: 'Hebrews', chapter: 11, startVerse: 1, endVerse: 40, displayRef: 'Hebrews 11' },
    { book: 'James', chapter: 1, startVerse: 1, endVerse: 27, displayRef: 'James 1' },
    { book: '1 Peter', chapter: 1, startVerse: 1, endVerse: 25, displayRef: '1 Peter 1' },
    { book: '1 John', chapter: 4, startVerse: 1, endVerse: 21, displayRef: '1 John 4' },
    { book: 'Revelation', chapter: 1, startVerse: 1, endVerse: 20, displayRef: 'Revelation 1' },
    { book: 'Revelation', chapter: 21, startVerse: 1, endVerse: 27, displayRef: 'Revelation 21' },
    { book: 'Revelation', chapter: 22, startVerse: 1, endVerse: 21, displayRef: 'Revelation 22' }
];
function buildFullBookPlan(bookName) {
    const maxChapters = CHAPTER_COUNTS[bookName];
    if (!maxChapters) {
        console.warn(`No chapter count for "${bookName}" – skipping plan`);
        return [];
    }
    const plan = [];
    for (let ch = 1; ch <= maxChapters; ch++) {
        plan.push({
            book: bookName,
            chapter: ch,
            startVerse: 1,
            endVerse: 999,
            displayRef: `${bookName} ${ch}`
        });
    }
    return plan;
}
const READING_PLANS = {
    default: readingPlan,
    genesis:      buildFullBookPlan('Genesis'),
    psalms:       buildFullBookPlan('Psalms'),
    proverbs:     buildFullBookPlan('Proverbs'),
    ecclesiastes: buildFullBookPlan('Ecclesiastes'),
    romans:       buildFullBookPlan('Romans'),
    revelation:   buildFullBookPlan('Revelation')
};
export function getActivePlan() {
    const id = state.settings.readingPlanId || 'default';
    return READING_PLANS[id] || READING_PLANS['default'];
}
const PLAN_LABELS = {
    default:      '90‑Day Sequential',
    genesis:      'Genesis',
    psalms:       'Psalms',
    proverbs:     'Proverbs',
    ecclesiastes: 'Ecclesiastes',
    romans:       'Romans',
    revelation:   'Revelation'
};
export function getCurrentPlanLabel() {
    const id = state.settings.readingPlanId || 'default';
    return PLAN_LABELS[id] || id;
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
    'NASB1995': 'nasb',      // Bible Hub uses 'nasb' for NASB 1995
    'NASB': 'nasb_',         // Bible Hub uses 'nasb_' for NASB 2020
    'ASV': 'asv',            
    'ESV': 'esv',            
    'KJV': 'kjv',            
    'NKJV': 'nkjv',          
    'BSB': 'bsb',            
    'CSB': 'csb',            
    'NET': 'net',             
    'NIV': 'niv',            
    'NLT': 'nlt'            
};
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
export const ebibleOrgUrlMap = {
    'NASB1995': 'local:engnasb',
    'ASV': 'local:eng-asv',
    'KJV': 'local:eng-kjv2006',
    'GNV': 'local:enggnv',
    'BSB': 'local:engbsb',
    'NET': 'local:engnet'
};
export const stepBibleUrlMap = {
    'NASB1995': 'NASB1995',
    'NASB': 'NASB2020',
    'ASV': 'ASV',
    'ESV': 'ESV',
    'KJV': 'KJV',
    'GNV': 'Gen',           
    'BSB': 'BSB',
    'NET': 'NET2full',      
    'NIV': 'NIV'
};
export function getTranslationShorthand() {
    return state.settings.bibleTranslation || 'BSB';
}
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
    return versionMap[appTranslation] || 'NASB1995'; 
}
export function updateBibleGatewayVersion() {
    const versionCode = getBibleGatewayVersionCode(state.settings.referenceVersion);
    const versionInput = document.getElementById('bgVersion');
    if (versionCode === 'BSB') {
        versionInput.value = 'NASB1995';
    } else {
        versionInput.value = versionCode;
    }
}