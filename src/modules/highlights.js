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

const SORT_ORDERS = {
    CANONICAL: 'canon',
    ALPHABETICAL: 'alpha',
    TIME: 'time'
};

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
            
            // Store timestamp when highlight is created
            if (!state.highlightMeta) {
                state.highlightMeta = {};
            }
            if (!state.highlightMeta[verseRef]) {
                state.highlightMeta[verseRef] = {};
            }
            state.highlightMeta[verseRef].timestamp = Date.now();
            
        } else {
            // Removing highlight
            delete state.highlights[verseRef];
            // Also remove metadata
            if (state.highlightMeta && state.highlightMeta[verseRef]) {
                delete state.highlightMeta[verseRef];
            }
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
        state.highlightMeta = {};  // Clear metadata too
        
        // Clear cached verse text (used for export with highlights)
        localStorage.removeItem('cachedVerses');
        
        // Remove highlight classes from all verses
        document.querySelectorAll('.verse').forEach(verse => {
            verse.classList.remove(...HIGHLIGHT_COLORS.map(col => `highlight-${col}`));
        });
        
        saveToStorage();
        
        // Refresh highlights modal if open
        const modal = document.getElementById('highlightsModal');
        if (modal?.classList.contains('active')) {
            renderHighlights();
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
        
        // Initialize sort order from state or default to canonical
        if (!state.settings.highlightSortOrder) {
            state.settings.highlightSortOrder = SORT_ORDERS.CANONICAL;
        }
        
        // Set active sort button
        const sortButtons = document.querySelectorAll('.highlight-sort-btn');
        sortButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sort === state.settings.highlightSortOrder);
        });
        
        renderHighlights();
        setupHighlightsSearch();
        setupSortHandlers();
        
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
            searchInput.removeEventListener('input', handleSearchInput);
            searchInput.addEventListener('input', handleSearchInput);
        }

        if (clearSearchBtn) {
            clearSearchBtn.removeEventListener('click', handleClearSearch);
            clearSearchBtn.addEventListener('click', handleClearSearch);
        }

        document.querySelectorAll('.highlight-filter-btn').forEach(btn => {
            btn.removeEventListener('click', handleFilterClick);
            btn.addEventListener('click', handleFilterClick);
        });        
    } catch (error) {
        console.error('Error setting up highlights search:', error);
    }
}

/**
 * Set up sort button handlers
 */
function setupSortHandlers() {
    try {
        document.querySelectorAll('.highlight-sort-btn').forEach(btn => {
            btn.removeEventListener('click', handleSortClick);
            btn.addEventListener('click', handleSortClick);
        });
    } catch (error) {
        console.error('Error setting up sort handlers:', error);
    }
}

/**
 * Handle sort button click
 */
function handleSortClick(e) {
    try {
        const btn = e.currentTarget;
        const sortOrder = btn.dataset.sort;
        
        // Update state
        state.settings.highlightSortOrder = sortOrder;
        saveToStorage();
        
        // Update button states
        document.querySelectorAll('.highlight-sort-btn').forEach(b => {
            b.classList.remove('active');
        });
        btn.classList.add('active');
        
        // Re-render with new sort order
        renderHighlights();
        
    } catch (error) {
        console.error('Error handling sort click:', error);
    }
}

/**
 * Handle search input changes
 */
function handleSearchInput() {
    try {
        renderHighlights();
    } catch (error) {
        console.error('Error handling search input:', error);
    }
}

/**
 * Handle filters on click
 */
function handleFilterClick(e) {
    try {
        const btn = e.currentTarget;
        document.querySelectorAll('.highlight-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderHighlights();
    } catch (error) {
        console.error('Error handling filter click:', error);
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
        renderHighlights();
    } catch (error) {
        console.error('Error clearing search:', error);
    }
}

/* ====================================================================
   HIGHLIGHTS RENDERING
==================================================================== */

/**
 * Get a validated cache object once per render cycle
 * @param {boolean} forceClearOnInvalid - If true, clear storage on validation failure (for manual calls)
 * @returns {Object|null} - Valid cache or null if invalid
 */
function getValidatedCache(forceClearOnInvalid = false) {
    try {
        const rawData = localStorage.getItem('cachedVerses');
        if (!rawData) {
            return {};
        }

        let cachedVerses;
        try {
            cachedVerses = JSON.parse(rawData);
        } catch (parseError) {
            console.error('Invalid JSON in cachedVerses:', parseError);
            if (forceClearOnInvalid) {
                localStorage.removeItem('cachedVerses');
            }
            return null;
        }

        // Validate: plain object, no arrays/funks
        if (cachedVerses === null || typeof cachedVerses !== 'object' || Array.isArray(cachedVerses)) {
            console.error('cachedVerses is not a valid object');
            if (forceClearOnInvalid) {
                localStorage.removeItem('cachedVerses');
            }
            return null;
        }

        // Quick scan: all entries must have string keys/values
        for (const [key, value] of Object.entries(cachedVerses)) {
            if (typeof key !== 'string' || typeof value !== 'string') {
                console.error('Invalid entry in cachedVerses at key:', key);
                if (forceClearOnInvalid) {
                    localStorage.removeItem('cachedVerses');
                }
                return null;
            }
            // Sanitize each value early
            const sanitized = value.trim().replace(/[\x00-\x1F\x7F]/g, '');
            if (sanitized.length === 0 || sanitized.length > 10000) {
                console.warn('Invalid verse length at', key, '; skipping');
                delete cachedVerses[key];
            } else {
                cachedVerses[key] = sanitized;
            }
        }

        return cachedVerses;
    } catch (error) {
        console.error('Error validating cache:', error);
        return null;
    }
}

/**
 * Render highlights list in modal
 */
export function renderHighlights() {
    try {
        const highlightsList = document.getElementById('highlightsList');
        const searchInput = document.getElementById('highlightsSearch');
        const activeFilterBtn = document.querySelector('.highlight-filter-btn.active');
        
        if (!highlightsList) return;
        
        const highlights = state.highlights || {};
        
        if (Object.keys(highlights).length === 0) {
            highlightsList.innerHTML = '<div class="no-highlights">No verses have been highlighted yet</div>';
            return;
        }
        
        // Get current filter and search values
        const filterColor = activeFilterBtn?.dataset.color || 'all';
        const searchTerm = (searchInput?.value || '').toLowerCase().trim();
        
        // Get sort order from state
        const sortOrder = state.settings.highlightSortOrder || SORT_ORDERS.CANONICAL;
        
        // Batch-validate cache once for efficiency
        const validatedCache = getValidatedCache(false);
        if (validatedCache === null) {
            highlightsList.innerHTML = '<div class="warning">Cached verse data is invalid. Visit verses to refresh highlights display.</div>';
            return;
        }
        
        const sortedReferences = sortHighlightReferences(highlights, sortOrder);
        const filteredReferences = filterHighlightReferences(sortedReferences, filterColor, searchTerm, validatedCache);
        
        let html = '';
        
        if (filteredReferences.length === 0) {
            const noResultsMsg = searchTerm 
                ? `No highlights found matching "${searchTerm}"`
                : 'No highlights match the selected filter';
            html = `<div class="no-results">${noResultsMsg}</div>`;
        } else {
            html = generateHighlightItemsHTML(filteredReferences, searchTerm, validatedCache);
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
 * Sort highlight references by specified order
 * @param {Object} highlights - Highlights object
 * @param {string} sortOrder - Sort order (canon, alpha, or time)
 * @returns {Array} - Sorted references
 */
function sortHighlightReferences(highlights, sortOrder) {
    const references = Object.keys(highlights).map(reference => {
        const match = reference.match(/^(.+?)\s+(\d+):(\d+)$/);
        if (!match) return null;
        
        const [, bookName, chapter, verse] = match;
        const color = highlights[reference];
        
        // Parse book name for canonical sorting
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
        
        // Get timestamp for time-based sorting
        const timestamp = state.highlightMeta?.[reference]?.timestamp || 0;
        
        return {
            reference,
            bookName,
            bookIndex,
            chapter: parseInt(chapter),
            verse: parseInt(verse),
            color,
            timestamp
        };
    }).filter(ref => ref !== null);
    
    // Apply sort based on order
    switch (sortOrder) {
        case SORT_ORDERS.ALPHABETICAL:
            return references.sort((a, b) => {
                const compareBook = a.bookName.localeCompare(b.bookName);
                if (compareBook !== 0) return compareBook;
                if (a.chapter !== b.chapter) return a.chapter - b.chapter;
                return a.verse - b.verse;
            });
            
        case SORT_ORDERS.TIME:
            // Most recent first
            return references.sort((a, b) => b.timestamp - a.timestamp);
            
        case SORT_ORDERS.CANONICAL:
        default:
            return references.sort((a, b) => {
                if (a.bookIndex !== b.bookIndex) return a.bookIndex - b.bookIndex;
                if (a.chapter !== b.chapter) return a.chapter - b.chapter;
                return a.verse - b.verse;
            });
    }
}

/**
 * Filter highlight references by color and search term
 * @param {Array} references - Sorted references
 * @param {string} filterColor - Color filter
 * @param {string} searchTerm - Search term
 * @param {Object} validatedCache - Pre-validated cache object
 * @returns {Array} - Filtered references
 */
function filterHighlightReferences(references, filterColor, searchTerm, validatedCache) {
    return references.filter(ref => {
        // Filter by color
        if (filterColor !== 'all' && ref.color !== filterColor) {
            return false;
        }
        
        // Filter by search term using cache
        if (searchTerm) {
            const verseText = validatedCache[ref.reference] || '';
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
 * @param {Object} validatedCache - Pre-validated cache object
 * @returns {string} - HTML string
 */
function generateHighlightItemsHTML(references, searchTerm, validatedCache) {
    return references.map(ref => {
        const verseText = validatedCache[ref.reference] || 'Text not cached, visit to refresh';
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
 * Retrieve verse text from localStorage cache with validation
 * @param {string} reference - Verse reference
 * @param {boolean} forceClearOnInvalid - If true, clear on full invalid (rare manual use)
 * @returns {string|null} - Valid verse text or null
 */
export function getVerseTextFromStorage(reference, forceClearOnInvalid = false) {
    const cachedVerses = getValidatedCache(forceClearOnInvalid);
    if (!cachedVerses || !(reference in cachedVerses)) {
        return null;
    }
    return cachedVerses[reference];
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
