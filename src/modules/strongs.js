/*=====================================================================
  Provinent Scripture Study – strongs.js
  Strong's Concordance and original language resources
=====================================================================*/

import { escapeHTML } from '../main.js';
import { saveToStorage, state } from './state.js';
import { getStepBibleUrl } from './ui.js';

/* ====================================================================
   CONSTANTS
==================================================================== */

const IFRAME_STYLES = `
    width: 100%;
    height: 300px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: white;
`;

/* ====================================================================
   STRONG'S POPUP
==================================================================== */

/**
 * Show Strong's reference popup for a verse
 * @param {HTMLElement} verseEl - Verse element
 */
export function showStrongsReference(verseEl) {
    try {
        state.currentVerseElement = verseEl;
        
        const verseData = extractVerseData(verseEl);
        state.currentVerseData = verseData;
        
        const content = document.getElementById('strongsContent');
        if (!content) return;
        
        const { book, chapter, verse } = parseVerseReference(verseData.reference);
        const greekUrl = generateGreekUrl(book, chapter, verse);
        const stepUrl = generateStepBibleUrl(verseData.reference);
        
        content.innerHTML = buildPopupContent(verseData, greekUrl, stepUrl);
        
        populateStrongsFootnotes(verseData.reference);
        setupFootnotesToggle();
        showPopup();
        setupPopupEventHandlers();

        const iframes = content.querySelectorAll('iframe');
        iframes.forEach(frame => {
            frame.addEventListener('load', resetPopupScrollPosition);
            if (frame.complete) resetPopupScrollPosition();
        });

        resetPopupScrollPosition();
        
    } catch (error) {
        console.error('Error showing Strong\'s reference:', error);
    }
}

/**
 * Initialise the footnotes toggle button and sync its UI with the persisted state.
 */
function setupFootnotesToggle() {
    const label = document.getElementById('footnotesToggleLabel');
    const container = document.getElementById('strongsFootnotesContainer');
    const icon = label.querySelector('i');

    if (!label || !container || !icon) return;

    // Apply the persisted collapsed state on every popup open
    const collapsed = !!state.settings.footnotesCollapsed;
    container.style.display = collapsed ? 'none' : 'block';
    
    // Set the correct chevron direction
    icon.className = `fas ${collapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`;

    label.addEventListener('click', () => {
        const nowCollapsed = container.style.display === 'none';
        if (nowCollapsed) {
            container.style.display = 'block';
            icon.className = 'fas fa-chevron-up';
        } else {
            container.style.display = 'none';
            icon.className = 'fas fa-chevron-down';
        }
        const newCollapsed = !nowCollapsed;
        const tip = newCollapsed ? 'Show footnotes' : 'Hide footnotes';
        label.setAttribute('title', tip);
        label.setAttribute('aria-label', tip);
        state.settings.footnotesCollapsed = newCollapsed;
        saveToStorage();
    });
}

/**
 * Extract verse data from element
 * @param {HTMLElement} verseEl - Verse element
 * @returns {Object} - Verse data
 */
function extractVerseData(verseEl) {
    const ref = verseEl.dataset.verse;
    const textSpan = verseEl.querySelector('.verse-text');
    let verseText = '';
    
    if (textSpan) {
        verseText = textSpan.innerHTML || textSpan.textContent || '';
    }
    
    if (!verseText.trim()) {
        verseText = verseEl.dataset.verseText || '<em>Verse text not available</em>';
    }
    
    return { reference: ref, text: verseText };
}

/**
 * Parse verse reference into components
 * @param {string} reference - Verse reference
 * @returns {Object} - Parsed components
 */
function parseVerseReference(reference) {
    const match = reference.match(/^([\w\s]+)\s+(\d+):(\d+)/);
    if (!match) return { book: '', chapter: '', verse: '' };
    
    return {
        book: match[1].trim().replace(/\s+/g, '_').toLowerCase(),
        chapter: match[2],
        verse: match[3]
    };
}

/**
 * Generate Bible Hub Interlinear URL
 * @param {string} book - Book name
 * @param {string} chapter - Chapter number
 * @param {string} verse - Verse number
 * @returns {string} - URL
 */
function generateGreekUrl(book, chapter, verse) {
    return `https://biblehub.com/interlinear/${book}/${chapter}-${verse}.htm`;
}

/**
 * Generate STEP Bible URL
 * @param {string} reference - Verse reference
 * @returns {string} URL
 */
function generateStepBibleUrl(reference) {
    const currentTranslation = state.settings.referenceVersion;
    return getStepBibleUrl(reference, currentTranslation);
}

/**
 * Build popup content HTML
 * @param {Object} verseData - Verse data
 * @param {string} greekUrl - Bible Hub interlinear URL
 * @param {string} stepUrl - STEP Bible URL
 * @returns {string} - HTML content
 */
function buildPopupContent(verseData, greekUrl, stepUrl) {
    return `
        <div class="verse-reference-display">
            <div class="verse-navigation">
                <button class="nav-btn prev-verse-btn" id="prevVerseBtn" title="Previous verse">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span>${escapeHTML(verseData.reference)}</span>
                <button class="nav-btn next-verse-btn" id="nextVerseBtn" title="Next verse">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <button class="copy-verse-btn" id="copyVerseBtn" title="Copy verse text">
                <i class="fas fa-copy"></i> Copy Verse
            </button>
        </div>

        <div class="verse-text-display">
            ${sanitizeVerseText(verseData.text)}
        </div>

        <h4 id="footnotesToggleLabel"
            style="
                cursor: pointer;
                color: var(--accent-color);
                user-select: none;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 5px;
                margin-bottom: 5px;
                title="${state.settings.footnotesCollapsed ? 'Expand footnotes' : 'Collapse footnotes'}"
                aria-label="${state.settings.footnotesCollapsed ? 'Expand footnotes' : 'Collapse footnotes'}
            ">
            <span>Footnotes</span>
            <i class="fas ${state.settings.footnotesCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"
               aria-hidden="true"></i>
        </h4>

        <div class="strongs-footnotes-container"
             id="strongsFootnotesContainer"
             style="display: none;">
        </div>


        <div class="embedded-resources">
            ${buildResourceFrame('Bible Hub Interlinear', greekUrl, 'Bible Hub')}
            ${buildResourceFrame('STEP Bible Analysis', stepUrl, 'STEP Bible')}
        </div>

        <p style="margin-bottom:15px;opacity:0.8;font-size:0.9em;">
            <em>These resources provide detailed word-by-word analysis.
            Note that Hebrew/OT is read right-to-left, while Greek/NT is read left-to-right.
            Use the "Pop Out" button to open either resource in a new tab.
            Please support these websites as they are great resources!</em>
        </p>
    `;
}

/**
 * Build resource frame HTML
 * @param {string} title - Frame title
 * @param {string} url - Resource URL
 * @param {string} tooltip - Button tooltip
 * @returns {string} - HTML content
 */
function buildResourceFrame(title, url, tooltip) {
    return `
        <div class="resource-frame">
            <div class="resource-frame-header">
                <h4>${escapeHTML(title)}</h4>
                <div class="resource-frame-actions">
                    <a class="resource-frame-btn"
                       href="${escapeHTML(url)}"
                       target="_blank"
                       rel="noopener"
                       title="${escapeHTML(tooltip)}">
                        <i class="fas fa-arrow-up-right-from-square"></i> Pop Out
                    </a>
                </div>
            </div>
            <iframe src="${escapeHTML(url)}"
                loading="lazy"
                referrerpolicy="no-referrer"
                tabindex="-1"
                style="${IFRAME_STYLES}">
            </iframe>
        </div>
    `;
}

/**
 * Sanitize verse text for display
 * @param {string} text - Raw verse text
 * @returns {string} - Sanitized text
 */
function sanitizeVerseText(text) {
    // Basic sanitization - allow only safe HTML tags
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    
    // Remove potentially dangerous elements
    const dangerousTags = ['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed'];
    dangerousTags.forEach(tag => {
        const elements = tempDiv.querySelectorAll(tag);
        elements.forEach(el => el.remove());
    });
    
    return tempDiv.innerHTML;
}

/**
 * Show the popup overlay
 */
function showPopup() {
    const popup = document.getElementById('strongsPopup');
    const overlay = document.getElementById('popupOverlay');
    
    if (popup) popup.classList.add('active');
    if (overlay) overlay.classList.add('active');

    if (popup) {
        popup.setAttribute('tabindex', '-1');
        popup.focus({ preventScroll: true });
    }
}

/**
 * Close Strong's popup
 */
export function closeStrongsPopup() {
    const popup = document.getElementById('strongsPopup');
    const overlay = document.getElementById('popupOverlay');
    
    if (popup) popup.classList.remove('active');
    if (overlay) overlay.classList.remove('active');

    if (popup) popup.removeAttribute('tabindex');

    document.body.classList.remove('modal-open');
    state.currentVerseData = null;
}

/**
 * Scroll the Strong’s popup back to the top.
 * Called after the modal becomes visible and after the embedded
 * iframes have finished loading.
 */
function resetPopupScrollPosition() {
    const popup = document.getElementById('strongsPopup');
    if (!popup) return;

    // Ensure the popup itself is the scrolling container.
    // Setting scrollTop = 0 moves the internal scrollbar to the top.
    popup.scrollTop = 0;

    requestAnimationFrame(() => {
        popup.scrollTop = 0;
    });
}

/**
 * Set up popup event handlers
 */
function setupPopupEventHandlers() {
    setTimeout(() => {
        setupCopyButton();
        setupNavigationButtons();
        setupStrongsFootnoteHandlers();
    }, 0);
}

/* ====================================================================
   VERSE NAVIGATION
==================================================================== */

/**
 * Navigate to previous verse
 */
function navigateToPreviousVerse() {
    try {
        const currentVerseEl = state.currentVerseElement;
        if (!currentVerseEl) return;
        
        const allVerses = Array.from(document.querySelectorAll('.verse'));
        const currentIndex = allVerses.indexOf(currentVerseEl);
        
        if (currentIndex > 0) {
            const prevVerseEl = allVerses[currentIndex - 1];
            showStrongsReference(prevVerseEl);
        }
    } catch (error) {
        console.error('Error navigating to previous verse:', error);
    }
}

/**
 * Navigate to next verse
 */
function navigateToNextVerse() {
    try {
        const currentVerseEl = state.currentVerseElement;
        if (!currentVerseEl) return;
        
        const allVerses = Array.from(document.querySelectorAll('.verse'));
        const currentIndex = allVerses.indexOf(currentVerseEl);
        
        if (currentIndex < allVerses.length - 1) {
            const nextVerseEl = allVerses[currentIndex + 1];
            showStrongsReference(nextVerseEl);
        }
    } catch (error) {
        console.error('Error navigating to next verse:', error);
    }
}

/* ====================================================================
   COPY FUNCTIONALITY
==================================================================== */

/**
 * Set up copy button handler
 */
function setupCopyButton() {
    const copyBtn = document.getElementById('copyVerseBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyVerseText);
    }
}

/**
 * Copy verse text to clipboard
 */
function copyVerseText() {
    try {
        if (!state.currentVerseData) return;
        
        const plainText = extractPlainVerseText();
        
        if (navigator.clipboard?.writeText) {
            copyWithClipboardAPI(plainText);
        } else {
            copyWithExecCommand(plainText);
        }
    } catch (error) {
        console.error('Error copying verse text:', error);
    }
}

/**
 * Extract plain text from verse HTML
 * @returns {string} - Plain text
 */
function extractPlainVerseText() {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = state.currentVerseData.text;
    
    let plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    // Clean up whitespace and punctuation
    plainText = plainText
        .replace(/\s+/g, ' ')
        .replace(/\s([.,;:!?])/g, '$1')
        .replace(/([.,;:!?])(?=\w)/g, '$1 ')
        .trim();

    return `${state.currentVerseData.reference} – ${plainText}`;
}

/**
 * Copy using modern Clipboard API
 * @param {string} text - Text to copy
 */
function copyWithClipboardAPI(text) {
    navigator.clipboard.writeText(text)
        .then(() => showCopySuccess())
        .catch(error => {
            console.error('Clipboard API error:', error);
            copyWithExecCommand(text);
        });
}

/**
 * Copy using legacy execCommand
 * @param {string} text - Text to copy
 */
function copyWithExecCommand(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        const success = document.execCommand('copy');
        if (success) {
            showCopySuccess();
        } else {
            throw new Error('execCommand failed');
        }
    } catch (error) {
        console.error('execCommand error:', error);
        alert('Could not copy verse text.');
    } finally {
        document.body.removeChild(textarea);
    }
}

/**
 * Show copy success feedback
 */
function showCopySuccess() {
    const btn = document.getElementById('copyVerseBtn');
    if (!btn) return;
    
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    btn.classList.add('copied');
    
    setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('copied');
    }, 2000);
}

/* ====================================================================
   FOOTNOTES
==================================================================== */

/**
 * Populate Strong's footnotes
 * @param {string} verseRef - Verse reference
 */
function populateStrongsFootnotes(verseRef) {
    const container = document.getElementById('strongsFootnotesContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    const verseFootnotes = state.footnotes[verseRef];
    
    if (!verseFootnotes?.length) {
        container.style.display = 'none';
        return;
    }
    
    // Respect the persisted collapsed setting
    container.style.display = state.settings.footnotesCollapsed ? 'none' : 'block';
    
    verseFootnotes.forEach(fn => {
        const footnoteDiv = document.createElement('div');
        footnoteDiv.className = 'footnote';
        footnoteDiv.innerHTML = `
            <sup class="footnote-number">${fn.number}</sup>
            <span class="footnote-content">${escapeHTML(fn.content)}</span>
        `;
        container.appendChild(footnoteDiv);
    });
}

/**
 * Set up Strong's footnote handlers
 */
function setupStrongsFootnoteHandlers() {
    const container = document.getElementById('strongsFootnotesContainer');
    if (!container) return;
    
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

/**
 * Set up footnote verse navigation button handlers
 */
function setupNavigationButtons() {
    const prevBtn = document.getElementById('prevVerseBtn');
    const nextBtn = document.getElementById('nextVerseBtn');
    
    if (prevBtn) prevBtn.addEventListener('click', navigateToPreviousVerse);
    if (nextBtn) nextBtn.addEventListener('click', navigateToNextVerse);
}
