import { loadPassageFromAPI } from './api.js'
import { handleError } from '../main.js'
import { 
    getCurrentTranslation, 
    syncBookChapterSelectors, 
    syncSelectorsToReadingPlan 
} from './navigation.js'
import {
    getActivePlan,
    getCurrentPlanLabel,
    saveToStorage,
    state
} from './state.js'
import { showStrongsReference } from './strongs.js'
import { updateReferencePanel } from './ui.js'
export function displayPassage(verses) {
    const container = document.getElementById('scriptureContent');
    const fragment = document.createDocumentFragment();
    state.footnotes = {};
    const allFootnotes = [];
    verses.forEach(v => {
        const verseDiv = document.createElement('div');
        verseDiv.className = 'verse';
        verseDiv.dataset.verse = v.reference;
        verseDiv.dataset.verseNumber = v.number;
        let plainText = v.text.text;
        plainText = plainText.replace(/<[^>]*>/g, '');
        plainText = plainText.replace(/\s+/g, ' ').trim();
        verseDiv.dataset.verseText = plainText;
        const key = v.reference;
        if (state.highlights[key]) {
            verseDiv.classList.add(`highlight-${state.highlights[key]}`);
        }
        const numSpan = document.createElement('span');
        numSpan.className = 'verse-number';
        numSpan.textContent = v.number;
        const txtSpan = document.createElement('span');
        txtSpan.className = 'verse-text';
        txtSpan.innerHTML = v.text.text;
        if (v.text.footnotes && v.text.footnotes.length > 0) {
            state.footnotes[v.reference] = v.text.footnotes;
            allFootnotes.push(...v.text.footnotes);
        }
        verseDiv.appendChild(numSpan);
        verseDiv.appendChild(txtSpan);
        fragment.appendChild(verseDiv);
        const cachedVerses = JSON.parse(localStorage.getItem('cachedVerses') || '{}');
        cachedVerses[v.reference] = v.text.text.replace(/<[^>]*>/g, '');
        localStorage.setItem('cachedVerses', JSON.stringify(cachedVerses));
    });
    container.innerHTML = '';
    container.appendChild(fragment);
    if (allFootnotes.length > 0) {
        const footnotesContainer = document.createElement('div');
        footnotesContainer.className = 'footnotes-container';
        const separator = document.createElement('hr');
        separator.className = 'footnotes-separator';
        const heading = document.createElement('h4');
        heading.className = 'footnotes-heading';
        heading.textContent = 'Footnotes';
        const footnotesFragment = document.createDocumentFragment();
        allFootnotes.sort((a, b) => a.number - b.number).forEach(fn => {
            const footnoteElement = document.createElement('div');
            footnoteElement.className = 'footnote';
            footnoteElement.innerHTML = `
                <sup class="footnote-number">${fn.number}</sup>
                <span class="footnote-content">${fn.content}</span>
            `;
            footnoteElement.dataset.footnoteId = fn.index;
            footnoteElement.dataset.footnoteNumber = fn.number;
            footnotesFragment.appendChild(footnoteElement);
        });
        footnotesContainer.appendChild(footnotesFragment);
        container.appendChild(separator);
        container.appendChild(heading);
        container.appendChild(footnotesContainer);
    }
    container.addEventListener('click', (e) => {
        const verse = e.target.closest('.verse');
        if (verse && !e.target.closest('.footnote-ref')) {
            showStrongsReference(verse);
        }
    }, { once: false });
    setTimeout(() => {
        setupFootnoteHandlers();
    }, 100);
}
export function setupFootnoteHandlers() {
    const scriptureContent = document.getElementById('scriptureContent');
    if (scriptureContent._footnoteHandler) {
        scriptureContent.removeEventListener('click', scriptureContent._footnoteHandler);
    }
    const footnoteHandler = (e) => {
        const footnoteRef = e.target.closest('[class*="footnote-ref"]');
        const footnoteElement = e.target.closest('.footnote');
        if (footnoteRef) {
            e.preventDefault();
            e.stopPropagation();
            const footnoteId = (footnoteRef.dataset.footnoteId || '').trim();
            const footnoteNumber = (footnoteRef.dataset.footnoteNumber || '').trim();
            let targetFootnote = null;
            if (footnoteId) {
                targetFootnote = scriptureContent.querySelector(`.footnote[data-footnote-id="${footnoteId}"]`);
            }
            if (!targetFootnote && footnoteNumber) {
                targetFootnote = scriptureContent.querySelector(`.footnote[data-footnote-number="${footnoteNumber}"]`);
            }
            if (!targetFootnote && footnoteId) {
                const allFootnotes = scriptureContent.querySelectorAll('.footnote');
                for (const fn of allFootnotes) {
                    const fnId = (fn.dataset.footnoteId || '').trim();
                    const fnNum = (fn.dataset.footnoteNumber || '').trim();
                    if (fnId === footnoteId) {
                        targetFootnote = fn;
                        break;
                    }
                }
            }
            if (targetFootnote) {
                targetFootnote.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start'
                });
                targetFootnote.style.backgroundColor = 'var(--verse-hover)';
                setTimeout(() => {
                    targetFootnote.style.backgroundColor = '';
                }, 1000);
            } else {
                console.log('No target footnote found for ref:', footnoteId, footnoteNumber);
            }
        }
        if (footnoteElement) {
            e.preventDefault();
            e.stopPropagation();
            const footnoteId = (footnoteElement.dataset.footnoteId || '').trim();
            const footnoteNumber = (footnoteElement.dataset.footnoteNumber || '').trim();
            let targetRef = null;
            const selectors = [
                `[class*="footnote-ref"][data-footnote-id="${footnoteId}"]`,
                `[class*="footnote-ref"][data-footnote-number="${footnoteNumber}"]`,
                `[class*="footnote-ref"][data-footnote-id="${footnoteNumber}"]`, 
                `[class*="footnote-ref"][data-footnote-number="${footnoteId}"]`  
            ];
            for (const selector of selectors) {
                targetRef = scriptureContent.querySelector(selector);
                if (targetRef) break;
            }
            if (!targetRef) {
                const allRefs = scriptureContent.querySelectorAll('[class*="footnote-ref"]');
                for (const ref of allRefs) {
                    const refId = (ref.dataset.footnoteId || '').trim();
                    const refNum = (ref.dataset.footnoteNumber || '').trim();
                    if (refId === footnoteId || refNum === footnoteNumber || 
                        refId === footnoteNumber || refNum === footnoteId) {
                        targetRef = ref;
                        break;
                    }
                }
            }
            if (targetRef) {
                targetRef.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center'
                });
                targetRef.style.backgroundColor = 'var(--verse-hover)';
                setTimeout(() => {
                    targetRef.style.backgroundColor = '';
                }, 1000);
            } else {
                console.log('No target ref found for footnote:', footnoteId, footnoteNumber);
                console.log('Available refs:', scriptureContent.querySelectorAll('[class*="footnote-ref"]'));
            }
        }
    };
    scriptureContent._footnoteHandler = footnoteHandler;
    scriptureContent.addEventListener('click', footnoteHandler);
}
export function extractVerseText(content, chapterFootnotes = [], footnoteCounter) {
    let txt = '';
    let footnotes = [];
    for (const item of content) {
        if (typeof item === 'string') {
            txt += ensureProperSpacing(item);
        } else if (item.text) {
            txt += ensureProperSpacing(item.text);
        } else if (item.heading) {
            txt += ' ' + ensureProperSpacing(item.heading) + ' ';
        } else if (item.noteId !== undefined) {
            const footnote = chapterFootnotes.find(fn => fn.noteId === item.noteId);
            if (footnote) {
                const footnoteRef = `<sup class="footnote-ref" data-footnote-id="${footnote.noteId}" data-footnote-number="${footnoteCounter.value}">${footnoteCounter.value}</sup>`;
                txt += footnoteRef;
                footnotes.push({
                    index: footnote.noteId,
                    number: footnoteCounter.value,
                    caller: footnote.caller,
                    content: footnote.text,
                    reference: footnote.reference
                });
                footnoteCounter.value++;
            }
        } else if (item.type === 'verse') {
            txt += ' ';
        } else if (item.type === 'chapter') {
            txt += ' ';
        } else {
            if (item.content && Array.isArray(item.content)) {
                const nestedResult = extractVerseText(item.content, chapterFootnotes, footnoteCounter);
                txt += nestedResult.text;
                footnotes.push(...nestedResult.footnotes);
            }
        }
    }
    txt = txt.replace(/\s+/g, ' ').trim();
    txt = txt.replace(/\s+([.,;:!?])/g, '$1'); 
    txt = txt.replace(/([.,;:!?])(?=\w)/g, '$1 '); 
    txt = txt.replace(/\s*"\s*/g, '" '); 
    txt = txt.replace(/\s*'\s*/g, "' "); 
    return { 
        text: txt,
        footnotes: footnotes
    };
}
function ensureProperSpacing(text) {
    if (!text) return '';
    let cleanedText = text
        .replace(/\s+/g, ' ')       
        .trim();
    cleanedText = cleanedText
        .replace(/([^'"\s])\s+([.,;:!?])/g, '$1$2')
        .replace(/([.,;:!?])(?=[A-Za-z])/g, '$1 ')
        .replace(/\s*"\s*/g, (match) => {
            if (match === '"' || match === ' "') return '"';
            return '" ';
        })
        .replace(/\s*'\s*/g, (match) => {
            if (match === "'" || match === " '") return "'";
            return "' ";
        });
    cleanedText = cleanedText
        .replace(/\s+/g, ' ')
        .replace(/([.,;:!?]) (["'])/g, '$1$2')  
        .replace(/(["']) ([.,;:!?])/g, '$1$2')  
        .trim();
    return cleanedText;
}
export async function loadPassage(book = null, chapter = null, translation = null) {
    if (window._isLoadingPassage) {
        return;
    }
    window._isLoadingPassage = true;
    try {
        if (book && chapter) {
            state.settings.readingMode = 'manual';
            state.settings.manualBook = book;
            state.settings.manualChapter = chapter;
            const headerTitleEl = document.getElementById('passageHeaderTitle');
            if (headerTitleEl) {
                const transShorthand = translation || getCurrentTranslation();
                headerTitleEl.textContent = `Holy Bible: ${transShorthand}`;
            }
            const planLabelEl = document.getElementById('planLabel');
            if (planLabelEl) {
                planLabelEl.textContent = '';
            }
            updateDisplayRef(state.settings.manualBook, state.settings.manualChapter);
            await loadPassageFromAPI({
                book: book,
                chapter: chapter,
                startVerse: 1,
                endVerse: 999,
                displayRef: updateDisplayRef(state.settings.manualBook, state.settings.manualChapter),
                translation: translation
            });
        } else {
            state.settings.readingMode = 'readingPlan';
            const plan = getActivePlan();
            if (state.settings.currentPassageIndex < 0 || state.settings.currentPassageIndex >= plan.length) {
                state.settings.currentPassageIndex = 0;
            }
            const passage = plan[state.settings.currentPassageIndex];
            const headerTitleEl = document.getElementById('passageHeaderTitle');
            if (headerTitleEl) {
                const transShorthand = getCurrentTranslation();
                headerTitleEl.textContent = `Holy Bible: ${transShorthand}`;
            }
            const planLabelEl = document.getElementById('planLabel');
            if (planLabelEl) {
                planLabelEl.textContent = `Reading plan: ${getCurrentPlanLabel()}`;
            }
            document.getElementById('passageReference').textContent = passage.displayRef;
            state.currentPassageReference = passage.displayRef;
            await loadPassageFromAPI(passage);
            syncSelectorsToReadingPlan();
        }
        if (state.settings.referencePanelOpen) {
            updateReferencePanel();
        }
        saveToStorage();
    } catch (err) {
        handleError(err, 'loadPassage');
    } finally {
        window._isLoadingPassage = false;
    }
}
export function afterContentLoad() {
    const event = new CustomEvent('contentLoaded');
    document.dispatchEvent(event);
}
export function scrollToVerse(verseNumber) {
    updateDisplayRef(state.settings.manualBook, state.settings.manualChapter);
    syncBookChapterSelectors();
    const verseElement = document.querySelector(`.verse[data-verse-number="${verseNumber}"]`);
    if (verseElement) {
        verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        verseElement.style.backgroundColor = 'var(--verse-hover)';
        setTimeout(() => {
            verseElement.style.backgroundColor = '';
        }, 1000);
    }
}
function updateDisplayRef(book, chapter) {
    const displayRef = `${book} ${chapter}`;
    document.getElementById('passageReference').textContent = displayRef;
    state.currentPassageReference = displayRef;
}