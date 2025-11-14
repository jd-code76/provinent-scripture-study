import { loadPassageFromAPI } from './api.js';
import { escapeHTML, handleError, updateHeaderTitle } from '../main.js';
import { getCurrentTranslation } from './navigation.js';
import { saveToStorage, state } from './state.js';
import { showStrongsReference } from './strongs.js';
import { updateReferencePanel } from './ui.js';
const SINGLE_CHAPTER_BOOKS = new Set([
    'Obadiah', 'Philemon', '2 John', '3 John', 'Jude'
]);
export function displayPassage(contentItems) {
    try {
        const container = document.getElementById('scriptureContent');
        if (!container) return;
        const fragment = document.createDocumentFragment();
        state.footnotes = {};
        const allFootnotes = [];
        contentItems.forEach(item => {
            switch (item.type) {
                case 'verse':
                    processVerseItem(item, fragment, allFootnotes);
                    break;
                case 'heading':
                    processHeadingItem(item, fragment);
                    break;
            }
        });
        container.innerHTML = '';
        container.appendChild(fragment);
        if (allFootnotes.length > 0) {
            addFootnotesToContainer(container, allFootnotes);
        }
        setupVerseClickHandler(container);
        setTimeout(setupFootnoteHandlers, 100);
    } catch (error) {
        console.error('Error displaying passage:', error);
        handleError(error, 'displayPassage');
    }
}
function processVerseItem(verse, fragment, allFootnotes) {
    const verseDiv = createVerseElement(verse);
    if (verse.text.footnotes?.length > 0) {
        state.footnotes[verse.reference] = verse.text.footnotes;
        allFootnotes.push(...verse.text.footnotes);
    }
    fragment.appendChild(verseDiv);
    cacheVerseText(verse);
}
function createVerseElement(verse) {
    const verseDiv = document.createElement('div');
    verseDiv.className = 'verse';
    verseDiv.dataset.verse = verse.reference;
    verseDiv.dataset.verseNumber = verse.number;
    verseDiv.dataset.verseText = getPlainVerseText(verse.text.text);
    const highlightColor = state.highlights[verse.reference];
    if (highlightColor) {
        verseDiv.classList.add(`highlight-${highlightColor}`);
    }
    const numSpan = document.createElement('span');
    numSpan.className = 'verse-number';
    numSpan.textContent = verse.number;
    const txtSpan = document.createElement('span');
    txtSpan.className = 'verse-text';
    txtSpan.innerHTML = verse.text.text;
    verseDiv.appendChild(numSpan);
    verseDiv.appendChild(txtSpan);
    return verseDiv;
}
function getPlainVerseText(htmlText) {
    return htmlText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
function cacheVerseText(verse) {
    try {
        const cachedVerses = JSON.parse(localStorage.getItem('cachedVerses') || '{}');
        cachedVerses[verse.reference] = getPlainVerseText(verse.text.text);
        localStorage.setItem('cachedVerses', JSON.stringify(cachedVerses));
    } catch (error) {
        console.error('Error caching verse text:', error);
    }
}
function processHeadingItem(heading, fragment) {
    const headingDiv = document.createElement('div');
    headingDiv.className = 'chapter-heading';
    headingDiv.innerHTML = `<h3>${escapeHTML(heading.content)}</h3>`;
    fragment.appendChild(headingDiv);
}
function addFootnotesToContainer(container, footnotes) {
    const footnotesContainer = document.createElement('div');
    footnotesContainer.className = 'footnotes-container';
    const separator = document.createElement('hr');
    separator.className = 'footnotes-separator';
    const heading = document.createElement('h4');
    heading.className = 'footnotes-heading';
    heading.textContent = 'Footnotes';
    const footnotesFragment = document.createDocumentFragment();
    footnotes
        .sort((a, b) => a.number - b.number)
        .forEach(fn => {
            const footnoteElement = createFootnoteElement(fn);
            footnotesFragment.appendChild(footnoteElement);
        });
    footnotesContainer.appendChild(footnotesFragment);
    container.appendChild(separator);
    container.appendChild(heading);
    container.appendChild(footnotesContainer);
}
function createFootnoteElement(footnote) {
    const footnoteElement = document.createElement('div');
    footnoteElement.className = 'footnote';
    footnoteElement.innerHTML = `
        <sup class="footnote-number">${footnote.number}</sup>
        <span class="footnote-content">${escapeHTML(footnote.content)}</span>
    `;
    footnoteElement.dataset.footnoteId = footnote.index;
    footnoteElement.dataset.footnoteNumber = footnote.number;
    return footnoteElement;
}
function setupVerseClickHandler(container) {
    container.addEventListener('click', (event) => {
        const verse = event.target.closest('.verse');
        if (verse && !event.target.closest('.footnote-ref')) {
            showStrongsReference(verse);
        }
    });
}
export function setupFootnoteHandlers() {
    try {
        const scriptureContent = document.getElementById('scriptureContent');
        if (!scriptureContent) return;
        if (scriptureContent._footnoteHandler) {
            scriptureContent.removeEventListener('click', scriptureContent._footnoteHandler);
        }
        const footnoteHandler = createFootnoteHandler();
        scriptureContent._footnoteHandler = footnoteHandler;
        scriptureContent.addEventListener('click', footnoteHandler);
    } catch (error) {
        console.error('Error setting up footnote handlers:', error);
    }
}
function createFootnoteHandler() {
    return (event) => {
        const footnoteRef = event.target.closest('[class*="footnote-ref"]');
        const footnoteElement = event.target.closest('.footnote');
        if (footnoteRef) {
            handleFootnoteRefClick(event, footnoteRef);
        } else if (footnoteElement) {
            handleFootnoteElementClick(event, footnoteElement);
        }
    };
}
function handleFootnoteRefClick(event, footnoteRef) {
    event.preventDefault();
    event.stopPropagation();
    const scriptureContent = document.getElementById('scriptureContent');
    if (!scriptureContent) return;
    const footnoteId = (footnoteRef.dataset.footnoteId || '').trim();
    const footnoteNumber = (footnoteRef.dataset.footnoteNumber || '').trim();
    const targetFootnote = findFootnote(scriptureContent, footnoteId, footnoteNumber);
    if (targetFootnote) {
        scrollToFootnote(targetFootnote);
        highlightTemporarily(targetFootnote);
    }
}
function handleFootnoteElementClick(event, footnoteElement) {
    event.preventDefault();
    event.stopPropagation();
    const scriptureContent = document.getElementById('scriptureContent');
    if (!scriptureContent) return;
    const footnoteId = (footnoteElement.dataset.footnoteId || '').trim();
    const footnoteNumber = (footnoteElement.dataset.footnoteNumber || '').trim();
    const targetRef = findFootnoteRef(scriptureContent, footnoteId, footnoteNumber);
    if (targetRef) {
        scrollToFootnote(targetRef);
        highlightTemporarily(targetRef);
    }
}
function findFootnote(container, id, number) {
    const selectors = [
        `.footnote[data-footnote-id="${id}"]`,
        `.footnote[data-footnote-number="${number}"]`
    ];
    for (const selector of selectors) {
        const element = container.querySelector(selector);
        if (element) return element;
    }
    return null;
}
function findFootnoteRef(container, id, number) {
    const selectors = [
        `[class*="footnote-ref"][data-footnote-id="${id}"]`,
        `[class*="footnote-ref"][data-footnote-number="${number}"]`
    ];
    for (const selector of selectors) {
        const element = container.querySelector(selector);
        if (element) return element;
    }
    return null;
}
function scrollToFootnote(element) {
    element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start'
    });
}
function highlightTemporarily(element) {
    element.style.backgroundColor = 'var(--verse-hover)';
    setTimeout(() => {
        element.style.backgroundColor = '';
    }, 1500);
}
export function extractVerseText(content, chapterFootnotes = [], footnoteCounter) {
    let text = '';
    const footnotes = [];
    for (const item of content) {
        const result = processContentItem(item, chapterFootnotes, footnoteCounter);
        text += result.text;
        footnotes.push(...result.footnotes);
    }
    text = cleanText(text);
    return { text, footnotes };
}
function processContentItem(item, chapterFootnotes, footnoteCounter) {
    let text = '';
    const footnotes = [];
    if (typeof item === 'string') {
        text = ensureProperSpacing(item) + ' ';
    } else if (item.text) {
        text = ensureProperSpacing(item.text) + ' ';
    } else if (item.heading) {
        text = ' ' + ensureProperSpacing(item.heading) + ' ';
    } else if (item.noteId !== undefined) {
        const footnoteResult = processFootnote(item.noteId, chapterFootnotes, footnoteCounter);
        text = footnoteResult.text;
        footnotes.push(...footnoteResult.footnotes);
    } else if (item.content && Array.isArray(item.content)) {
        const nestedResult = extractVerseText(item.content, chapterFootnotes, footnoteCounter);
        text = nestedResult.text;
        footnotes.push(...nestedResult.footnotes);
    } else {
        text = ' ';
    }
    return { text, footnotes };
}
function processFootnote(noteId, chapterFootnotes, footnoteCounter) {
    const footnote = chapterFootnotes.find(fn => fn.noteId === noteId);
    if (!footnote) return { text: '', footnotes: [] };
    const footnoteRef = createFootnoteRef(footnote, footnoteCounter.value);
    const footnotes = [{
        index: footnote.noteId,
        number: footnoteCounter.value,
        caller: footnote.caller,
        content: footnote.text,
        reference: footnote.reference
    }];
    footnoteCounter.value++;
    return { text: footnoteRef, footnotes };
}
function createFootnoteRef(footnote, number) {
    return `<sup class="footnote-ref" 
                 data-footnote-id="${footnote.noteId}" 
                 data-footnote-number="${number}">
        ${number}
    </sup>`;
}
function cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
}
function ensureProperSpacing(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}
export async function loadPassage(book = null, chapter = null, translation = null) {
    if (window._isLoadingPassage) return;
    if (!book && !chapter && state.settings.readingMode === 'manual') {
        return;
    }
    window._isLoadingPassage = true;
    try {
        state.settings.manualBook = book || state.settings.manualBook;
        state.settings.manualChapter = chapter || state.settings.manualChapter;
        updateHeaderTitle();
        updateDisplayRef(state.settings.manualBook, state.settings.manualChapter);
        await loadPassageFromAPI({
            book: state.settings.manualBook,
            chapter: state.settings.manualChapter,
            startVerse: 1,
            endVerse: 999,
            displayRef: `${state.settings.manualBook} ${state.settings.manualChapter}`,
            translation: translation || getCurrentTranslation()
        });
        if (state.settings.referencePanelOpen) {
            updateReferencePanel();
        }
        saveToStorage();
    } catch (error) {
        handleError(error, 'loadPassage');
    } finally {
        window._isLoadingPassage = false;
    }
}
export function afterContentLoad() {
    const event = new CustomEvent('contentLoaded');
    document.dispatchEvent(event);
}
export function updateDisplayRef(book, chapter) {
    try {
        const passageRefElement = document.getElementById('passageReference');
        if (!passageRefElement) return;
        const isSingleChapter = SINGLE_CHAPTER_BOOKS.has(book);
        const displayRef = isSingleChapter ? book : `${book} ${chapter}`;
        passageRefElement.textContent = displayRef;
        state.currentPassageReference = displayRef;
        updateChapterDropdownVisibility(book);
    } catch (error) {
        console.error('Error updating display reference:', error);
    }
}
function updateChapterDropdownVisibility(book) {
    const chapterSelect = document.getElementById('chapterSelect');
    const chapterLabel = document.querySelector('label[for="chapterSelect"]');
    if (!chapterSelect) return;
    const isSingleChapter = SINGLE_CHAPTER_BOOKS.has(book);
    chapterSelect.style.display = isSingleChapter ? 'none' : 'block';
    if (chapterLabel) {
        chapterLabel.style.display = isSingleChapter ? 'none' : 'block';
    }
}