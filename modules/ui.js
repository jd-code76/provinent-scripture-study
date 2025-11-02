import { handleError } from '../main.js'
import {
    loadSelectedChapter,
    populateBookDropdown,
    populateChapterDropdown
} from './navigation.js'
import { loadPDF } from './pdf.js'
import {
    BOOK_ORDER,
    CHAPTER_COUNTS,
    bibleComUrlMap,
    bibleHubUrlMap,
    ebibleOrgUrlMap,
    formatBookNameForSource,
    getActivePlan,
    saveToStorage,
    state,
    stepBibleUrlMap
} from './state.js'
export function switchNotesView(view) {
    state.settings.notesView = view;
    const txtBtn = document.getElementById('textViewBtn');
    const mdBtn  = document.getElementById('markdownViewBtn');
    const input  = document.getElementById('notesInput');
    const display = document.getElementById('notesDisplay');
    if (view === 'text') {
        txtBtn.classList.add('active');
        mdBtn.classList.remove('active');
        input.style.display = 'block';
        display.style.display = 'none';
    } else {
        txtBtn.classList.remove('active');
        mdBtn.classList.add('active');
        input.style.display = 'none';
        display.style.display = 'block';
        updateMarkdownPreview();
    }
    saveToStorage();
}
export function updateMarkdownPreview() {
    if (state.settings.notesView !== 'markdown' || typeof marked === 'undefined') return;
    const out = document.getElementById('notesDisplay');
    try {
        out.innerHTML = marked.parse(state.notes);
    } catch (e) {
        console.error('Markdown error:', e);
        out.innerHTML = '<p style="color:red;">Error rendering markdown</p>';
    }
}
export function insertMarkdown(type) {
    const ta = document.getElementById('notesInput');
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const sel   = ta.value.substring(start, end);
    let repl = '';
    let cursorAdj = 0;
    switch (type) {
        case 'bold':   repl = `**${sel || 'bold text'}**`;   cursorAdj = sel ? 0 : -2; break;
        case 'italic': repl = `*${sel || 'italic text'}*`;   cursorAdj = sel ? 0 : -1; break;
        case 'h1':    repl = `# ${sel || 'Heading 1'}`;      cursorAdj = sel ? 0 : -10; break;
        case 'h2':    repl = `## ${sel || 'Heading 2'}`;     cursorAdj = sel ? 0 : -10; break;
        case 'h3':    repl = `### ${sel || 'Heading 3'}`;    cursorAdj = sel ? 0 : -10; break;
        case 'ul':    repl = `- ${sel || 'List item'}`;      cursorAdj = sel ? 0 : -10; break;
        case 'ol':    repl = `1. ${sel || 'List item'}`;     cursorAdj = sel ? 0 : -10; break;
        case 'quote': repl = `> ${sel || 'Quote'}`;          cursorAdj = sel ? 0 : -6;  break;
        case 'code':  repl = `\`${sel || 'code'}\``;        cursorAdj = sel ? 0 : -1;  break;
        case 'link':  repl = `[${sel || 'link text'}](url)`; cursorAdj = sel ? -4 : -14; break;
    }
    ta.value = ta.value.slice(0, start) + repl + ta.value.slice(end);
    const newPos = start + repl.length + cursorAdj;
    ta.setSelectionRange(newPos, newPos);
    ta.focus();
    state.notes = ta.value;
    saveToStorage();
    updateMarkdownPreview();
}
export function exportNotes(ext) {
    if (!state.notes || state.notes.trim() === '') {
        alert('No notes to export!');
        return;
    }
    const blob = new Blob([state.notes], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-notes-${new Date().toISOString().split('T')[0]}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
export function toggleNotes() {
    document.getElementById('notesSection').classList.toggle('hidden');
}
export function togglePanelCollapse(panelId) {
    const panel = document.getElementById(panelId);
    const collapsed = panel.classList.contains('panel-collapsed');
    if (collapsed) {
        panel.classList.remove('panel-collapsed');
        if (state.settings.panelWidths[panelId]) {
            panel.style.width = state.settings.panelWidths[panelId] + 'px';
        }
        state.settings.collapsedPanels[panelId] = false;
    } else {
        panel.classList.add('panel-collapsed');
        state.settings.collapsedPanels[panelId] = true;
    }
    saveToStorage();
}
export function toggleSection(sectionId) {
    const content = document.getElementById(`content-${sectionId}`);
    const header = document.querySelector(`[data-section="${sectionId}"]`);
    const toggle = header.querySelector('.section-toggle');
    const nowCollapsed = content.classList.contains('collapsed');
    content.classList.toggle('collapsed');
    toggle.classList.toggle('collapsed');
    state.settings.collapsedSections[sectionId] = !nowCollapsed;
    saveToStorage();
}
export function toggleReferencePanel() {
    const panel = document.getElementById('referencePanel');
    const nowOpen = panel.classList.contains('active');
    if (nowOpen) {
        panel.classList.remove('active');
        state.settings.referencePanelOpen = false;
    } else {
        panel.classList.add('active');
        state.settings.referencePanelOpen = true;
        updateReferencePanel();
    }
    saveToStorage();
}
export async function updateReferencePanel() {
    try {
        const sourceSelect = document.getElementById('referenceSource');
        const source = sourceSelect.value;
        const iframe = document.getElementById('referenceIframe');
        const pdfViewer = document.getElementById('pdfViewer');
        const transSel = document.getElementById('referenceTranslation');
        state.settings.referenceSource = source;
        state.settings.referenceVersion = transSel.value;
        transSel.style.display = source === 'pdf' ? 'none' : 'block';
        filterTranslationOptions(source, transSel);
        const actualSource = document.getElementById('referenceSource').value;
        const translation = transSel.value;
        let passage;
        if (state.settings.readingMode === 'readingPlan') {
            passage = getActivePlan()[state.settings.currentPassageIndex];
        } else {
            passage = {
                book: state.settings.manualBook,
                chapter: state.settings.manualChapter,
                displayRef: `${state.settings.manualBook} ${state.settings.manualChapter}`
            };
        }
        const bookName = passage.book.toLowerCase().replace(/\s+/g, '_');
        const bookAbbr = bookName.substring(0, 3).toUpperCase(); 
        const chapter = passage.chapter;
        if (actualSource === 'pdf') {
            if (!state.settings.customPdf) {
                alert('No PDF uploaded. Please upload one in Settings first.');
                document.getElementById('referenceSource').value = 'biblegateway';
                transSel.style.display = 'block';
                filterTranslationOptions('biblegateway', transSel);
                return;
            }
            iframe.style.display = 'none';
            pdfViewer.classList.add('active');
            document.getElementById('zoomLevel').textContent =
                Math.round(state.settings.pdfZoom * 100) + '%';
            await loadPDF();
        } else if (actualSource === 'biblehub') {
            const bibleHubCode = bibleHubUrlMap[translation] || translation.toLowerCase();
            const url = `https://biblehub.com/${bibleHubCode}/${bookName}/${chapter}.htm`;
            iframe.src = url;
        } else if (actualSource === 'biblecom') {
            const bibleComCode = bibleComUrlMap[translation];
            if (!bibleComCode) {
                alert(`Bible.com doesn't support ${translation}. Please choose another translation.`);
                return;
            }
            const formattedBook = formatBookNameForSource(passage.book, 'biblecom');
            const urlFormats = [
                `https://www.bible.com/bible/${bibleComCode}/${formattedBook}.${chapter}.${translation}?interface=embed`,
                `https://www.bible.com/bible/${bibleComCode}/${formattedBook}.${chapter}.${translation}`,
                `https://www.bible.com/bible/${bibleComCode}/${chapter}.${translation}?${formattedBook}=${chapter}`
            ];
            let currentUrlIndex = 0;
            function tryNextUrl() {
                if (currentUrlIndex >= urlFormats.length) {
                    alert('Could not load Bible.com. Please try another reference source.');
                    return;
                }
                iframe.src = urlFormats[currentUrlIndex];
                currentUrlIndex++;
            }
            iframe.onload = function() {
                console.log('Bible.com loaded successfully with format', currentUrlIndex);
            };
            iframe.onerror = function() {
                console.log('Trying next Bible.com URL format...');
                tryNextUrl();
            };
            tryNextUrl();
        } else if (actualSource === 'ebibleorg') {
            const ebibleOrgCode = ebibleOrgUrlMap[translation];
            if (!ebibleOrgCode) {
                alert(`eBible.org doesn't support ${translation}. Please choose another translation.`);
                return;
            }
            const bookRef = bookName === 'psalms' ? 'PS1' : `${bookAbbr}1`; 
            const url = `https://ebible.org/study/?w1=bible&t1=${encodeURIComponent(ebibleOrgCode)}&v1=${bookRef}_${chapter}`;
            iframe.src = url;
        } else if (actualSource === 'stepbible') {
            const stepBibleCode = stepBibleUrlMap[translation];
            if (!stepBibleCode) {
                alert(`STEP Bible doesn't support ${translation}. Please choose another translation.`);
                return;
            }
            const url = getStepBibleUrl(passage.displayRef, translation);
            iframe.src = url;
        } else {
            const query = passage.displayRef.replace(/\s+/g, '+');
            let version = translation;
            if (translation === 'GNV') version = 'GNV'; 
            const url = `https://www.biblegateway.com/passage/?search=${query}&version=${version}&interface=print`;
            iframe.src = url;
        }
        saveToStorage();
    } catch (err) {
        handleError(err, 'updateReferencePanel');
    } 
}
function filterTranslationOptions(source, selectElement) {
    const unsupportedTranslations = {
        biblecom: [],
        biblehub: ['GNV'],
        biblegateway: ['BSB'],
        stepbible: ['NKJV', 'CSB', 'NLT'],
        ebibleorg: ['NASB', 'ASV', 'ESV', 'NKJV', 'CSB', 'NIV', 'NLT'],
        pdf: ['NASB1995', 'NASB', 'ASV', 'ESV', 'KJV', 'GNV', 'NKJV', 'BSB', 'CSB', 'NET', 'NIV', 'NLT']
    };
    const allOptions = selectElement.querySelectorAll('option');
    const currentValue = selectElement.value;
    let needsNewSelection = false;
    let needsSourceChange = false;
    allOptions.forEach(option => {
        const value = option.value;
        const isUnsupported = unsupportedTranslations[source]?.includes(value);
        if (isUnsupported) {
            option.style.display = 'none';
            option.disabled = true;
            if (value === currentValue) {
                needsNewSelection = true;
                if (value === 'BSB' && source === 'biblegateway') {
                    needsSourceChange = true;
                }
            }
        } else {
            option.style.display = 'block';
            option.disabled = false;
        }
    });
    if (needsSourceChange) {
        document.getElementById('referenceSource').value = 'biblehub';
        state.settings.referenceSource = 'biblehub';
        const sourceSelect = document.getElementById('referenceSource');
        sourceSelect.value = 'biblehub';
        selectElement.value = 'BSB'; 
        state.settings.referenceVersion = 'BSB';
    }
    else if (needsNewSelection) {
        let fallbackValue = 'NASB1995';
        if (source === 'biblehub') {
            fallbackValue = 'NASB';
        }
        selectElement.value = fallbackValue;
        state.settings.referenceVersion = fallbackValue;
    }
    if (needsSourceChange || needsNewSelection) {
        saveToStorage();
    }
}
export function restoreBookChapterUI() {
    populateBookDropdown();
    const bookSel    = document.getElementById('bookSelect');
    const chapterSel = document.getElementById('chapterSelect');
    const savedBook = state.settings.manualBook || BOOK_ORDER[0];
    const bookIdx   = BOOK_ORDER.indexOf(savedBook);
    const book      = bookIdx >= 0 ? BOOK_ORDER[bookIdx] : BOOK_ORDER[0];
    populateBookDropdown();               
    bookSel.value = book;                 
    populateChapterDropdown(book);
    const savedChap = Number(state.settings.manualChapter) || 1;
    const maxChap   = CHAPTER_COUNTS[book];
    const chapter   = Math.min(savedChap, maxChap);   
    chapterSel.value = String(chapter);   
    state.settings.manualBook    = book;
    state.settings.manualChapter = chapter;
    loadSelectedChapter(book, chapter);
}
export function initResizeHandles() {
    const handles = document.querySelectorAll('.resize-handle');
    const SPEED_FACTOR = 1.8;
    const limits = {
        sidebar:          { min: 150, max: 600 },
        referencePanel:   { min: 250, max: 800 },
        scriptureSection: { min: 300, max: 1200 },
        notesSection:     { min: 250, max: 800 }
    };
    let resizing = false,
        startX = 0,
        startW = 0,
        panel = null,
        invert = false,
        pendingRAF = false;
    handles.forEach(handle => {
        handle.addEventListener('mousedown', e => {
            resizing = true;
            startX = e.clientX;
            const panelId = handle.dataset.panel;
            panel = document.getElementById(panelId);
            startW = panel.offsetWidth;
            invert = (panel.id === 'notesSection');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
    });
    document.addEventListener('mousemove', e => {
        if (!resizing || !panel) return;
        let delta = (invert ? startX - e.clientX : e.clientX - startX) * SPEED_FACTOR;
        let newW = startW + delta;
        const { min, max } = limits[panel.id] || { min: 150, max: 1200 };
        if (newW < min) newW = min;
        if (newW > max) newW = max;
        if (!pendingRAF) {
            pendingRAF = true;
            requestAnimationFrame(() => {
                panel.style.width = newW + 'px';
                state.settings.panelWidths[panel.id] = newW;
                pendingRAF = false;
            });
        }
    });
    document.addEventListener('mouseup', () => {
        if (resizing) {
            resizing = false;
            panel = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            saveToStorage();
        }
    });
}
export function popOutResource(url, title) {
    window.open(url, title,
        'width=800,height=600,menubar=no,toolbar=no,location=no');
}
export function getStepBibleUrl(reference, translation) {
    const stepBibleCode = stepBibleUrlMap[translation] || translation;
    return `https://www.stepbible.org/?q=version=${stepBibleCode}@reference=${encodeURIComponent(reference)}&options=HNVUG`;
}
export function makeToggleSticky() {
    const sidebar = document.getElementById('sidebar');
    const toggle = sidebar.querySelector('.collapse-toggle');
    if (!toggle) return;
    toggle.style.position = 'sticky';
    toggle.style.top = '10px';
    toggle.style.zIndex = '1000';
    toggle.style.marginLeft = 'auto';
    toggle.style.marginRight = '10px';
}
export function restoreSidebarState() {
    Object.entries(state.settings.collapsedSections || {})
          .forEach(([sec, collapsed]) => {
              if (collapsed) {
                  const content = document.getElementById(`content-${sec}`);
                  const header  = document.querySelector(`[data-section="${sec}"]`);
                  const toggle  = header?.querySelector('.section-toggle');
                  if (content && toggle) {
                      content.classList.add('collapsed');
                      toggle.classList.add('collapsed');
                  }
              }
          });
}
export function restorePanelStates() {
    Object.entries(state.settings.panelWidths || {})
          .forEach(([id, w]) => {
              const el = document.getElementById(id);
              if (el && w) el.style.width = w + 'px';
          });
    Object.entries(state.settings.collapsedPanels || {})
          .forEach(([id, collapsed]) => {
              const el = document.getElementById(id);
              if (el && collapsed) el.classList.add('panel-collapsed');
          });
    if (state.settings.referencePanelOpen) {
        document.getElementById('referencePanel').classList.add('active');
        document.getElementById('referenceSource').value = 
            state.settings.referenceSource || 'biblegateway';
        document.getElementById('referenceTranslation').value = 
            state.settings.referenceVersion || 'NASB1995';
        updateReferencePanel();
    }
}