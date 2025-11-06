/*=====================================================================
  Provinent Scripture Study – strongs.js
=====================================================================*/


/* ====================================================================
   TABLE OF CONTENTS

    STRONG’S POP-UP
==================================================================== */

/* Global imports */

import { state } from './state.js'

import { getStepBibleUrl } from './ui.js'


/* ====================================================================
   STRONG'S POP-UP
   Display word studies and original language resources
==================================================================== */

/* Show Strong's reference popup for a verse */
export function showStrongsReference(verseEl) {    
    const ref = verseEl.dataset.verse;
    
    // Store the current verse element for navigation
    state.currentVerseElement = verseEl;
    
    // Get the verse text with footnotes included
    const textSpan = verseEl.querySelector('.verse-text');
    let verseText = '';
    
    if (textSpan) {
        // Get the actual HTML content that includes footnote references
        verseText = textSpan.innerHTML;
        
        // If empty content, try getting the text content
        if (!verseText || verseText.trim() === '') {
            verseText = textSpan.textContent || '';
            
            // If still nothing, fall back to the data attribute
            if (!verseText || verseText.trim() === '') {
                verseText = verseEl.dataset.verseText || '';
            }
        }
    } else {
        // Fallback to data attribute if text span not found
        verseText = verseEl.dataset.verseText || '';
    }
    
    // If still have no text, provide a default message
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

        <!-- Footnotes section for Strong's popup -->
        <div class="strongs-footnotes-container" id="strongsFootnotesContainer"></div>

        <div class="embedded-resources">
            <div class="resource-frame">
                <div class="resource-frame-header">
                    <h4>BibleHub Interlinear</h4>
                    <div class="resource-frame-actions">
                        <button class="resource-frame-btn" data-url="${greekUrl}" data-title="Interlinear (Hebrew is read right-to-left, Greek left-to-right)">
                            Pop Out
                        </button>
                    </div>
                </div>
                <iframe src="${greekUrl}"></iframe>
            </div>

            <div class="resource-frame">
                <div class="resource-frame-header">
                    <h4>STEP Bible Analysis</h4>
                    <div class="resource-frame-actions">
                        <button class="resource-frame-btn" data-url="${stepUrl}" data-title="STEP Bible">
                            Pop Out
                        </button>
                    </div>
                </div>
                <iframe src="${stepUrl}"></iframe>
            </div>
        </div>

        <p style="margin-bottom:15px;opacity:0.8;font-size:0.9em;">
            <em>These resources provide detailed word-by-word analysis.
            Use the "Pop Out" button to open them in a new tab.
            Please support them as they are great resources!</em>
        </p>

        <div class="strongs-definition">
            <h3>Quick Links</h3>

            <div style="margin-top:15px;">
                <a href="https://biblehub.com/strongs.htm" target="_blank"
                   style="color:var(--accent-color);">BibleHub Strong's Exhaustive Concordance</a><br>
                <a href="https://netbible.org/bible/${encodeURIComponent(ref)}"
                   target="_blank" style="color:var(--accent-color);">NET Bible (with comprehensive notes)</a><br>
            </div>
        </div>
    `;

    // Populate footnotes for the Strong's popup - use the current ref
    populateStrongsFootnotes(ref);

    document.getElementById('strongsPopup').classList.add('active');
    document.getElementById('popupOverlay').classList.add('active');

    setTimeout(() => {
        const copyBtn = document.getElementById('copyVerseBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', copyVerseText);
        }
        
        // Setup navigation buttons
        const prevBtn = document.getElementById('prevVerseBtn');
        const nextBtn = document.getElementById('nextVerseBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', navigateToPreviousVerse);
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', navigateToNextVerse);
        }

        // Setup popout buttons
        document.querySelectorAll('.resource-frame-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const url = this.dataset.url;
            const title = this.dataset.title;
            popOutResource(url, title);
        });
    });
        
        // Setup footnote handlers for the Strong's popup
        setupStrongsFootnoteHandlers();
    }, 0);
}

/* Navigate to previous verse while keeping Strong's popup open */
function navigateToPreviousVerse() {
    const currentVerseEl = state.currentVerseElement;
    if (!currentVerseEl) return;
    
    const allVerses = Array.from(document.querySelectorAll('.verse'));
    const currentIndex = allVerses.indexOf(currentVerseEl);
    
    if (currentIndex > 0) {
        // Navigate to previous verse in same chapter
        const prevVerseEl = allVerses[currentIndex - 1];
        showStrongsReference(prevVerseEl);
    }
}

/* Navigate to next verse while keeping Strong's popup open */
function navigateToNextVerse() {
    const currentVerseEl = state.currentVerseElement;
    if (!currentVerseEl) return;
    
    const allVerses = Array.from(document.querySelectorAll('.verse'));
    const currentIndex = allVerses.indexOf(currentVerseEl);
    
    if (currentIndex < allVerses.length - 1) {
        // Navigate to next verse in same chapter
        const nextVerseEl = allVerses[currentIndex + 1];
        showStrongsReference(nextVerseEl);
    }
}

/* Close Strong's popup */
export function closeStrongsPopup() {
    document.getElementById('strongsPopup').classList.remove('active');
    document.getElementById('popupOverlay').classList.remove('active');
    state.currentVerseData = null;
}

/* Copy verse text (with proper formatting) */
function copyVerseText() {
    if (!state.currentVerseData) return;

    // Get clean text without HTML tags but preserve footnote indicators
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = state.currentVerseData.text;
    
    // Convert to plain text but keep footnote numbers as superscript indicators
    let plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    // Clean up the text while preserving footnote references
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

/* Populate footnotes for the Strong's popup using stored data */
function populateStrongsFootnotes(verseRef) {
    const container = document.getElementById('strongsFootnotesContainer');
    if (!container) return;

    container.innerHTML = '';

    // Get footnotes from the stored state
    const verseFootnotes = state.footnotes[verseRef];

    if (!verseFootnotes || verseFootnotes.length === 0) {
        container.innerHTML = '<p style="opacity:0.7;text-align:center;padding:20px;">No footnotes available for this verse</p>';
        return;
    }

    console.log('Found stored footnotes:', verseFootnotes);

    // Create footnotes section
    container.innerHTML = `
        <hr class="footnotes-separator">
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

    // Make sure the container is visible
    container.style.display = 'block';
}

/* Setup footnote click handlers for the Strong's popup */
function setupStrongsFootnoteHandlers() {
    // Remove any existing handlers first
    document.querySelectorAll('#strongsFootnotesContainer .footnote-ref').forEach(ref => {
        const newRef = ref.cloneNode(true);
        ref.parentNode.replaceChild(newRef, ref);
    });

    // Attach click handlers to footnote references in Strong's popup
    document.querySelectorAll('#strongsFootnotesContainer .footnote-ref').forEach(ref => {
        ref.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const footnoteNumber = this.dataset.footnoteNumber;
            const footnoteElement = document.querySelector(`#strongsFootnotesContainer .footnote[data-footnote-number="${footnoteNumber}"]`);
            
            if (footnoteElement) {
                // Scroll to the footnote in the Strong's popup
                footnoteElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest' 
                });
                
                // Visual feedback
                footnoteElement.style.backgroundColor = 'var(--verse-hover)';
                setTimeout(() => {
                    footnoteElement.style.backgroundColor = '';
                }, 2000);
            }
        });
    });
}

/* Fallback clipboard copy method for older browsers */
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

/**
 * Open embedded resource in new window
 */
function popOutResource(url, title) {
    window.open(url, title,
        'width=800,height=600,menubar=no,toolbar=no,location=no');
}

