/*=====================================================================
  Provinent Scripture Study – navigation.js
=====================================================================*/

/* Global imports */
import {
    apiTranslationCode,
    cleanupAudioPlayer,
    fetchChapter,
    getApiBookCode,
    isKJV,
    stopChapterAudio,
    updateAudioControls
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
    updateDisplayRef
} from './passage.js'

import {
    AVAILABLE_TRANSLATIONS,
    BOOKS_ABBREVIATED,
    BOOK_ORDER,
    BOOK_NAME_TO_ABBREVIATION,
    CHAPTER_COUNTS,
    bookNameMapping,
    parseURL,
    saveToStorage,
    state,
    updateURL
} from './state.js'

import { updateReferencePanel } from './ui.js'

/* ====================================================================
   BOOK & CHAPTER SELECTORS
   Manual navigation dropdowns
==================================================================== */

/* Populate the book dropdown with all 66 Bible books */
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

/* Populate chapter dropdown based on selected book */
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

/* Update chapter dropdown visibility based on single-chapter books */
export function updateChapterDropdownVisibility(book) {
    const singleChapterBooks = [
        'Obadiah', 'Philemon', '2 John', '3 John', 'Jude'
    ];
    
    const chapterSelect = document.getElementById('chapterSelect');
    const chapterLabel = document.querySelector('label[for="chapterSelect"]');
    
    if (singleChapterBooks.includes(book)) {
        chapterSelect.style.display = 'none';
        if (chapterLabel) chapterLabel.style.display = 'none';
    } else {
        chapterSelect.style.display = 'block';
        if (chapterLabel) chapterLabel.style.display = 'block';
    }
}

/* Load manually selected chapter */
export async function loadSelectedChapter(book = null, chapter = null) {
    if (typeof cleanupAudioPlayer === 'function') {
        cleanupAudioPlayer();
    }
    
    const selBook = book || document.getElementById('bookSelect').value;
    const selChapter = chapter || document.getElementById('chapterSelect').value;
    const apiBook = getApiBookCode(selBook);
    
    updateChapterDropdownVisibility(selBook);
    
    document.title = `${selBook} ${selChapter} - Provinent Scripture Study`;
    updateDisplayRef(selBook, selChapter);
    
    try {
        showLoading(true);
        const apiTranslation = apiTranslationCode(state.settings.bibleTranslation);
        
        // For KJV, we can load the chapter but don't wait for audio check
        if (isKJV(state.settings.bibleTranslation)) {
            if (typeof updateAudioControls === 'function') {
                updateAudioControls(null);
            }
            
            // Load chapter data asynchronously but don't wait for audio
            fetchChapter(apiTranslation, apiBook, selChapter)
                .then(chapterData => {
                    state.currentChapterData = chapterData;
                    state.settings.manualBook = selBook;
                    state.settings.manualChapter = Number(selChapter);
                    
                    const chapterFootnotes = chapterData.chapter.footnotes || [];
                    const footnoteCounter = { value: 1 };
                    
                    const contentItems = chapterData.chapter.content
                        .map(item => {
                            if (item.type === 'verse') {
                                return {
                                    type: 'verse',
                                    number: item.number,
                                    text: extractVerseText(item.content, chapterFootnotes, footnoteCounter),
                                    reference: `${selBook} ${selChapter}:${item.number}`,
                                    rawContent: item.content
                                };
                            } else if (item.type === 'heading') {
                                return {
                                    type: 'heading',
                                    content: item.content.join(' '),
                                    reference: `${selBook} ${selChapter}`
                                };
                            } else if (item.type === 'line_break') {
                                return {
                                    type: 'line_break'
                                };
                            }
                            return null;
                        })
                        .filter(item => item !== null);
                    
                    state.footnotes = {};
                    displayPassage(contentItems);
                    clearError();
                    document.getElementById('scriptureSection').scrollTop = 0;
                    
                    if (state.settings.referencePanelOpen) {
                        updateReferencePanel();
                    }
                    
                    saveToStorage();
                })
                .catch(err => {
                    handleError(err, 'loadSelectedChapter');
                    showError(`Could not load ${selBook} ${selChapter}: ${err.message}`);
                })
                .finally(() => {
                    showLoading(false);
                });
            
        } else {
            // Normal loading for other translations
            const chapterData = await fetchChapter(apiTranslation, apiBook, selChapter);
            
            const chapterFootnotes = chapterData.chapter.footnotes || [];
            const footnoteCounter = { value: 1 };
            
            const contentItems = chapterData.chapter.content
                .map(item => {
                    if (item.type === 'verse') {
                        return {
                            type: 'verse',
                            number: item.number,
                            text: extractVerseText(item.content, chapterFootnotes, footnoteCounter),
                            reference: `${selBook} ${selChapter}:${item.number}`,
                            rawContent: item.content
                        };
                    } else if (item.type === 'heading') {
                        return {
                            type: 'heading',
                            content: item.content.join(' '),
                            reference: `${selBook} ${selChapter}`
                        };
                    } else if (item.type === 'line_break') {
                        return {
                            type: 'line_break'
                        };
                    }
                    return null;
                })
                .filter(item => item !== null);
            
            state.footnotes = {};
            displayPassage(contentItems);
            clearError();
            document.getElementById('scriptureSection').scrollTop = 0;
            
            state.settings.manualBook = selBook;
            state.settings.manualChapter = Number(selChapter);
            state.currentChapterData = chapterData;
            
            if (typeof updateAudioControls === 'function') {
                updateAudioControls(chapterData.thisChapterAudioLinks);
            }
            
            if (state.settings.referencePanelOpen) {
                updateReferencePanel();
            }
            
            saveToStorage();
        }
    } catch (err) {
        handleError(err, 'loadSelectedChapter');
        showError(`Could not load ${selBook} ${selChapter}: ${err.message}`);
    } finally {
        if (!isKJV(state.settings.bibleTranslation)) {
            showLoading(false);
        }
        // KJV loading is handled in the promise chain above
    }
}

/* Initialize book and chapter controls */
export function initBookChapterControls() {
    populateBookDropdown();

    document.getElementById('bookSelect').addEventListener('change', e => {
        if (typeof stopChapterAudio === 'function') {
            stopChapterAudio();
        }
        
        const book = e.target.value;
        populateChapterDropdown(book);
        state.settings.manualBook = book;
        state.settings.manualChapter = 1;
        
        const chapterSel = document.getElementById('chapterSelect');
        chapterSel.value = '1';
        
        updateChapterDropdownVisibility(book);
        
        loadSelectedChapter(book, 1);
        saveToStorage(); 
    });

    document.getElementById('chapterSelect').addEventListener('change', () => {
        if (typeof stopChapterAudio === 'function') {
            stopChapterAudio();
        }
        
        const book = document.getElementById('bookSelect').value;
        const chap = Number(document.getElementById('chapterSelect').value);
        state.settings.manualBook = book;
        state.settings.manualChapter = chap;

        loadSelectedChapter(book, chap);
        saveToStorage();  
    });

    populateChapterDropdown(BOOK_ORDER[0]);
}

/**
 * Random‑passage button handler.
 * Picks a completely random verse from the whole canon, switches to manual mode, and loads it.
 */
export async function randomPassage() {
    try {
        if (typeof stopChapterAudio === 'function') {
            stopChapterAudio();
        }
        
        const randomLoc = await getRandomBibleLocation();

        state.settings.manualBook = randomLoc.book;
        state.settings.manualChapter = randomLoc.chapter;

        const translation = getCurrentTranslation();
        updateURL(translation, randomLoc.book, randomLoc.chapter);

        saveToStorage();

        const headerTitleEl = document.getElementById('passageHeaderTitle');
        if (headerTitleEl) {
            headerTitleEl.textContent = `Holy Bible: ${translation}`;
        }
        
        await loadSelectedChapter(randomLoc.book, randomLoc.chapter);
        
        updateDisplayRef(randomLoc.book, randomLoc.chapter);
        
        syncBookChapterSelectors();

        if (state.settings.referencePanelOpen) {
            updateReferencePanel();
        }
    } catch (err) {
        handleError(err, 'randomPassage');
        showError('Could not load a random passage – see console for details.');
    }
}

/* Next chapter button handler */
export function nextPassage() {
    if (typeof stopChapterAudio === 'function') {
        stopChapterAudio();
    }
    
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

/* Prev chapter button handler */
export function prevPassage() {
    if (typeof stopChapterAudio === 'function') {
        stopChapterAudio();
    }
    
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

/* Common function to handle manual navigation updates */
function updateManualNavigation(book, chapter) {
    if (typeof stopChapterAudio === 'function') {
        stopChapterAudio();
    }
    
    state.settings.manualBook = book;
    state.settings.manualChapter = chapter;
    
    const translation = getCurrentTranslation();
    updateURL(translation, book, chapter);
    
    const displayRef = `${book} ${chapter}`;
    updateUIMode(translation, displayRef);
    
    loadSelectedChapter(book, chapter);
    syncBookChapterSelectors();
    saveToStorage();
    
    if (state.settings.referencePanelOpen) {
        updateReferencePanel();
    }
}

/* Update UI elements as navigated */
function updateUIMode(translation, displayRef) {
    const headerTitleEl = document.getElementById('passageHeaderTitle');
    const passageRefElement = document.getElementById('passageReference');
    
    if (headerTitleEl) {
        headerTitleEl.textContent = `Holy Bible: ${translation}`;
    }
    
    if (passageRefElement) {
        passageRefElement.textContent = displayRef;
        state.currentPassageReference = displayRef;
    }
}

/* Keep the book‑/chapter dropdowns in sync with the internal state */
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
    
    updateChapterDropdownVisibility(state.settings.manualBook);
}

/**
 * Pick a completely random chapter from the entire canon and return an
 * object that matches the shape expected by `loadPassageFromAPI`.
 *
 * The returned object contains:
 *   - book          : human‑readable name (e.g. "Romans")
 *   - chapter       : numeric chapter
 *   - startVerse    : always 1 (beginning of the chapter)
 *   - endVerse      : the last verse number in that chapter
 *   - displayRef    : a nicely formatted reference string
 *
 * The function is async because we need to fetch the chapter once
 * just to discover how many verses it contains.
 */
async function getRandomBibleLocation() {
    try {
        const randomBook = BOOK_ORDER[Math.floor(Math.random() * BOOK_ORDER.length)];
        const maxCh = CHAPTER_COUNTS[randomBook];
        const randomChapter = Math.floor(Math.random() * maxCh) + 1;
        
        const apiMap = apiTranslationCode(state.settings.bibleTranslation);
        const apiBook = bookNameMapping[randomBook] || randomBook.replace(/\s+/g, '').toUpperCase();

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

/* ====================================================================
   URL ROUTING
   Handle navigation via URL parameters
==================================================================== */

/* Helper function to get current translation */
export function getCurrentTranslation() {
    return state.settings.bibleTranslation || 'BSB';
}

/* Navigate based on URL parameters */
export function navigateFromURL() {
    const urlParams = parseURL();
    
    if (urlParams) {
        const isValidTranslation = AVAILABLE_TRANSLATIONS.includes(urlParams.translation);
        const bookAbbr = BOOK_NAME_TO_ABBREVIATION[urlParams.book];
        const isValidBook = BOOKS_ABBREVIATED.includes(bookAbbr);
        const isValidChapter = urlParams.chapter > 0 && urlParams.chapter < 151;
        
        if (isValidTranslation && isValidBook && isValidChapter) {
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
            
            updateChapterDropdownVisibility(urlParams.book);
            
            const translationSelect = document.getElementById('bibleTranslationSetting');
            if (translationSelect) {
                translationSelect.value = urlParams.translation;
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
            
            loadSelectedChapter(urlParams.book, urlParams.chapter);
            
            window.history.replaceState(
                { translation: urlParams.translation, book: urlParams.book, chapter: urlParams.chapter },
                '',
                window.location.search
            );
            
            return true;
        }
    }
    return false;
}

/* Handle browser back/forward navigation */
export function setupPopStateListener() {
    window.addEventListener('popstate', (event) => {
        if (event.state) {
            const { translation, book, chapter } = event.state;
            state.settings.manualBook = book;
            state.settings.manualChapter = chapter;
            state.settings.bibleTranslation = translation;
            
            const bookSelect = document.getElementById('bookSelect');
            const chapterSelect = document.getElementById('chapterSelect');
            
            if (bookSelect) bookSelect.value = book;
            if (chapterSelect) {
                populateChapterDropdown(book);
                chapterSelect.value = chapter;
            }
            
            loadSelectedChapter(book, chapter);
        } else {
            navigateFromURL();
        }
    });
}

/* Modify book and chapter selection handlers to update URL */
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
