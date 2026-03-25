import { escapeHTML } from '../main.js';
import { loadSelectedChapter, syncBookChapterSelectors } from './navigation.js';
import { updateDisplayRef } from './passage.js';
import { BOOK_ORDER, saveToStorage, state, updateURL } from './state.js';
const HIGHLIGHT_COLORS = [
    'yellow', 'green', 'blue', 'pink', 'orange', 'purple'
];
const SORT_ORDERS = {
    CANONICAL: 'canon',
    ALPHABETICAL: 'alpha',
    TIME: 'time'
};
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
export function applyHighlight(color) {
    try {
        if (!state.currentVerse) return;
        const verseRef = state.currentVerse.dataset.verse;
        if (!verseRef) return;
        state.currentVerse.classList.remove(...HIGHLIGHT_COLORS.map(col => `highlight-${col}`));
        if (color !== 'none') {
            state.currentVerse.classList.add(`highlight-${color}`);
            state.highlights[verseRef] = color;
            if (!state.highlightMeta) {
                state.highlightMeta = {};
            }
            if (!state.highlightMeta[verseRef]) {
                state.highlightMeta[verseRef] = {};
            }
            state.highlightMeta[verseRef].timestamp = Date.now();
        } else {
            delete state.highlights[verseRef];
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
export function clearHighlights() {
    try {
        if (!confirm('Are you sure you want to delete ALL highlights? This cannot be undone.')) {
            return;
        }
        state.highlights = {};
        state.highlightMeta = {};  
        localStorage.removeItem('cachedVerses');
        document.querySelectorAll('.verse').forEach(verse => {
            verse.classList.remove(...HIGHLIGHT_COLORS.map(col => `highlight-${col}`));
        });
        saveToStorage();
        const modal = document.getElementById('highlightsModal');
        if (modal?.classList.contains('active')) {
            renderHighlights();
        }
    } catch (error) {
        console.error('Error clearing highlights:', error);
    }
}
export function showHighlightsModal() {
    try {
        const overlay = document.getElementById('highlightsOverlay');
        const modal = document.getElementById('highlightsModal');
        const searchInput = document.getElementById('highlightsSearch');
        if (!overlay || !modal) return;
        overlay.classList.add('active');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (searchInput) {
            searchInput.value = '';
        }
        const filterButtons = document.querySelectorAll('.highlight-filter-btn');
        filterButtons.forEach(btn => btn.classList.remove('active'));
        const allButton = document.querySelector('.highlight-filter-btn[data-color="all"]');
        if (allButton) {
            allButton.classList.add('active');
        }
        if (!state.settings.highlightSortOrder) {
            state.settings.highlightSortOrder = SORT_ORDERS.CANONICAL;
        }
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
function handleSortClick(e) {
    try {
        const btn = e.currentTarget;
        const sortOrder = btn.dataset.sort;
        state.settings.highlightSortOrder = sortOrder;
        saveToStorage();
        document.querySelectorAll('.highlight-sort-btn').forEach(b => {
            b.classList.remove('active');
        });
        btn.classList.add('active');
        renderHighlights();
    } catch (error) {
        console.error('Error handling sort click:', error);
    }
}
function handleSearchInput() {
    try {
        renderHighlights();
    } catch (error) {
        console.error('Error handling search input:', error);
    }
}
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
        if (cachedVerses === null || typeof cachedVerses !== 'object' || Array.isArray(cachedVerses)) {
            console.error('cachedVerses is not a valid object');
            if (forceClearOnInvalid) {
                localStorage.removeItem('cachedVerses');
            }
            return null;
        }
        for (const [key, value] of Object.entries(cachedVerses)) {
            if (typeof key !== 'string' || typeof value !== 'string') {
                console.error('Invalid entry in cachedVerses at key:', key);
                if (forceClearOnInvalid) {
                    localStorage.removeItem('cachedVerses');
                }
                return null;
            }
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
        const filterColor = activeFilterBtn?.dataset.color || 'all';
        const searchTerm = (searchInput?.value || '').toLowerCase().trim();
        const sortOrder = state.settings.highlightSortOrder || SORT_ORDERS.CANONICAL;
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
function sortHighlightReferences(highlights, sortOrder) {
    const references = Object.keys(highlights).map(reference => {
        const match = reference.match(/^(.+?)\s+(\d+):(\d+)$/);
        if (!match) return null;
        const [, bookName, chapter, verse] = match;
        const color = highlights[reference];
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
    switch (sortOrder) {
        case SORT_ORDERS.ALPHABETICAL:
            return references.sort((a, b) => {
                const compareBook = a.bookName.localeCompare(b.bookName);
                if (compareBook !== 0) return compareBook;
                if (a.chapter !== b.chapter) return a.chapter - b.chapter;
                return a.verse - b.verse;
            });
        case SORT_ORDERS.TIME:
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
function filterHighlightReferences(references, filterColor, searchTerm, validatedCache) {
    return references.filter(ref => {
        if (filterColor !== 'all' && ref.color !== filterColor) {
            return false;
        }
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
function generateHighlightItemsHTML(references, searchTerm, validatedCache) {
    return references.map(ref => {
        const verseText = validatedCache[ref.reference] || 'Text not cached, visit to refresh';
        let displayText = verseText;
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
function setupHighlightItemClickHandlers() {
    document.querySelectorAll('.highlight-item').forEach(item => {
        item.addEventListener('click', () => {
            const reference = item.dataset.reference;
            navigateToHighlightedVerse(reference);
            closeHighlightsModal();
        });
    });
}
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
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
            verseElement.style.backgroundColor = 'var(--verse-hover)';
            setTimeout(() => {
                verseElement.style.backgroundColor = '';
            }, 1000);
        }
    } catch (error) {
        console.error('Error scrolling to verse:', error);
    }
}
export function getVerseTextFromStorage(reference, forceClearOnInvalid = false) {
    const cachedVerses = getValidatedCache(forceClearOnInvalid);
    if (!cachedVerses || !(reference in cachedVerses)) {
        return null;
    }
    return cachedVerses[reference];
}
function navigateToHighlightedVerse(reference) {
    try {
        const match = reference.match(/^(.+?)\s+(\d+):(\d+)$/);
        if (!match) return;
        const [, book, chapter, verse] = match;
        state.settings.manualBook = book;
        state.settings.manualChapter = parseInt(chapter);
        const translation = state.settings.bibleTranslation;
        updateURL(translation, book, chapter, 'push');
        loadSelectedChapter(book, chapter);
        setTimeout(() => scrollToVerse(parseInt(verse)), 500);
    } catch (error) {
        console.error('Error navigating to highlighted verse:', error);
    }
}