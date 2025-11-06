/*=====================================================================
  Provinent Scripture Study – passage.js
=====================================================================*/


/* ====================================================================
   TABLE OF CONTENTS
   
	DISPLAY PASSAGE IN MAIN PANEL
    EXTRACT TEXT FROM VERSE OBJECTS
    LOAD CURRENT PASSAGE
==================================================================== */


/* Global imports */
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


/* ====================================================================
   DISPLAY PASSAGE IN MAIN PANEL
   Render verses with highlighting and click handlers
==================================================================== */

/* Display verses in the scripture content area with footnotes */
export function displayPassage(verses) {
    const container = document.getElementById('scriptureContent');
    
    // Use DocumentFragment for better performance
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

        // Cache verse text for highlights modal
        const cachedVerses = JSON.parse(localStorage.getItem('cachedVerses') || '{}');
        cachedVerses[v.reference] = v.text.text.replace(/<[^>]*>/g, '');
        localStorage.setItem('cachedVerses', JSON.stringify(cachedVerses));
    });
    
    // Single DOM update
    container.innerHTML = '';
    container.appendChild(fragment);
    
    // Setup footnotes
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
            // Use consistent attribute naming
            footnoteElement.dataset.footnoteId = fn.index;
            footnoteElement.dataset.footnoteNumber = fn.number;
            footnotesFragment.appendChild(footnoteElement);
        });
        
        footnotesContainer.appendChild(footnotesFragment);
        container.appendChild(separator);
        container.appendChild(heading);
        container.appendChild(footnotesContainer);
    }

    // Setup event delegation for verse clicks
    container.addEventListener('click', (e) => {
        const verse = e.target.closest('.verse');
        if (verse && !e.target.closest('.footnote-ref')) {
            showStrongsReference(verse);
        }
    }, { once: false });

    // Set up footnote handlers AFTER the content is in the DOM
    setTimeout(() => {
        setupFootnoteHandlers();
    }, 100);
}

/* HELPER: For displayPassage() to properly setup footnote click handlers */
export function setupFootnoteHandlers() {
    // Remove old delegation if it exists
    const scriptureContent = document.getElementById('scriptureContent');
    if (scriptureContent._footnoteHandler) {
        scriptureContent.removeEventListener('click', scriptureContent._footnoteHandler);
    }
    
    // Create new handler
    const footnoteHandler = (e) => {
        // Handle footnote number clicks (sup elements with footnote-ref class)
        const footnoteRef = e.target.closest('[class*="footnote-ref"]');
        
        // Handle footnote container clicks (div elements with footnote class)
        const footnoteElement = e.target.closest('.footnote');
        
        if (footnoteRef) {
            e.preventDefault();
            e.stopPropagation();
            
            // Get the ID/number from the data attributes (handle spaces)
            const footnoteId = (footnoteRef.dataset.footnoteId || '').trim();
            const footnoteNumber = (footnoteRef.dataset.footnoteNumber || '').trim();
            
            // Look for the corresponding footnote element
            let targetFootnote = null;
            
            // First try exact ID match
            if (footnoteId) {
                targetFootnote = scriptureContent.querySelector(`.footnote[data-footnote-id="${footnoteId}"]`);
            }
            
            // If no ID match, try number match
            if (!targetFootnote && footnoteNumber) {
                targetFootnote = scriptureContent.querySelector(`.footnote[data-footnote-number="${footnoteNumber}"]`);
            }
            
            // If still not found, try partial matches
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
                
                // Visual feedback
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
            
            // Get the ID/number from the data attributes
            const footnoteId = (footnoteElement.dataset.footnoteId || '').trim();
            const footnoteNumber = (footnoteElement.dataset.footnoteNumber || '').trim();
            
            // Look for the corresponding footnote reference
            let targetRef = null;
            
            // Try multiple selectors to find the reference
            const selectors = [
                `[class*="footnote-ref"][data-footnote-id="${footnoteId}"]`,
                `[class*="footnote-ref"][data-footnote-number="${footnoteNumber}"]`,
                `[class*="footnote-ref"][data-footnote-id="${footnoteNumber}"]`, // Maybe they're swapped?
                `[class*="footnote-ref"][data-footnote-number="${footnoteId}"]`  // Maybe they're swapped?
            ];
            
            for (const selector of selectors) {
                targetRef = scriptureContent.querySelector(selector);
                if (targetRef) break;
            }
            
            // If still not found, try a more flexible search
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
                
                // Visual feedback
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
    
    // Store reference for cleanup and add the event listener
    scriptureContent._footnoteHandler = footnoteHandler;
    scriptureContent.addEventListener('click', footnoteHandler);
}


/* ====================================================================
   EXTRACT TEXT FROM VERSE OBJECTS
   Parse complex verse structures from API into plain text
==================================================================== */

/* Extract plain text from verse content objects with proper footnote handling */
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
            // Try to extract text if available
            if (item.content && Array.isArray(item.content)) {
                const nestedResult = extractVerseText(item.content, chapterFootnotes, footnoteCounter);
                txt += nestedResult.text;
                footnotes.push(...nestedResult.footnotes);
            }
        }
    }
    
    // Replace multiple spaces with single spaces
    txt = txt.replace(/\s+/g, ' ').trim();
    
    // Fix punctuation spacing
    txt = txt.replace(/\s+([.,;:!?])/g, '$1'); // Remove space before punctuation
    txt = txt.replace(/([.,;:!?])(?=\w)/g, '$1 '); // Add space after punctuation if followed by word
    
    // Fix quotes
    txt = txt.replace(/\s*"\s*/g, '" '); // Ensure space after opening quote
    txt = txt.replace(/\s*'\s*/g, "' "); // Ensure space after single quote
    
    return { 
        text: txt,
        footnotes: footnotes
    };
}

/* HELPER: For extractVerseText() to ensure proper spacing around text elements */
function ensureProperSpacing(text) {
    if (!text) return '';
    
    // First, normalize all whitespace
    let cleanedText = text
        .replace(/\s+/g, ' ')       // Collapse multiple spaces to one
        .trim();
    
    // Handle punctuation spacing more intelligently
    cleanedText = cleanedText
        // Remove spaces before punctuation (except after opening quotes)
        .replace(/([^'"\s])\s+([.,;:!?])/g, '$1$2')
        // Add space after punctuation when it's followed by a word (but not if it's inside quotes)
        .replace(/([.,;:!?])(?=[A-Za-z])/g, '$1 ')
        // Handle quotes - remove internal spaces but preserve external spacing
        .replace(/\s*"\s*/g, (match) => {
            // If the quote is at the start or end of text, don't add extra space
            if (match === '"' || match === ' "') return '"';
            return '" ';
        })
        .replace(/\s*'\s*/g, (match) => {
            if (match === "'" || match === " '") return "'";
            return "' ";
        });
    
    // Final cleanup of any remaining odd spacing
    cleanedText = cleanedText
        .replace(/\s+/g, ' ')
        .replace(/([.,;:!?]) (["'])/g, '$1$2')  // Remove space between punctuation and quote
        .replace(/(["']) ([.,;:!?])/g, '$1$2')  // Remove space between quote and punctuation
        .trim();
    
    return cleanedText;
}


/* ====================================================================
   LOAD CURRENT PASSAGE
   Main entry point for loading scripture content
==================================================================== */

/* Load the passage at current index in reading plan or manual selection */
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
            
            // Show "Holy Bible: [Translation]" not "Passage of the Day"
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

/* Load custom event after content */
export function afterContentLoad() {
    const event = new CustomEvent('contentLoaded');
    document.dispatchEvent(event);
}

/* Scroll to a specific verse number in the displayed passage when selected from highlights modal*/
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

/* Update the passage reference display and state */
function updateDisplayRef(book, chapter) {
    const displayRef = `${book} ${chapter}`;
    document.getElementById('passageReference').textContent = displayRef;
    state.currentPassageReference = displayRef;
}
