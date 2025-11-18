/*=====================================================================
  Provinent Scripture Study – highlights.js
  Verse highlighting and color management
=====================================================================*/

import { escapeHTML } from '../main.js';
import { loadSelectedChapter, syncBookChapterSelectors } from './navigation.js';
import { updateDisplayRef } from './passage.js';
import { BOOK_ORDER, saveToStorage, state, updateURL } from './state.js';

/* ====================================================================
   CONSTANTS
==================================================================== */

const HIGHLIGHT_COLORS = [
    'yellow', 'green', 'blue', 'pink', 'orange', 'purple'
];

/* ====================================================================
   HIGHLIGHTING FUNCTIONS
==================================================================== */

/**
 * Show color picker at mouse/touch position
 * @param {Event} ev - Mouse or touch event
 * @param {HTMLElement} verseEl - Verse element
 */
export function showColorPicker(ev, verseEl) {
    try {
        const picker = document.getElementById('colorPicker');
        if (!picker) return;
        
        state.currentVerse = verseEl;
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const pickerWidth = 200;
        const pickerHeight = 50;
        
        const clientX = ev.clientX || (ev.touches?.[0]?.clientX) || 0;
        const clientY = ev.clientY || (ev.touches?.[0]?.clientY) || 0;
        
        let adjustedX = Math.max(10, clientX);
        let adjustedY = Math.max(10, clientY);
        
        if (clientX + pickerWidth > viewportWidth) {
            adjustedX = viewportWidth - pickerWidth - 10;
        }
        
        if (clientY + pickerHeight > viewportHeight) {
            adjustedY = viewportHeight - pickerHeight - 10;
        }
        
        picker.style.left = adjustedX + 'px';
        picker.style.top = adjustedY + 'px';
        picker.classList.add('active');
        
        if (ev.preventDefault) ev.preventDefault();
        if (ev.stopPropagation) ev.stopPropagation();
        
    } catch (error) {
        console.error('Error showing color picker:', error);
    }
}

/**
 * Apply highlight color to selected verse
 * @param {string} color - Color to apply ('none' to remove)
 */
export function applyHighlight(color) {
    try {
        if (!state.currentVerse) return;
        
        const verseRef = state.currentVerse.dataset.verse;
        if (!verseRef) return;
        
        // Remove all highlight classes
        state.currentVerse.classList.remove(...HIGHLIGHT_COLORS.map(col => `highlight-${col}`));
        
        if (color !== 'none') {
            state.currentVerse.classList.add(`highlight-${color}`);
            state.highlights[verseRef] = color;
        } else {
            delete state.highlights[verseRef];
        }
        
        saveToStorage();
        
        const picker = document.getElementById('colorPicker');
        if (picker) picker.classList.remove('active');
        
    } catch (error) {
        console.error('Error applying highlight:', error);
    }
}

/**
 * Clear all verse highlights with confirmation
 */
export function clearHighlights() {
    try {
        if (!confirm('Are you sure you want to delete ALL highlights? This cannot be undone.')) {
            return;
        }
        
        state.highlights = {};
        
        // Remove highlight classes from all verses
        document.querySelectorAll('.verse').forEach(verse => {
            verse.classList.remove(...HIGHLIGHT_COLORS.map(col => `highlight-${col}`));
        });
        
        saveToStorage();
        
        // Refresh highlights modal if open
        const modal = document.getElementById('highlightsModal');
        if (modal?.classList.contains('active')) {
            renderHighlights('all', '');
        }
        
    } catch (error) {
        console.error('Error clearing highlights:', error);
    }
}

/* ====================================================================
   MODAL FUNCTIONS
==================================================================== */

/**
 * Open highlights modal
 */
export function showHighlightsModal() {
    try {
        const overlay = document.getElementById('highlightsOverlay');
        const modal = document.getElementById('highlightsModal');
        const searchInput = document.getElementById('highlightsSearch');
        
        if (!overlay || !modal) return;
        
        overlay.classList.add('active');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Reset search
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Reset filter buttons
        const filterButtons = document.querySelectorAll('.highlight-filter-btn');
        filterButtons.forEach(btn => btn.classList.remove('active'));
        
        const allButton = document.querySelector('.highlight-filter-btn[data-color="all"]');
        if (allButton) {
            allButton.classList.add('active');
        }
        
        renderHighlights('all', '');
        setupHighlightsSearch();
        
    } catch (error) {
        console.error('Error opening highlights modal:', error);
    }
}

/**
 * Close highlights modal
 */
export function closeHighlightsModal() {
    try {
        const overlay = document.getElementById('highlightsOverlay');
        const modal = document.getElementById('highlightsModal');
        
        if (!overlay || !modal) return;
        
        overlay.classList.remove('active');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
    } catch (error) {
        console.error('Error closing highlights modal:', error);
    }
}

/**
 * Set up search functionality for highlights
 */
function setupHighlightsSearch() {
    try {
        const searchInput = document.getElementById('highlightsSearch');
        const clearSearchBtn = document.getElementById('clearSearch');
        
        if (searchInput) {
            searchInput.addEventListener('input', handleSearchInput);
        }
        
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', handleClearSearch);
        }

        document.querySelectorAll('.highlight-filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const color = this.dataset.color;
                const searchTerm = document.getElementById('highlightsSearch').value || '';
                renderHighlights(color, searchTerm);
                
                // Update active state
                document.querySelectorAll('.highlight-filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });        
    } catch (error) {
        console.error('Error setting up highlights search:', error);
    }
}

/**
 * Handle search input changes
 */
function handleSearchInput() {
    try {
        const searchTerm = this.value.toLowerCase().trim();
        const activeFilter = document.querySelector('.highlight-filter-btn.active')?.dataset.color || 'all';
        renderHighlights(activeFilter, searchTerm);
    } catch (error) {
        console.error('Error handling search input:', error);
    }
}

/**
 * Handle clear search button click
 */
function handleClearSearch() {
    try {
        const searchInput = document.getElementById('highlightsSearch');
        if (!searchInput) return;
        
        searchInput.value = '';
        const activeFilter = document.querySelector('.highlight-filter-btn.active')?.dataset.color || 'all';
        renderHighlights(activeFilter, '');
    } catch (error) {
        console.error('Error clearing search:', error);
    }
}

/* ====================================================================
   HIGHLIGHTS RENDERING
==================================================================== */

/**
 * Render highlights list in modal
 * @param {string} filterColor - Color filter
 * @param {string} searchTerm - Search term
 */
export function renderHighlights(filterColor = 'all', searchTerm = '') {
    try {
        const highlightsList = document.getElementById('highlightsList');
        if (!highlightsList) return;
        
        const highlights = state.highlights || {};
        
        if (Object.keys(highlights).length === 0) {
            highlightsList.innerHTML = '<div class="no-highlights">No verses have been highlighted yet</div>';
            return;
        }
        
        const sortedReferences = sortHighlightReferences(highlights);
        const filteredReferences = filterHighlightReferences(sortedReferences, filterColor, searchTerm);
        
        let html = '';
        
        if (filteredReferences.length === 0) {
            const noResultsMsg = searchTerm 
                ? `No highlights found matching "${searchTerm}"`
                : 'No highlights match the selected filter';
            html = `<div class="no-results">${noResultsMsg}</div>`;
        } else {
            html = generateHighlightItemsHTML(filteredReferences, searchTerm);
        }
        
        highlightsList.innerHTML = html;
        setupHighlightItemClickHandlers();
        
    } catch (error) {
        console.error('Error rendering highlights:', error);
        const highlightsList = document.getElementById('highlightsList');
        if (highlightsList) {
            highlightsList.innerHTML = '<div class="error">Error loading highlights</div>';
        }
    }
}

/**
 * Sort highlight references by book, chapter, verse
 * @param {Object} highlights - Highlights object
 * @returns {Array} - Sorted references
 */
function sortHighlightReferences(highlights) {
    return Object.keys(highlights)
        .map(reference => {
            const match = reference.match(/^(.+?)\s+(\d+):(\d+)$/);
            if (!match) return null;
            
            const [, bookName, chapter, verse] = match;
            const color = highlights[reference];
            
            // Parse book name for sorting
            const bookParts = bookName.split(' ');
            let bookNumber = '';
            let baseBookName = bookName;
            
            if (bookParts.length > 1 && /^\d+$/.test(bookParts[0])) {
                bookNumber = bookParts[0];
                baseBookName = bookParts.slice(1).join(' ');
            }
            
            const bookIndex = BOOK_ORDER.findIndex(book => {
                const orderParts = book.split(' ');
                let orderNumber = '';
                let orderBaseName = book;
                
                if (orderParts.length > 1 && /^\d+$/.test(orderParts[0])) {
                    orderNumber = orderParts[0];
                    orderBaseName = orderParts.slice(1).join(' ');
                }
                
                return orderBaseName.toLowerCase() === baseBookName.toLowerCase() && 
                       orderNumber === bookNumber;
            });
            
            if (bookIndex === -1) return null;
            
            return {
                reference,
                bookName,
                bookIndex,
                chapter: parseInt(chapter),
                verse: parseInt(verse),
                color
            };
        })
        .filter(ref => ref !== null)
        .sort((a, b) => {
            if (a.bookIndex !== b.bookIndex) return a.bookIndex - b.bookIndex;
            if (a.chapter !== b.chapter) return a.chapter - b.chapter;
            return a.verse - b.verse;
        });
}

/**
 * Filter highlight references by color and search term
 * @param {Array} references - Sorted references
 * @param {string} filterColor - Color filter
 * @param {string} searchTerm - Search term
 * @returns {Array} - Filtered references
 */
function filterHighlightReferences(references, filterColor, searchTerm) {
    return references.filter(ref => {
        // Filter by color
        if (filterColor !== 'all' && ref.color !== filterColor) {
            return false;
        }
        
        // Filter by search term
        if (searchTerm) {
            const verseText = getVerseTextFromStorage(ref.reference) || '';
            if (!verseText.toLowerCase().includes(searchTerm) && 
                !ref.reference.toLowerCase().includes(searchTerm)) {
                return false;
            }
        }
        
        return true;
    });
}

/**
 * Generate HTML for highlight items
 * @param {Array} references - Filtered references
 * @param {string} searchTerm - Search term for highlighting
 * @returns {string} - HTML string
 */
function generateHighlightItemsHTML(references, searchTerm) {
    return references.map(ref => {
        const verseText = getVerseTextFromStorage(ref.reference) || 'Text not cached, visit to refresh';
        let displayText = verseText;
        
        // Highlight search terms
        if (searchTerm) {
            const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
            displayText = verseText.replace(regex, '<mark>$1</mark>');
        }
        
        return `
            <div class="highlight-item ${ref.color}" 
                 data-reference="${escapeHTML(ref.reference)}" 
                 data-color="${escapeHTML(ref.color)}">
                <div class="highlight-ref">${escapeHTML(ref.reference)}</div>
                <div class="highlight-text">${displayText}</div>
            </div>
        `;
    }).join('');
}

/**
 * Set up click handlers for highlight items
 */
function setupHighlightItemClickHandlers() {
    document.querySelectorAll('.highlight-item').forEach(item => {
        item.addEventListener('click', () => {
            const reference = item.dataset.reference;
            navigateToHighlightedVerse(reference);
            closeHighlightsModal();
        });
    });
}

/**
 * Escape regex special characters
 * @param {string} string - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ====================================================================
   NAVIGATION FUNCTIONS
==================================================================== */

/**
 * Scroll to specific verse number
 * @param {number} verseNumber - Verse number to scroll to
 */
export function scrollToVerse(verseNumber) {
    try {
        updateDisplayRef(state.settings.manualBook, state.settings.manualChapter);
        syncBookChapterSelectors();
        
        const verseElement = document.querySelector(`.verse[data-verse-number="${verseNumber}"]`);
        if (verseElement) {
            verseElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // Highlight temporarily
            verseElement.style.backgroundColor = 'var(--verse-hover)';
            setTimeout(() => {
                verseElement.style.backgroundColor = '';
            }, 1000);
        }
    } catch (error) {
        console.error('Error scrolling to verse:', error);
    }
}

/**
 * Retrieve verse text from localStorage cache
 * @param {string} reference - Verse reference
 * @returns {string|null} - Verse text or null
 */
export function getVerseTextFromStorage(reference) {
    try {
        const cachedVerses = JSON.parse(localStorage.getItem('cachedVerses') || '{}');
        return cachedVerses[reference] || null;
    } catch (error) {
        console.error('Error retrieving verse text:', error);
        return null;
    }
}

/**
 * Navigate to highlighted verse
 * @param {string} reference - Full verse reference
 */
function navigateToHighlightedVerse(reference) {
    try {
        const match = reference.match(/^(.+?)\s+(\d+):(\d+)$/);
        if (!match) return;
        
        const [, book, chapter, verse] = match;
        state.settings.manualBook = book;
        state.settings.manualChapter = parseInt(chapter);
        
        const translation = state.settings.bibleTranslation;
        
        // Update URL with proper history state including verse
        updateURL(translation, book, chapter, 'push');
        
        loadSelectedChapter(book, chapter);
        
        setTimeout(() => scrollToVerse(parseInt(verse)), 500);
    } catch (error) {
        console.error('Error navigating to highlighted verse:', error);
    }
}
