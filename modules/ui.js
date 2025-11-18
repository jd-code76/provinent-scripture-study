import { handleError, getSimpleDate } from '../main.js';
import { loadSelectedChapter, populateBookDropdown, populateChapterDropdown } from './navigation.js';
import { BOOK_ORDER, CHAPTER_COUNTS, bibleComUrlMap, bibleHubUrlMap, ebibleOrgUrlMap, formatBookNameForSource, saveToStorage, state, stepBibleUrlMap } from './state.js';
const UNSUPPORTED_TRANSLATIONS = {
    biblecom: [],
    biblehub: [],
    biblegateway: ['BSB'],
    stepbible: ['NKJV', 'CSB', 'NLT'],
    ebibleorg: ['LSB', 'NASB', 'ASV', 'ESV', 'NKJV', 'CSB', 'NIV', 'NLT']
};
const CONTENT_TYPES = {
    text: { btnClass: 'text', display: 'block', inputDisplay: 'block' },
    markdown: { btnClass: 'markdown', display: 'block', inputDisplay: 'none' }
};
const PANEL_LIMITS = {
    sidebar: { min: 150, max: 600 },
    referencePanel: { min: 250, max: 800 },
    scriptureSection: { min: 300, max: 1200 },
    notesSection: { min: 250, max: 800 }
};
export function updateScriptureFontSize(sizePx) {
    try {
        const size = Number(sizePx);
        if (Number.isNaN(size) || size < 10 || size > 36) return;
        const scriptureSection = document.getElementById('scriptureSection');
        if (scriptureSection) {
            scriptureSection.style.fontSize = `${size}px`;
        }
        const headerTitle = document.getElementById('passageHeaderTitle');
        const headerRef   = document.getElementById('passageReference');
        if (headerTitle) headerTitle.style.fontSize = '';
        if (headerRef)   headerRef.style.fontSize   = '';
        state.settings.fontSize = size;
        saveToStorage();
    } catch (err) {
        console.error('Failed to update scripture font size:', err);
    }
}
export function switchNotesView(view) {
    try {
        state.settings.notesView = view;
        const txtBtn = document.getElementById('textViewBtn');
        const mdBtn = document.getElementById('markdownViewBtn');
        const input = document.getElementById('notesInput');
        const display = document.getElementById('notesDisplay');
        txtBtn.classList.toggle('active', view === 'text');
        mdBtn.classList.toggle('active', view === 'markdown');
        if (view === 'text') {
            input.style.display = 'block';
            display.style.display = 'none';
        } else {
            input.style.display = 'none';
            display.style.display = 'block';
            updateMarkdownPreview();
        }
        saveToStorage();
    } catch (error) {
        console.error('Error switching notes view:', error);
    }
}
export function updateMarkdownPreview() {
    try {
        if (state.settings.notesView !== 'markdown' || typeof marked === 'undefined') return;
        const display = document.getElementById('notesDisplay');
        if (!display) return;
        display.innerHTML = marked.parse(state.notes || '');
    } catch (error) {
        console.error('Markdown rendering error:', error);
        const display = document.getElementById('notesDisplay');
        if (display) {
            display.innerHTML = '<p style="color:red;">Error rendering markdown</p>';
        }
    }
}
export function insertMarkdown(type) {
    try {
        const textarea = document.getElementById('notesInput');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const { replacement, cursorAdjust } = getMarkdownReplacement(type, selectedText);
        textarea.value = textarea.value.slice(0, start) + replacement + textarea.value.slice(end);
        const newPosition = start + replacement.length + cursorAdjust;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();
        state.notes = textarea.value;
        saveToStorage();
        updateMarkdownPreview();
    } catch (error) {
        console.error('Error inserting markdown:', error);
    }
}
function getMarkdownReplacement(type, selectedText) {
    const patterns = {
        bold: { pattern: '**$1**', adjust: selectedText ? 0 : -2, placeholder: 'bold text' },
        italic: { pattern: '*$1*', adjust: selectedText ? 0 : -1, placeholder: 'italic text' },
        h1: { pattern: '# $1', adjust: selectedText ? 0 : -10, placeholder: 'Heading 1' },
        h2: { pattern: '## $1', adjust: selectedText ? 0 : -10, placeholder: 'Heading 2' },
        h3: { pattern: '### $1', adjust: selectedText ? 0 : -10, placeholder: 'Heading 3' },
        ul: { pattern: '- $1', adjust: selectedText ? 0 : -10, placeholder: 'List item' },
        ol: { pattern: '1. $1', adjust: selectedText ? 0 : -10, placeholder: 'List item' },
        quote: { pattern: '> $1', adjust: selectedText ? 0 : -6, placeholder: 'Quote' },
        code: { pattern: '`$1`', adjust: selectedText ? 0 : -1, placeholder: 'code' },
        link: { pattern: '[$1](url)', adjust: selectedText ? -4 : -14, placeholder: 'link text' }
    };
    const config = patterns[type] || patterns.bold;
    const content = selectedText || config.placeholder;
    return {
        replacement: config.pattern.replace('$1', content),
        cursorAdjust: config.adjust
    };
}
export function exportNotes() {
    try {
        if (!state.notes?.trim()) {
            alert('No notes to export!');
            return;
        }
        const fileDate = getSimpleDate();
        const blob = new Blob([state.notes], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `provinent-scripture-study-notes-${fileDate}.md`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting notes:', error);
        alert('Failed to export notes');
    }
}
export function togglePanelCollapse(panelId) {
    try {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        const isCollapsed = panel.classList.contains('panel-collapsed');
        if (isCollapsed) {
            panel.classList.remove('panel-collapsed');
            const storedWidth = state.settings.panelWidths[panelId];
            if (storedWidth) {
                panel.style.width = storedWidth + 'px';
            }
        } else {
            panel.classList.add('panel-collapsed');
        }
        state.settings.collapsedPanels[panelId] = !isCollapsed;
        saveToStorage();
    } catch (error) {
        console.error('Error toggling panel:', error);
    }
}
export function toggleSection(sectionId) {
    try {
        const content = document.getElementById(`content-${sectionId}`);
        const header = document.querySelector(`[data-section="${sectionId}"]`);
        const toggle = header?.querySelector('.section-toggle');
        if (!content || !toggle) return;
        const isCollapsed = content.classList.contains('collapsed');
        content.classList.toggle('collapsed');
        toggle.classList.toggle('collapsed');
        state.settings.collapsedSections[sectionId] = !isCollapsed;
        saveToStorage();
    } catch (error) {
        console.error('Error toggling section:', error);
    }
}
export function toggleReferencePanel() {
    try {
        const panel = document.getElementById('referencePanel');
        if (!panel) return;
        const isOpen = panel.classList.contains('active');
        if (isOpen) {
            panel.classList.remove('active');
            state.settings.referencePanelOpen = false;
        } else {
            panel.classList.add('active');
            state.settings.referencePanelOpen = true;
            updateReferencePanel();
        }
        saveToStorage();
    } catch (error) {
        console.error('Error toggling reference panel:', error);
    }
}
export async function updateReferencePanel() {
    try {
        const sourceSelect = document.getElementById('referenceSource');
        const translationSelect = document.getElementById('referenceTranslation');
        const iframe = document.getElementById('referenceIframe');
        if (!sourceSelect || !translationSelect || !iframe) return;
        const source = sourceSelect.value;
        const translation = translationSelect.value;
        state.settings.referenceSource = source;
        state.settings.referenceVersion = translation;
        translationSelect.style.display = 'block';
        filterTranslationOptions(source, translationSelect);
        iframe.style.display = 'block';
        const passage = {
            book: state.settings.manualBook,
            chapter: state.settings.manualChapter,
            displayRef: `${state.settings.manualBook} ${state.settings.manualChapter}`
        };
        const url = generateReferenceUrl(source, translation, passage);
        if (url) {
            iframe.src = url;
        }
        saveToStorage();
    } catch (error) {
        handleError(error, 'updateReferencePanel');
    }
}
export function makeToggleSticky() {
    const sidebar = document.getElementById('sidebar');
    const toggle = sidebar?.querySelector('.collapse-toggle');
    if (!toggle) return;
    toggle.style.position = 'sticky';
    toggle.style.top = '10px';
    toggle.style.zIndex = '1000';
    toggle.style.marginLeft = 'auto';
    toggle.style.marginRight = '10px';
}
function generateReferenceUrl(source, translation, passage) {
    const bookName = passage.book.toLowerCase().replace(/\s+/g, '_');
    const bookAbbr = bookName.substring(0, 3).toUpperCase();
    const chapter = passage.chapter;
    switch (source) {
        case 'biblehub': {
            const bibleHubCode = bibleHubUrlMap[translation] || translation.toLowerCase();
            return `https://biblehub.com/${bibleHubCode}/${bookName}/${chapter}.htm`;
        }
        case 'biblecom':
            return generateBibleComUrl(translation, passage);
        case 'ebibleorg':
            return generateEbibleOrgUrl(translation, bookName, bookAbbr, chapter);
        case 'stepbible':
            return getStepBibleUrl(passage.displayRef, translation);
        default:
            return generateBibleGatewayUrl(translation, passage);
    }
}
function generateBibleComUrl(translation, passage) {
    const bibleComCode = bibleComUrlMap[translation];
    if (!bibleComCode) {
        alert(`Bible.com doesn't support ${translation}. Please choose another translation.`);
        return null;
    }
    const formattedBook = formatBookNameForSource(passage.book, 'biblecom');
    const urlFormats = [
        `https://www.bible.com/bible/${bibleComCode}/${formattedBook}.${passage.chapter}.${translation}?interface=embed`,
        `https://www.bible.com/bible/${bibleComCode}/${formattedBook}.${passage.chapter}.${translation}`,
        `https://www.bible.com/bible/${bibleComCode}/${passage.chapter}.${translation}?${formattedBook}=${passage.chapter}`
    ];
    return urlFormats[0]; 
}
function generateEbibleOrgUrl(translation, bookName, bookAbbr, chapter) {
    const ebibleOrgCode = ebibleOrgUrlMap[translation];
    if (!ebibleOrgCode) {
        alert(`eBible.org doesn't support ${translation}. Please choose another translation.`);
        return null;
    }
    const bookRef = bookName === 'psalms' ? 'PS1' : `${bookAbbr}1`;
    return `https://ebible.org/study/?w1=bible&t1=${encodeURIComponent(ebibleOrgCode)}&v1=${bookRef}_${chapter}`;
}
function generateBibleGatewayUrl(translation, passage) {
    const query = passage.displayRef.replace(/\s+/g, '+');
    const version = translation === 'GNV' ? 'GNV' : translation;
    return `https://www.biblegateway.com/passage/?search=${query}&version=${version}&interface=print`;
}
function filterTranslationOptions(source, selectElement) {
    const currentValue = selectElement.value;
    const unsupported = UNSUPPORTED_TRANSLATIONS[source] || [];
    let needsUpdate = false;
    Array.from(selectElement.options).forEach(option => {
        const isUnsupported = unsupported.includes(option.value);
        option.style.display = isUnsupported ? 'none' : 'block';
        option.disabled = isUnsupported;
        if (option.value === currentValue && isUnsupported) {
            needsUpdate = true;
        }
    });
    if (needsUpdate) {
        handleUnsupportedTranslation(source, selectElement, currentValue);
    }
}
function handleUnsupportedTranslation(source, selectElement, currentValue) {
    if (currentValue === 'BSB' && source === 'biblegateway') {
        const sourceSelect = document.getElementById('referenceSource');
        if (sourceSelect) {
            sourceSelect.value = 'biblehub';
            state.settings.referenceSource = 'biblehub';
        }
        selectElement.value = 'BSB';
    } else {
        const fallback = source === 'ebibleorg' ? 'NASB1995' : 'LSB';
        selectElement.value = fallback;
        state.settings.referenceVersion = fallback;
    }
    saveToStorage();
}
export function initResizeHandles() {
    const handles = document.querySelectorAll('.resize-handle');
    const SPEED_FACTOR = 1.8;
    let resizing = false;
    let startX = 0;
    let startWidth = 0;
    let currentPanel = null;
    let invertDirection = false;
    let animationFramePending = false;
    handles.forEach(handle => {
        handle.addEventListener('mousedown', handleResizeStart);
    });
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    function handleResizeStart(event) {
        resizing = true;
        startX = event.clientX;
        const panelId = event.target.dataset.panel;
        currentPanel = document.getElementById(panelId);
        startWidth = currentPanel.offsetWidth;
        invertDirection = (currentPanel.id === 'notesSection');
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        event.preventDefault();
    }
    function handleResizeMove(event) {
        if (!resizing || !currentPanel) return;
        const delta = (invertDirection ? startX - event.clientX : event.clientX - startX) * SPEED_FACTOR;
        let newWidth = startWidth + delta;
        const limits = PANEL_LIMITS[currentPanel.id] || { min: 150, max: 1200 };
        newWidth = Math.max(limits.min, Math.min(limits.max, newWidth));
        if (!animationFramePending) {
            animationFramePending = true;
            requestAnimationFrame(() => {
                currentPanel.style.width = newWidth + 'px';
                state.settings.panelWidths[currentPanel.id] = newWidth;
                animationFramePending = false;
            });
        }
    }
    function handleResizeEnd() {
        if (resizing) {
            resizing = false;
            currentPanel = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            saveToStorage();
        }
    }
}
export function popOutResource(url, title) {
    try {
        window.open(url, title, 'width=800,height=600,menubar=no,toolbar=no,location=no');
    } catch (error) {
        console.error('Error opening resource:', error);
    }
}
export function getStepBibleUrl(reference, translation) {
    const stepBibleCode = stepBibleUrlMap[translation] || translation;
    return `https://www.stepbible.org/?q=version=${stepBibleCode}@reference=${encodeURIComponent(reference)}&options=HNVUG`;
}
export function restoreSidebarState() {
    try {
        Object.entries(state.settings.collapsedSections || {}).forEach(([sectionId, isCollapsed]) => {
            if (isCollapsed) {
                const content = document.getElementById(`content-${sectionId}`);
                const header = document.querySelector(`[data-section="${sectionId}"]`);
                const toggle = header?.querySelector('.section-toggle');
                if (content && toggle) {
                    content.classList.add('collapsed');
                    toggle.classList.add('collapsed');
                }
            }
        });
    } catch (error) {
        console.error('Error restoring sidebar state:', error);
    }
}
export function restorePanelStates() {
    try {
        Object.entries(state.settings.panelWidths || {}).forEach(([panelId, width]) => {
            const panel = document.getElementById(panelId);
            if (panel && width) {
                panel.style.width = width + 'px';
            }
        });
        Object.entries(state.settings.collapsedPanels || {}).forEach(([panelId, isCollapsed]) => {
            const panel = document.getElementById(panelId);
            if (panel && isCollapsed) {
                panel.classList.add('panel-collapsed');
            }
        });
        const sourceSelect = document.getElementById('referenceSource');
        const translationSelect = document.getElementById('referenceTranslation');
        if (sourceSelect) {
            sourceSelect.value = state.settings.referenceSource || 'biblegateway';
        }
        if (translationSelect) {
            translationSelect.value = state.settings.referenceVersion || 'NASB1995';
        }
        if (state.settings.referencePanelOpen) {
            const referencePanel = document.getElementById('referencePanel');
            if (referencePanel) {
                referencePanel.classList.add('active');
            }
            updateReferencePanel();
        }
    } catch (error) {
        console.error('Error restoring panel states:', error);
    }
}
export function restoreBookChapterUI() {
    try {
        populateBookDropdown();
        const bookSelect = document.getElementById('bookSelect');
        const chapterSelect = document.getElementById('chapterSelect');
        if (!bookSelect || !chapterSelect) return;
        const savedBook = state.settings.manualBook || BOOK_ORDER[0];
        const bookIndex = BOOK_ORDER.indexOf(savedBook);
        const book = bookIndex >= 0 ? BOOK_ORDER[bookIndex] : BOOK_ORDER[0];
        bookSelect.value = book;
        populateChapterDropdown(book);
        const savedChapter = Number(state.settings.manualChapter) || 1;
        const maxChapter = CHAPTER_COUNTS[book] || 1;
        const chapter = Math.min(savedChapter, maxChapter);
        chapterSelect.value = String(chapter);
        state.settings.manualBook = book;
        state.settings.manualChapter = chapter;
        loadSelectedChapter(book, chapter);
    } catch (error) {
        console.error('Error restoring book chapter UI:', error);
    }
}