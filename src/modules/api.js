/*=====================================================================
  Provinent Scripture Study – api.js
=====================================================================*/


/* ====================================================================
   TABLE OF CONTENTS
   
    FETCH HELPER
    LOAD PASSAGE
==================================================================== */


/*  Global imports */
import {
    clearError,
    handleError,
    showError,
    showLoading
} from '../main.js'

import {
    afterContentLoad,
    displayPassage,
    extractVerseText
} from './passage.js'

import {
    bookNameMapping,
    state
} from './state.js'

/* Global constants */

/**
 * API Base URL
 * HelloAO Bible API endpoint for fetching scripture
 */
const API_BASE_URL = 'https://bible.helloao.org/api';

/* Translation map – UI name -> exact HelloAO API code */
const translationMap = {
    BSB: 'BSB',          // Berean Standard Bible
    KJV: 'eng_kjv',      // King James Version
    NET: 'eng_net',       // New English Translation
    ASV: 'eng_asv',       // American Standard Version
    GNV: 'eng_gnv'       // Geneva 1599 Bible
    // Add more entries here if desired
};

/**
 * Return the HelloAO API translation identifier for a UI‑friendly code.
 * If the map does not contain the key we simply return the argument
 * (this preserves backward‑compatibility for custom codes).
 *
 * @param {string} uiCode – the value stored in `state.settings.bibleTranslation`
 * @returns {string} – the exact string the API expects
 */
export function apiTranslationCode(uiCode) {
    return translationMap[uiCode] ?? uiCode;
}

/* Safety‑net for book‑code mismatches */
export function getApiBookCode(displayName) {
    const code = bookNameMapping[displayName];
    if (code) return code;

    // No entry found – give a clear diagnostic and stop execution
    console.warn('Missing book‑code mapping for:', displayName);
    showError(`Cannot load “${displayName}” – unknown book code.`);
    throw new Error('Unknown book code');
}


/* ====================================================================
   FETCH HELPER – API COMMUNICATION
   Single unified function for retrieving scripture from HelloAO API
==================================================================== */

/**
 * Retrieve a chapter from the HelloAO Bible API
 * Handles all API communication with proper error handling
 * 
 * @param {string} translation - Translation code (e.g. "BSB", "eng_kjv")
 * @param {string} book - Book code (e.g. "GEN", "1CO")
 * @param {number|string} chapter - Chapter number
 * @returns {Promise<Object>} Parsed JSON response containing verse data
 */
export async function fetchChapter(translation, book, chapter) {
    // Add offline detection
    if (!navigator.onLine) {
        throw new Error('Offline mode: Cannot fetch new chapters. Using cached data if available.');
    }

    // Normalize input
    const trans = translation.trim();
    const bk = book.replace(/\s+/g, '').toUpperCase();
    const ch = Number(chapter);
    
    if (!trans || !bk || Number.isNaN(ch) || ch < 1) {
        throw new Error('Invalid parameters for Bible API request');
    }

    // Build API URL
    const url = `${API_BASE_URL}/${trans}/${bk}/${ch}.json`;

    try {
        // Perform fetch
        const resp = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        });

        // Handle non-2xx responses
        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`API error ${resp.status}: ${txt}`);
        }

        // Validate content type
        const ct = resp.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
            if (ct.startsWith('<')) {
                throw new Error('API returned HTML instead of JSON');
            }
            try {
                return JSON.parse(await resp.text());
            } catch (_) {
                throw new Error('Unable to parse API response as JSON');
            }
        }

        return resp.json();

    } catch (err) {
        handleError(err, 'fetchChapter');
    }
}


/* ====================================================================
   LOAD PASSAGE – MAIN CONTENT FETCHER
   Retrieve and display scripture passage from API
==================================================================== */

/* Load a passage from the HelloAO API and display it */
export async function loadPassageFromAPI(passageInfo) {
    try {
        showLoading(true);
        const { book, chapter, startVerse, endVerse, displayRef } = passageInfo;

        state.currentPassageReference = displayRef;

        // API translation mapping
        const apiMap = apiTranslationCode(state.settings.bibleTranslation);

        // Normalize book code
        const apiBook = getApiBookCode(book);

        // Fetch chapter data
        const chapterData = await fetchChapter(apiMap, apiBook, chapter);

        // Validate response
        if (!chapterData || !chapterData.chapter || 
            !Array.isArray(chapterData.chapter.content)) {
            throw new Error('Malformed API response – missing chapter.content');
        }

        // Get chapter-level footnotes
        const chapterFootnotes = chapterData.chapter.footnotes || [];

        // Create a shared counter object for sequential footnote numbering
        const footnoteCounter = { value: 1 };

        // Filter to requested verse range and process with footnotes
        const verses = chapterData.chapter.content
            .filter(v =>
                v.type === 'verse' &&
                v.number >= startVerse &&
                v.number <= endVerse
            )
            .map(v => {
                const verseData = extractVerseText(v.content, chapterFootnotes, footnoteCounter);
                return {
                    number: v.number,
                    text: verseData,
                    reference: `${book} ${chapter}:${v.number}`,
                    rawContent: v.content
                };
            });

        if (verses.length === 0) {
            throw new Error('No verses found in the requested range');
        }

        // Render verses with footnotes
        displayPassage(verses);
        afterContentLoad();
        clearError();

        // Update translation display
        if (chapterData.translation && chapterData.translation.name) {
            document.getElementById('bibleName').textContent =
                chapterData.translation.name;
        }
    } catch (err) {
        handleError(err, 'loadPassageFromAPI');
    } finally {
        showLoading(false);
    }
}

