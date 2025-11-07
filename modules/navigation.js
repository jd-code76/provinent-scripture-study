import {
    apiTranslationCode,
    fetchChapter,
    getApiBookCode,
    loadPassageFromAPI
} from './api.js'
import {
    clearError,
    handleError,
    showError,
    showLoading
} from '../main.js'
import {
    displayPassage,
    extractVerseText,
    loadPassage
} from './passage.js'
import {
    AVAILABLE_TRANSLATIONS,
    BOOKS_ABBREVIATED,
    BOOK_ORDER,
    BOOK_NAME_TO_ABBREVIATION,
    CHAPTER_COUNTS,
    bookNameMapping,
    getActivePlan,
    parseURL,
    saveToStorage,
    state,
    updateURL
} from './state.js'
import { updateReferencePanel } from './ui.js'
export function populateBookDropdown() {
    const bookSel = document.getElementById('bookSelect');
    bookSel.innerHTML = '';
    BOOK_ORDER.forEach(book => {
        const opt = document.createElement('option');
        opt.value = book;
        opt.textContent = book;
        bookSel.appendChild(opt);
    });
}
export function populateChapterDropdown(selectedBook) {
    const chapSel = document.getElementById('chapterSelect');
    chapSel.innerHTML = '';
    const max = CHAPTER_COUNTS[selectedBook];
    for (let i = 1; i <= max; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        chapSel.appendChild(opt);
    }
}
export async function loadSelectedChapter(book = null, chapter = null) {
    const selBook = book || document.getElementById('bookSelect').value;
    const selChapter = chapter || document.getElementById('chapterSelect').value;
    const apiBook = getApiBookCode(selBook);
    document.title = `${selBook} ${selChapter} - Provinent Scripture Study`;
    try {
        showLoading(true);
        const apiTranslation = apiTranslationCode(state.settings.bibleTranslation);
        const chapterData = await fetchChapter(
            apiTranslation,
            apiBook,
            selChapter
        );
        const chapterFootnotes = chapterData.chapter.footnotes || [];
        const footnoteCounter = { value: 1 };
        const verses = chapterData.chapter.content
            .filter(v => v.type === 'verse')
            .map(v => ({
                number: v.number,
                text: extractVerseText(v.content, chapterFootnotes, footnoteCounter),
                reference: `${selBook} ${selChapter}:${v.number}`
            }));
        state.footnotes = {};
        displayPassage(verses, `${selBook} ${selChapter}`);
        clearError();
        document.getElementById('scriptureSection').scrollTop = 0;
        if (state.settings.readingMode === 'manual') {
            state.settings.manualBook = selBook;
            state.settings.manualChapter = Number(selChapter);
            saveToStorage();
        }
        if (state.settings.referencePanelOpen) {
            updateReferencePanel();
        }
        if (book && chapter) {
            state.settings.readingMode = 'manual';
            state.settings.manualBook = selBook;
            state.settings.manualChapter = Number(selChapter);
        }
        saveToStorage();
    } catch (err) {
        handleError(err, 'loadSelectedChapter');
        showError(`Could not load ${selBook} ${selChapter}: ${err.message}`);
    } finally {
        showLoading(false);
    }
}
export function initBookChapterControls() {
    populateBookDropdown();
    document.getElementById('bookSelect').addEventListener('change', e => {
        const book = e.target.value;
        state.settings.readingMode = 'manual';
        populateChapterDropdown(book);
        state.settings.manualBook = book;
        state.settings.manualChapter = 1;
        const chapterSel = document.getElementById('chapterSelect');
        chapterSel.value = '1';
        loadSelectedChapter(book, 1);
        saveToStorage(); 
    });
    document.getElementById('chapterSelect').addEventListener('change', () => {
        const book = document.getElementById('bookSelect').value;
        const chap = Number(document.getElementById('chapterSelect').value);
        state.settings.readingMode = 'manual';
        state.settings.manualBook = book;
        state.settings.manualChapter = chap;
        loadSelectedChapter(book, chap);
        saveToStorage();  
    });
    populateChapterDropdown(BOOK_ORDER[0]);
}
export async function randomPassage() {
    try {
        state.settings.readingMode = 'manual';
        const randomLoc = await getRandomBibleLocation();
        state.settings.manualBook = randomLoc.book;
        state.settings.manualChapter = randomLoc.chapter;
        const translation = getCurrentTranslation();
        updateURL(translation, randomLoc.book, randomLoc.chapter);
        saveToStorage();
        await loadPassageFromAPI(randomLoc);
        document.getElementById('passageReference').textContent = randomLoc.displayRef;
        state.currentPassageReference = randomLoc.displayRef;
        syncBookChapterSelectors();
        if (state.settings.referencePanelOpen) {
            updateReferencePanel();
        }
    } catch (err) {
        handleError(err, 'randomPassage');
        showError('Could not load a random passage – see console for details.');
    }
}
export function nextPassage() {
    if (state.settings.readingMode === 'readingPlan') {
        const plan = getActivePlan();
        const len = plan.length;
        let newIndex = (state.settings.currentPassageIndex + 1) % len;
        if (newIndex < 0) newIndex = len - 1;
        state.settings.currentPassageIndex = newIndex;
        const passage = plan[newIndex];
        const translation = getCurrentTranslation();
        updateURL(translation, passage.book, passage.chapter);
        updateUIMode('readingPlan', translation, passage.displayRef);
        loadPassage(passage.book, passage.chapter, translation);
        syncSelectorsToReadingPlan();
    } else {
        let bookIdx = BOOK_ORDER.indexOf(state.settings.manualBook);
        let chap = state.settings.manualChapter;
        const maxCh = CHAPTER_COUNTS[state.settings.manualBook];
        let nextBook = state.settings.manualBook;
        let nextChapter = chap;
        if (chap < maxCh) {
            nextChapter = chap + 1;
        } else if (bookIdx < BOOK_ORDER.length - 1) {
            nextBook = BOOK_ORDER[bookIdx + 1];
            nextChapter = 1;
        } else {
            return;
        }
        updateManualNavigation(nextBook, nextChapter);
    }
    document.getElementById('scriptureSection').scrollTop = 0;
}
export function prevPassage() {
    if (state.settings.readingMode === 'readingPlan') {
        const plan = getActivePlan();
        const len = plan.length;
        let newIndex = (state.settings.currentPassageIndex - 1 + len) % len;
        state.settings.currentPassageIndex = newIndex;
        const passage = plan[newIndex];
        const translation = getCurrentTranslation();
        updateURL(translation, passage.book, passage.chapter);
        updateUIMode('readingPlan', translation, passage.displayRef);
        loadPassage(passage.book, passage.chapter, translation);
        syncSelectorsToReadingPlan();
    } else {
        let bookIdx = BOOK_ORDER.indexOf(state.settings.manualBook);
        let chap = state.settings.manualChapter;
        let nextBook = state.settings.manualBook;
        let nextChapter = chap;
        if (chap > 1) {
            nextChapter = chap - 1;
        } else if (bookIdx > 0) {
            const prevBook = BOOK_ORDER[bookIdx - 1];
            nextBook = prevBook;
            nextChapter = CHAPTER_COUNTS[prevBook];
        } else {
            return;
        }
        updateManualNavigation(nextBook, nextChapter);
    }
    document.getElementById('scriptureSection').scrollTop = 0;
}
function updateManualNavigation(book, chapter) {
    state.settings.readingMode = 'manual';
    state.settings.manualBook = book;
    state.settings.manualChapter = chapter;
    const translation = getCurrentTranslation();
    updateURL(translation, book, chapter);
    const displayRef = `${book} ${chapter}`;
    updateUIMode('manual', translation, displayRef);
    loadSelectedChapter(book, chapter);
    syncBookChapterSelectors();
    saveToStorage();
    if (state.settings.referencePanelOpen) {
        updateReferencePanel();
    }
}
function updateUIMode(mode, translation, displayRef) {
    const headerTitleEl = document.getElementById('passageHeaderTitle');
    const planLabelEl = document.getElementById('planLabel');
    const passageRefElement = document.getElementById('passageReference');
    if (headerTitleEl) {
        headerTitleEl.textContent = `Holy Bible: ${translation}`;
    }
    if (passageRefElement) {
        passageRefElement.textContent = displayRef;
        state.currentPassageReference = displayRef;
    }
    if (planLabelEl) {
        if (mode === 'readingPlan') {
            planLabelEl.textContent = `Reading plan: ${getCurrentPlanLabel()}`;
        } else {
            planLabelEl.textContent = '';
        }
    }
}
export function syncBookChapterSelectors() {
    const bookSel = document.getElementById('bookSelect');
    const chapterSel = document.getElementById('chapterSelect');
    if (bookSel.value !== state.settings.manualBook) {
        bookSel.value = state.settings.manualBook;
        populateChapterDropdown(state.settings.manualBook);
    }
    const curMax = CHAPTER_COUNTS[state.settings.manualBook];
    const curChap = state.settings.manualChapter;
    populateChapterDropdown(state.settings.manualBook);
    chapterSel.value = (curChap <= curMax) ? curChap : curMax;
}
export function syncSelectorsToReadingPlan() {
    if (state.settings.readingMode !== 'readingPlan') return;
    const plan = getActivePlan();
    const passage = plan[state.settings.currentPassageIndex];
    if (!passage || !passage.book) {
        console.error('Invalid passage object:', passage);
        return;
    }
    const bookSel = document.getElementById('bookSelect');
    const chapterSel = document.getElementById('chapterSelect');
    state.settings.manualBook = passage.book;
    state.settings.manualChapter = passage.chapter;
    if (bookSel) bookSel.value = passage.book;
    populateChapterDropdown(passage.book);
    if (chapterSel) chapterSel.value = passage.chapter;
    saveToStorage();
}
async function getRandomBibleLocation() {
    try {
        const randomBook = BOOK_ORDER[Math.floor(Math.random() * BOOK_ORDER.length)];
        const maxCh = CHAPTER_COUNTS[randomBook];
        const randomChapter = Math.floor(Math.random() * maxCh) + 1; 
        const apiMap = apiTranslationCode(state.settings.bibleTranslation);
        const apiBook = bookNameMapping[randomBook] ||
                        randomBook.replace(/\s+/g, '').toUpperCase();
        const chapterData = await fetchChapter(apiMap, apiBook, randomChapter);
        const verses = chapterData.chapter.content.filter(v => v.type === 'verse');
        const verseCount = verses.length || 1; 
        return {
            book: randomBook,
            chapter: randomChapter,
            startVerse: 1,                 
            endVerse: verseCount,          
            displayRef: `${randomBook} ${randomChapter}`
        };
    } catch (err) {
        handleError(err, 'getRandomBibleLocation');
    } 
}
export function getCurrentTranslation() {
    return state.settings.bibleTranslation || 'BSB';
}
export function navigateFromURL() {
    const urlParams = parseURL();
    if (!urlParams && !window.location.search) {
        const defaultParams = {
            translation: 'BSB',
            book: 'Genesis',
            chapter: 1
        };
        updateURL(defaultParams.translation, defaultParams.book, defaultParams.chapter);
        return loadDefaultPassage(defaultParams);
    }
    if (urlParams) {
        const isValidTranslation = AVAILABLE_TRANSLATIONS.includes(urlParams.translation);
        const bookAbbr = BOOK_NAME_TO_ABBREVIATION[urlParams.book];
        const isValidBook = BOOKS_ABBREVIATED.includes(bookAbbr);
        const isValidChapter = urlParams.chapter > 0 && urlParams.chapter < 151;
        if (isValidTranslation && isValidBook && isValidChapter) {
            state.settings.readingMode = 'manual';
            state.settings.manualBook = urlParams.book;
            state.settings.manualChapter = urlParams.chapter;
            state.settings.bibleTranslation = urlParams.translation;
            const bookSelect = document.getElementById('bookSelect');
            const chapterSelect = document.getElementById('chapterSelect');
            if (bookSelect) bookSelect.value = urlParams.book;
            if (chapterSelect) {
                populateChapterDropdown(urlParams.book);
                chapterSelect.value = urlParams.chapter;
            }
            const passageRefElement = document.getElementById('passageReference');
            if (passageRefElement) {
                passageRefElement.textContent = `${urlParams.book} ${urlParams.chapter}`;
                state.currentPassageReference = `${urlParams.book} ${urlParams.chapter}`;
            }
            const headerTitleEl = document.getElementById('passageHeaderTitle');
            if (headerTitleEl) {
                headerTitleEl.textContent = `Holy Bible: ${urlParams.translation}`;
            }
            const planLabelEl = document.getElementById('planLabel');
            if (planLabelEl) {
                planLabelEl.textContent = '';
            }
            loadSelectedChapter(urlParams.book, urlParams.chapter);
            return true;
        }
    }
    return false;
}
function loadDefaultPassage(params) {
    state.settings.readingMode = 'readingPlan';
    state.settings.manualBook = params.book;
    state.settings.manualChapter = params.chapter;
    state.settings.bibleTranslation = params.translation;
    const bookSelect = document.getElementById('bookSelect');
    const chapterSelect = document.getElementById('chapterSelect');
    if (bookSelect) bookSelect.value = params.book;
    if (chapterSelect) {
        populateChapterDropdown(params.book);
        chapterSelect.value = params.chapter;
    }
    const passageRefElement = document.getElementById('passageReference');
    if (passageRefElement) {
        passageRefElement.textContent = `${params.book} ${params.chapter}`;
        state.currentPassageReference = `${params.book} ${params.chapter}`;
    }
    const headerTitleEl = document.getElementById('passageHeaderTitle');
    if (headerTitleEl) {
        headerTitleEl.textContent = `Holy Bible: ${params.translation}`;
    }
    loadSelectedChapter(params.book, params.chapter);
    return true;
}
export function setupPopStateListener() {
    window.addEventListener('popstate', navigateFromURL);
}
export function setupNavigationWithURL() {
    document.getElementById('bookSelect').addEventListener('change', (e) => {
        const book = e.target.value;
        const chapter = 1;
        const translation = getCurrentTranslation();
        updateURL(translation, book, chapter);
        loadSelectedChapter(book, chapter);
    });
    document.getElementById('chapterSelect').addEventListener('change', (e) => {
        const book = document.getElementById('bookSelect').value;
        const chapter = parseInt(e.target.value);
        const translation = getCurrentTranslation();
        updateURL(translation, book, chapter);
        loadSelectedChapter(book, chapter);
    });
}