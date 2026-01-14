import { apiTranslationCode, cleanupAudioPlayer, fetchChapter, getApiBookCode, isKJV, stopChapterAudio, updateAudioControls } from './api.js';
import { scrollToVerse } from './highlights.js';
import { setupKeyboardNavigation } from './hotkeys.js';
import { clearError, handleError, showError, showLoading, updateHeaderTitle } from '../main.js';
import { displayPassage, extractVerseText, updateDisplayRef } from './passage.js';
import { AVAILABLE_TRANSLATIONS, BOOKS_ABBREVIATED, BOOK_ORDER, BOOK_NAME_TO_ABBREVIATION, CHAPTER_COUNTS, bookNameMapping, parseURL, saveToStorage, state, updateURL } from './state.js';
import { updateReferencePanel } from './ui.js';
const SINGLE_CHAPTER_BOOKS = new Set([
    'Obadiah', 'Philemon', '2 John', '3 John', 'Jude'
]);
export function populateBookDropdown() {
    try {
        const bookSel = document.getElementById('bookSelect');
        if (!bookSel) return;
        bookSel.innerHTML = '';
        BOOK_ORDER.forEach(book => {
            const option = document.createElement('option');
            option.value = book;
            option.textContent = book;
            bookSel.appendChild(option);
        });
    } catch (error) {
        console.error('Error populating book dropdown:', error);
    }
}
export function populateChapterDropdown(selectedBook) {
    try {
        const chapSel = document.getElementById('chapterSelect');
        if (!chapSel) return;
        chapSel.innerHTML = '';
        const maxChapters = CHAPTER_COUNTS[selectedBook] || 1;
        for (let i = 1; i <= maxChapters; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            chapSel.appendChild(option);
        }
        updateChapterDropdownVisibility(selectedBook);
    } catch (error) {
        console.error('Error populating chapter dropdown:', error);
    }
}
export function updateChapterDropdownVisibility(book) {
    try {
        const chapterSelect = document.getElementById('chapterSelect');
        const chapterLabel = document.querySelector('label[for="chapterSelect"]');
        if (!chapterSelect) return;
        const isSingleChapter = SINGLE_CHAPTER_BOOKS.has(book);
        chapterSelect.style.display = isSingleChapter ? 'none' : 'block';
        if (chapterLabel) {
            chapterLabel.style.display = isSingleChapter ? 'none' : 'block';
        }
    } catch (error) {
        console.error('Error updating chapter dropdown visibility:', error);
    }
}
export async function loadSelectedChapter(book = null, chapter = null) {
    const selectedBook = book || getSelectedBook();
    const selectedChapter = chapter || getSelectedChapter();
    try {
        if (typeof cleanupAudioPlayer === 'function') {
            cleanupAudioPlayer();
        }
        if (!selectedBook || !selectedChapter) {
            throw new Error('Invalid book or chapter selection');
        }
        const apiBook = getApiBookCode(selectedBook);
        updateChapterDropdownVisibility(selectedBook);
        document.title = `${selectedBook} ${selectedChapter} - Provinent Scripture Study`;
        updateDisplayRef(selectedBook, selectedChapter);
        await loadChapterContent(selectedBook, selectedChapter, apiBook);
    } catch (error) {
        handleError(error, 'loadSelectedChapter');
        showError(`Could not load ${selectedBook} ${selectedChapter}: ${error.message}`);
    }
}
function getSelectedBook() {
    const bookSelect = document.getElementById('bookSelect');
    return bookSelect?.value || BOOK_ORDER[0];
}
function getSelectedChapter() {
    const chapterSelect = document.getElementById('chapterSelect');
    return parseInt(chapterSelect?.value || '1');
}
async function loadChapterContent(book, chapter, apiBook) {
    showLoading(true);
    try {
        const apiTranslation = apiTranslationCode(state.settings.bibleTranslation);
        if (isKJV(state.settings.bibleTranslation)) {
            await loadKJVChapter(book, chapter, apiTranslation, apiBook);
        } else {
            await loadStandardChapter(book, chapter, apiTranslation, apiBook);
        }
    } finally {
        if (!isKJV(state.settings.bibleTranslation)) {
            showLoading(false);
        }
    }
}
async function loadKJVChapter(book, chapter, apiTranslation, apiBook) {
    if (typeof updateAudioControls === 'function') {
        updateAudioControls(null);
    }
    try {
        const chapterData = await fetchChapter(apiTranslation, apiBook, chapter);
        processChapterData(chapterData, book, chapter);
        saveNavigationState(book, chapter, chapterData);
        if (state.settings.referencePanelOpen) {
            updateReferencePanel();
        }
    } finally {
        showLoading(false);
    }
}
async function loadStandardChapter(book, chapter, apiTranslation, apiBook) {
    const chapterData = await fetchChapter(apiTranslation, apiBook, chapter);
    processChapterData(chapterData, book, chapter);
    saveNavigationState(book, chapter, chapterData);
    if (typeof updateAudioControls === 'function') {
        updateAudioControls(chapterData.thisChapterAudioLinks);
    }
    if (state.settings.referencePanelOpen) {
        updateReferencePanel();
    }
}
function processChapterData(chapterData, book, chapter) {
    const chapterFootnotes = chapterData.chapter.footnotes || [];
    const footnoteCounter = { value: 1 };
    const contentItems = chapterData.chapter.content
        .map(item => {
            switch (item.type) {
                case 'verse':
                    return {
                        type: 'verse',
                        number: item.number,
                        text: extractVerseText(item.content, chapterFootnotes, footnoteCounter),
                        reference: `${book} ${chapter}:${item.number}`,
                        rawContent: item.content
                    };
                case 'heading':
                    return {
                        type: 'heading',
                        content: item.content.join(' '),
                        reference: `${book} ${chapter}`
                    };
                case 'line_break':
                    return { type: 'line_break' };
                default:
                    return null;
            }
        })
        .filter(item => item !== null);
    state.footnotes = {};
    displayPassage(contentItems);
    clearError();
    const scriptureSection = document.getElementById('scriptureSection');
    if (scriptureSection) scriptureSection.scrollTop = 0;
}
function saveNavigationState(book, chapter, chapterData) {
    state.settings.manualBook = book;
    state.settings.manualChapter = Number(chapter);
    state.currentChapterData = chapterData;
    saveToStorage();
}
export function initBookChapterControls() {
    try {
        populateBookDropdown();
        setupKeyboardNavigation();
        setupNavigationEventListeners();
    } catch (error) {
        console.error('Error initializing book chapter controls:', error);
    }
}
function setupNavigationEventListeners() {
    const bookSelect = document.getElementById('bookSelect');
    const chapterSelect = document.getElementById('chapterSelect');
    if (!bookSelect || !chapterSelect) return;
    bookSelect.addEventListener('change', handleBookChange);
    chapterSelect.addEventListener('change', handleChapterChange);
}
function handleBookChange(event) {
    try {
        if (typeof stopChapterAudio === 'function') {
            stopChapterAudio();
        }
        const book = event.target.value;
        populateChapterDropdown(book);
        state.settings.manualBook = book;
        state.settings.manualChapter = 1;
        const chapterSel = document.getElementById('chapterSelect');
        chapterSel.value = '1';
        updateChapterDropdownVisibility(book);
        loadSelectedChapter(book, 1);
        saveToStorage();
    } catch (error) {
        console.error('Error handling book change:', error);
    }
}
function handleChapterChange() {
    try {
        if (typeof stopChapterAudio === 'function') {
            stopChapterAudio();
        }
        const book = document.getElementById('bookSelect').value;
        const chapter = Number(document.getElementById('chapterSelect').value);
        state.settings.manualBook = book;
        state.settings.manualChapter = chapter;
        loadSelectedChapter(book, chapter);
        saveToStorage();
    } catch (error) {
        console.error('Error handling chapter change:', error);
    }
}
export async function randomPassage() {
    try {
        if (typeof stopChapterAudio === 'function') {
            stopChapterAudio();
        }
        const randomLoc = await getRandomBibleLocation();
        const translation = getCurrentTranslation();
        state.settings.manualBook = randomLoc.book;
        state.settings.manualChapter = randomLoc.chapter;
        updateURL(translation, randomLoc.book, randomLoc.chapter, 'push');
        saveToStorage();
        updateHeaderTitle();
        await loadSelectedChapter(randomLoc.book, randomLoc.chapter);
        updateDisplayRef(randomLoc.book, randomLoc.chapter);
        syncBookChapterSelectors();
        if (state.settings.referencePanelOpen) {
            updateReferencePanel();
        }
    } catch (error) {
        handleError(error, 'randomPassage');
        showError('Could not load a random passage');
    }
}
export function nextPassage() {
    try {
        if (typeof stopChapterAudio === 'function') {
            stopChapterAudio();
        }
        const { nextBook, nextChapter } = calculateNextPassage();
        if (nextBook && nextChapter) {
            updateManualNavigation(nextBook, nextChapter);
        }
    } catch (error) {
        console.error('Error navigating to next passage:', error);
    }
}
export function prevPassage() {
    try {
        if (typeof stopChapterAudio === 'function') {
            stopChapterAudio();
        }
        const { prevBook, prevChapter } = calculatePrevPassage();
        if (prevBook && prevChapter) {
            updateManualNavigation(prevBook, prevChapter);
        }
    } catch (error) {
        console.error('Error navigating to previous passage:', error);
    }
}
function calculateNextPassage() {
    const bookIdx = BOOK_ORDER.indexOf(state.settings.manualBook);
    const currentChapter = state.settings.manualChapter;
    const maxChapters = CHAPTER_COUNTS[state.settings.manualBook];
    if (currentChapter < maxChapters) {
        return {
            nextBook: state.settings.manualBook,
            nextChapter: currentChapter + 1
        };
    } else if (bookIdx < BOOK_ORDER.length - 1) {
        return {
            nextBook: BOOK_ORDER[bookIdx + 1],
            nextChapter: 1
        };
    }
    return { nextBook: null, nextChapter: null };
}
function calculatePrevPassage() {
    const bookIdx = BOOK_ORDER.indexOf(state.settings.manualBook);
    const currentChapter = state.settings.manualChapter;
    if (currentChapter > 1) {
        return {
            prevBook: state.settings.manualBook,
            prevChapter: currentChapter - 1
        };
    } else if (bookIdx > 0) {
        const prevBook = BOOK_ORDER[bookIdx - 1];
        return {
            prevBook: prevBook,
            prevChapter: CHAPTER_COUNTS[prevBook]
        };
    }
    return { prevBook: null, prevChapter: null };
}
export function updateManualNavigation(book, chapter) {
    try {
        if (typeof stopChapterAudio === 'function') {
            stopChapterAudio();
        }
        state.settings.manualBook = book;
        state.settings.manualChapter = chapter;
        const translation = getCurrentTranslation();
        updateURL(translation, book, chapter, 'push');
        updateHeaderTitle();
        loadSelectedChapter(book, chapter);
        syncBookChapterSelectors();
        saveToStorage();
        if (state.settings.referencePanelOpen) {
            updateReferencePanel();
        }
    } catch (error) {
        console.error('Error updating manual navigation:', error);
    }
}
export function syncBookChapterSelectors() {
    try {
        const bookSel = document.getElementById('bookSelect');
        const chapterSel = document.getElementById('chapterSelect');
        if (!bookSel || !chapterSel) return;
        if (bookSel.value !== state.settings.manualBook) {
            bookSel.value = state.settings.manualBook;
            populateChapterDropdown(state.settings.manualBook);
        }
        const maxChapters = CHAPTER_COUNTS[state.settings.manualBook];
        const currentChapter = state.settings.manualChapter;
        const validChapter = Math.min(currentChapter, maxChapters);
        chapterSel.value = validChapter;
        updateChapterDropdownVisibility(state.settings.manualBook);
    } catch (error) {
        console.error('Error syncing book chapter selectors:', error);
    }
}
async function getRandomBibleLocation() {
    try {
        const randomBuffer = new Uint32Array(2); 
        crypto.getRandomValues(randomBuffer);
        const randomBookIndex = Math.floor((randomBuffer[0] / 0xFFFFFFFF) * BOOK_ORDER.length);
        const randomBook = BOOK_ORDER[randomBookIndex];
        const maxChapters = CHAPTER_COUNTS[randomBook];
        const randomChapterIndex = Math.floor((randomBuffer[1] / 0xFFFFFFFF) * maxChapters) + 1;
        const randomChapter = Math.min(randomChapterIndex, maxChapters);
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
    } catch (error) {
        if (error.name === 'TypeError' || error.message.includes('crypto')) {
            console.warn('crypto.getRandomValues unavailable; falling back to Math.random for random passage');
            const randomBook = BOOK_ORDER[Math.floor(Math.random() * BOOK_ORDER.length)];
            const maxChapters = CHAPTER_COUNTS[randomBook];
            const randomChapter = Math.floor(Math.random() * maxChapters) + 1;
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
        }
        handleError(error, 'getRandomBibleLocation');
        throw error;
    }
}
function getCurrentTranslation() {
    return state.settings.bibleTranslation || 'BSB';
}
export function navigateFromURL() {
    try {
        const urlParams = parseURL();
        if (!urlParams) return false;
        const { translation, book, chapter } = urlParams;
        if (isValidNavigationParams(translation, book, chapter)) {
            applyUrlNavigationParams(translation, book, chapter);
            loadSelectedChapter(book, chapter);
            updateBrowserHistory(translation, book, chapter);
            return true;
        }
    } catch (error) {
        console.error('Error navigating from URL:', error);
    }
    return false;
}
function isValidNavigationParams(translation, book, chapter) {
    const bookAbbr = BOOK_NAME_TO_ABBREVIATION[book];
    return AVAILABLE_TRANSLATIONS.includes(translation) &&
           BOOKS_ABBREVIATED.includes(bookAbbr) &&
           chapter > 0 && chapter < 151;
}
function applyUrlNavigationParams(translation, book, chapter) {
    state.settings.manualBook = book;
    state.settings.manualChapter = chapter;
    state.settings.bibleTranslation = translation;
    updateSelectElements(book, chapter, translation);
    updateUIElements(book, chapter, translation);
}
function updateSelectElements(book, chapter, translation) {
    const bookSelect = document.getElementById('bookSelect');
    const chapterSelect = document.getElementById('chapterSelect');
    const translationSelect = document.getElementById('bibleTranslationSetting');
    if (bookSelect) bookSelect.value = book;
    if (chapterSelect) {
        populateChapterDropdown(book);
        chapterSelect.value = chapter;
    }
    if (translationSelect) translationSelect.value = translation;
    updateChapterDropdownVisibility(book);
}
function updateUIElements(book, chapter, translation) {
    const passageRefElement = document.getElementById('passageReference');
    const headerTitleEl = document.getElementById('passageHeaderTitle');
    if (passageRefElement) {
        passageRefElement.textContent = `${book} ${chapter}`;
        state.currentPassageReference = `${book} ${chapter}`;
    }
    if (headerTitleEl) {
        headerTitleEl.textContent = `Holy Bible: ${translation}`;
    }
}
function updateBrowserHistory(translation, book, chapter) {
    window.history.replaceState(
        { translation, book, chapter },
        '',
        window.location.search
    );
}
export function setupPopStateListener() {
    window.addEventListener('popstate', (event) => {
        if (event.state) {
            const { translation, book, chapter, verse } = event.state;
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
            updateURL(translation, book, chapter, 'replace');
            loadSelectedChapter(book, chapter);
            if (verse) {
                setTimeout(() => scrollToVerse(verse), 100);
            }
        } else {
            navigateFromURL();
        }
    });
}
function applyPopStateNavigation(stateData) {
    const { translation, book, chapter } = stateData;
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
}
export function setupNavigationWithURL() {
    const bookSelect = document.getElementById('bookSelect');
    const chapterSelect = document.getElementById('chapterSelect');
    if (!bookSelect || !chapterSelect) return;
    bookSelect.addEventListener('change', (e) => {
        const book = e.target.value;
        const chapter = 1;
        const translation = getCurrentTranslation();
        updateURL(translation, book, chapter, 'push');
        loadSelectedChapter(book, chapter);
    });
    chapterSelect.addEventListener('change', (e) => {
        const book = document.getElementById('bookSelect').value;
        const chapter = parseInt(e.target.value);
        const translation = getCurrentTranslation();
        updateURL(translation, book, chapter, 'push');
        loadSelectedChapter(book, chapter);
    });
}