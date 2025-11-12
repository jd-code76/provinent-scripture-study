import { state } from './state.js'
import { getStepBibleUrl } from './ui.js'
export function showStrongsReference(verseEl) {
    const ref = verseEl.dataset.verse;
    state.currentVerseElement = verseEl;
    const textSpan = verseEl.querySelector('.verse-text');
    let verseText = '';
    if (textSpan) {
        verseText = textSpan.innerHTML;
        if (!verseText || verseText.trim() === '') {
            verseText = textSpan.textContent || '';
            if (!verseText || verseText.trim() === '') {
                verseText = verseEl.dataset.verseText || '';
            }
        }
    } else {
        verseText = verseEl.dataset.verseText || '';
    }
    if (!verseText || verseText.trim() === '') {
        verseText = '<em>Verse text not available</em>';
    }
    state.currentVerseData = { reference: ref, text: verseText };
    const content = document.getElementById('strongsContent');
    const m = ref.match(/^([\w\s]+)\s+(\d+):(\d+)/);
    let book = '', chapter = '', verse = '';
    if (m) {
        book = m[1].trim().replace(/\s+/g, '_').toLowerCase();
        chapter = m[2];
        verse = m[3];
    }
    const greekUrl = `https://biblehub.com/interlinear/${book}/${chapter}-${verse}.htm`;
    const currentTranslation = state.settings.referenceVersion;
    const stepUrl = getStepBibleUrl(ref, currentTranslation);
    content.innerHTML = `
        <div class="verse-reference-display">
            <div class="verse-navigation">
                <button class="nav-btn prev-verse-btn" id="prevVerseBtn" title="Previous verse">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span>${ref}</span>
                <button class="nav-btn next-verse-btn" id="nextVerseBtn" title="Next verse">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <button class="copy-verse-btn" id="copyVerseBtn" title="Copy verse text">
                <i class="fas fa-copy"></i> Copy Verse
            </button>
        </div>
        <div class="verse-text-display">
            ${verseText}
        </div>
        <div class="strongs-footnotes-container" id="strongsFootnotesContainer" style="display: none;"></div>
        <div class="embedded-resources">
            <div class="resource-frame">
                <div class="resource-frame-header">
                    <h4>BibleHub Interlinear</h4>
                    <div class="resource-frame-actions">
                        <button class="resource-frame-btn" data-url="${greekUrl}" data-title="Interlinear (Hebrew is read right-to-left, Greek left-to-right)">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Pop Out
                        </button>
                    </div>
                </div>
                <iframe src="${greekUrl}" 
                    loading="lazy" 
                    referrerpolicy="no-referrer"
                    style="overflow-anchor: none;">
                </iframe>
            </div>
            <div class="resource-frame">
                <div class="resource-frame-header">
                    <h4>STEP Bible Analysis</h4>
                    <div class="resource-frame-actions">
                        <button class="resource-frame-btn" data-url="${stepUrl}" data-title="STEP Bible">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Pop Out
                        </button>
                    </div>
                </div>
                <iframe src="${stepUrl}" 
                    loading="lazy" 
                    referrerpolicy="no-referrer"
                    style="overflow-anchor: none;">
                </iframe>
            </div>
        </div>
        <p style="margin-bottom:15px;opacity:0.8;font-size:0.9em;">
            <em>These resources provide detailed word-by-word analysis.
            Use the "Pop Out" button to open them in a new tab.
            Please support them as they are great resources!</em>
        </p>
    `;
    populateStrongsFootnotes(ref);
    document.getElementById('strongsPopup').classList.add('active');
    document.getElementById('popupOverlay').classList.add('active');
    setTimeout(() => {
        const copyBtn = document.getElementById('copyVerseBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', copyVerseText);
        }
        const prevBtn = document.getElementById('prevVerseBtn');
        const nextBtn = document.getElementById('nextVerseBtn');
        if (prevBtn) {
            prevBtn.addEventListener('click', navigateToPreviousVerse);
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', navigateToNextVerse);
        }
        document.querySelectorAll('.resource-frame-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const url = this.dataset.url;
            const title = this.dataset.title;
            popOutResource(url, title);
        });
    });
        setupStrongsFootnoteHandlers();
    }, 0);
}
function navigateToPreviousVerse() {
    const currentVerseEl = state.currentVerseElement;
    if (!currentVerseEl) return;
    const allVerses = Array.from(document.querySelectorAll('.verse'));
    const currentIndex = allVerses.indexOf(currentVerseEl);
    if (currentIndex > 0) {
        const prevVerseEl = allVerses[currentIndex - 1];
        showStrongsReference(prevVerseEl);
    }
}
function navigateToNextVerse() {
    const currentVerseEl = state.currentVerseElement;
    if (!currentVerseEl) return;
    const allVerses = Array.from(document.querySelectorAll('.verse'));
    const currentIndex = allVerses.indexOf(currentVerseEl);
    if (currentIndex < allVerses.length - 1) {
        const nextVerseEl = allVerses[currentIndex + 1];
        showStrongsReference(nextVerseEl);
    }
}
export function closeStrongsPopup() {
    document.getElementById('strongsPopup').classList.remove('active');
    document.getElementById('popupOverlay').classList.remove('active');
    state.currentVerseData = null;
}
function copyVerseText() {
    if (!state.currentVerseData) return;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = state.currentVerseData.text;
    let plainText = tempDiv.textContent || tempDiv.innerText || '';
    plainText = plainText
        .replace(/\s+/g, ' ')
        .replace(/\s([.,;:!?])/g, '$1')
        .replace(/([.,;:!?])(?=\w)/g, '$1 ')
        .trim();
    const txt = `${state.currentVerseData.reference} – ${plainText}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt)
            .then(() => {
                const btn = document.getElementById('copyVerseBtn');
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.innerHTML = original;
                    btn.classList.remove('copied');
                }, 2000);
            })
            .catch(err => {
                console.error('Copy failed:', err);
                copyVerseFallback(txt);
            });
    } else {
        copyVerseFallback(txt);
    }
}
function populateStrongsFootnotes(verseRef) {
    const container = document.getElementById('strongsFootnotesContainer');
    if (!container) return;
    container.innerHTML = '';
    const verseFootnotes = state.footnotes[verseRef];
    if (!verseFootnotes || verseFootnotes.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';
    container.innerHTML = `
        <h4 class="footnotes-heading">Footnotes</h4>
    `;
    verseFootnotes.forEach(fn => {
        const footnoteDiv = document.createElement('div');
        footnoteDiv.className = 'footnote';
        footnoteDiv.innerHTML = `
            <sup class="footnote-number">${fn.number}</sup>
            <span class="footnote-content">${fn.content}</span>
        `;
        container.appendChild(footnoteDiv);
    });
}
function setupStrongsFootnoteHandlers() {
    document.querySelectorAll('#strongsFootnotesContainer .footnote-ref').forEach(ref => {
        const newRef = ref.cloneNode(true);
        ref.parentNode.replaceChild(newRef, ref);
    });
    document.querySelectorAll('#strongsFootnotesContainer .footnote-ref').forEach(ref => {
        ref.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
    });
}
function copyVerseFallback(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        const btn = document.getElementById('copyVerseBtn');
        const original = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove('copied');
        }, 2000);
    } catch (err) {
        console.error('Copy fallback failed:', err);
        alert('Could not copy verse text.');
    } finally {
        document.body.removeChild(textarea);
    }
}
function popOutResource(url, title) {
    window.open(url, title,
        'width=800,height=600,menubar=no,toolbar=no,location=no');
}