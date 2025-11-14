/*=====================================================================
  Provinent Scripture Study – highlights.js
=====================================================================*/

/* Global imports */
import { loadSelectedChapter, syncBookChapterSelectors } from './navigation.js'

import { updateDisplayRef } from './passage.js';

import {
    BOOK_ORDER,
    saveToStorage,
    state
} from './state.js'

/* ====================================================================
   HIGHLIGHTING
   Right-click color picker for verse highlighting
==================================================================== */

/* Show color picker at mouse position */
export function showColorPicker(ev, verseEl) {
    const picker = document.getElementById('colorPicker');
    state.currentVerse = verseEl;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const pickerWidth = 200;
    const pickerHeight = 50;
    
    const clientX = ev.clientX || (ev.touches && ev.touches[0].clientX) || 0;
    const clientY = ev.clientY || (ev.touches && ev.touches[0].clientY) || 0;
    
    let adjustedX = clientX;
    let adjustedY = clientY;
    
    if (clientX + pickerWidth > viewportWidth) {
        adjustedX = viewportWidth - pickerWidth - 10;
    }
    
    if (clientY + pickerHeight > viewportHeight) {
        adjustedY = viewportHeight - pickerHeight - 10;
    }
    
    adjustedX = Math.max(10, adjustedX);
    adjustedY = Math.max(10, adjustedY);
    
    picker.style.left = adjustedX + 'px';
    picker.style.top = adjustedY + 'px';
    picker.classList.add('active');
    
    ev.preventDefault();
    ev.stopPropagation();
}

/* Apply highlight color to selected verse */
export function applyHighlight(col) {
    if (!state.currentVerse) return;

    const verseRef = state.currentVerse.dataset.verse;
    
    state.currentVerse.classList.remove(
        'highlight-yellow', 'highlight-green', 'highlight-blue',
        'highlight-pink', 'highlight-orange', 'highlight-purple'
    );
    
    if (col !== 'none') {
        state.currentVerse.classList.add(`highlight-${col}`);
        state.highlights[verseRef] = col;
    } else {
        delete state.highlights[verseRef];
    }
    
    saveToStorage();
    document.getElementById('colorPicker').classList.remove('active');
}

/* Clear all verse highlights */
export function clearHighlights() {
    if (!confirm('Delete ALL highlights?')) return;
    
    state.highlights = {};
    document.querySelectorAll('.verse')
            .forEach(v => v.classList.remove(
                'highlight-yellow', 'highlight-green', 'highlight-blue',
                'highlight-pink', 'highlight-orange', 'highlight-purple'
            ));
    saveToStorage();
}

/* Open highlights modal */
export function showHighlightsModal() {
    const overlay = document.getElementById('highlightsOverlay');
    const modal = document.getElementById('highlightsModal');
    
    overlay.classList.add('active');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    const searchInput = document.getElementById('highlightsSearch');
    if (searchInput) {
        searchInput.value = '';
    }
    
    const filterButtons = document.querySelectorAll('.highlight-filter-btn');
    filterButtons.forEach(btn => btn.classList.remove('active'));
    
    const allButton = document.querySelector('.highlight-filter-btn[data-color="all"]');
    if (allButton) {
        allButton.classList.add('active');
    }
    
    renderHighlights('all', '');
    
    setupHighlightsSearch();
}

/* Setup search functionality */
function setupHighlightsSearch() {
    const searchInput = document.getElementById('highlightsSearch');
    const clearSearchBtn = document.getElementById('clearSearch');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const activeFilter = document.querySelector('.highlight-filter-btn.active')?.dataset.color || 'all';
            renderHighlights(activeFilter, searchTerm);
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            const searchInput = document.getElementById('highlightsSearch');
            searchInput.value = '';
            const activeFilter = document.querySelector('.highlight-filter-btn.active')?.dataset.color || 'all';
            renderHighlights(activeFilter, '');
        });
    }
}

/* Close highlights modal */
export function closeHighlightsModal() {
    const overlay = document.getElementById('highlightsOverlay');
    const modal = document.getElementById('highlightsModal');
    
    overlay.classList.remove('active');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

/* Render highlights list in modal */
export function renderHighlights(filterColor = 'all', searchTerm = '') {
    const highlightsList = document.getElementById('highlightsList');
    const highlights = state.highlights || {};
    
    if (Object.keys(highlights).length === 0) {
        highlightsList.innerHTML = '<div class="no-highlights">No verses have been highlighted yet</div>';
        return;
    }
    
    let html = '';
    let matchCount = 0;
    
    const sortableReferences = Object.keys(highlights).map(reference => {
        const match = reference.match(/^(\d*\s*\w+)\s+(\d+):(\d+)$/);
        if (!match) return null;
        
        let bookName = match[1].trim();
        const chapter = parseInt(match[2]);
        const verse = parseInt(match[3]);
        const color = highlights[reference];
        
        const bookParts = bookName.split(' ');
        let baseBookName = bookName;
        let bookNumber = '';
        
        if (bookParts.length > 1 && /^\d+$/.test(bookParts[0])) {
            bookNumber = bookParts[0];
            baseBookName = bookParts.slice(1).join(' ');
        }
        
        const bookIndex = BOOK_ORDER.findIndex(book => {
            const orderParts = book.split(' ');
            let orderBaseName = book;
            let orderNumber = '';
            
            if (orderParts.length > 1 && /^\d+$/.test(orderParts[0])) {
                orderNumber = orderParts[0];
                orderBaseName = orderParts.slice(1).join(' ');
            }
            
            return orderBaseName.toLowerCase() === baseBookName.toLowerCase() && 
                   orderNumber === bookNumber;
        });
        
        return {
            reference,
            bookName,
            baseBookName,
            bookNumber,
            bookIndex,
            chapter,
            verse,
            color
        };
    }).filter(ref => ref !== null && ref.bookIndex !== -1);
    
    sortableReferences.sort((a, b) => {
        if (a.bookIndex !== b.bookIndex) {
            return a.bookIndex - b.bookIndex;
        }
        if (a.chapter !== b.chapter) {
            return a.chapter - b.chapter;
        }
        return a.verse - b.verse;
    });
    
    sortableReferences.forEach(ref => {
        if (filterColor !== 'all' && ref.color !== filterColor) {
            return;
        }
        
        const verseText = getVerseTextFromStorage(ref.reference) || 'Text not available, click to refresh';
        
        // Apply search filtering
        if (searchTerm && !verseText.toLowerCase().includes(searchTerm) && 
            !ref.reference.toLowerCase().includes(searchTerm)) {
            return;
        }
        
        matchCount++;
        
        // Highlight matching search terms in the text
        let displayText = verseText;
        if (searchTerm) {
            const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            displayText = verseText.replace(regex, '<mark>$1</mark>');
        }
        
        html += `
            <div class="highlight-item ${ref.color}" data-reference="${ref.reference}" data-color="${ref.color}">
                <div class="highlight-ref">${ref.reference}</div>
                <div class="highlight-text">${displayText}</div>
            </div>
        `;
    });
    
    if (matchCount === 0) {
        const noResultsMsg = searchTerm 
            ? `No highlights found matching "${searchTerm}"`
            : 'No highlights match the selected filter';
        html = `<div class="no-results">${noResultsMsg}</div>`;
    }
    
    highlightsList.innerHTML = html;
    
    document.querySelectorAll('.highlight-item').forEach(item => {
        item.addEventListener('click', () => {
            const reference = item.dataset.reference;
            navigateToHighlightedVerse(reference);
            closeHighlightsModal();
        });
    });
}

/* Scroll to a specific verse number in the displayed passage when selected from highlights modal*/
function scrollToVerse(verseNumber) {
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

/* Retrieve verse text from localStorage cache */
function getVerseTextFromStorage(reference) {
    try {
        const cachedVerses = JSON.parse(localStorage.getItem('cachedVerses') || '{}');
        return cachedVerses[reference];
    } catch (e) {
        return null;
    }
}

/* Navigate to the highlighted verse in the main passage when selected from highlights modal */
function navigateToHighlightedVerse(reference) {
    // Parse reference format: "Book Chapter:Verse"
    const match = reference.match(/^(.+?) (\d+):(\d+)$/);
    if (!match) return;
    
    const [, book, chapter, verse] = match;
    
    // Update navigation
    state.settings.manualBook = book;
    state.settings.manualChapter = parseInt(chapter);
    
    // Load the chapter
    loadSelectedChapter(book, chapter);
    
    // Scroll to the specific verse
    setTimeout(() => scrollToVerse(verse), 500);
}
