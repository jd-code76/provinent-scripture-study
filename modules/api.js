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
const API_BASE_URL = 'https://bible.helloao.org/api';
const translationMap = {
    BSB: 'BSB',          
    KJV: 'eng_kjv',      
    NET: 'eng_net',       
    ASV: 'eng_asv',       
    GNV: 'eng_gnv'       
};
export function apiTranslationCode(uiCode) {
    return translationMap[uiCode] ?? uiCode;
}
export function getApiBookCode(displayName) {
    const code = bookNameMapping[displayName];
    if (code) return code;
    console.warn('Missing book‑code mapping for:', displayName);
    showError(`Cannot load “${displayName}” – unknown book code.`);
    throw new Error('Unknown book code');
}
export async function fetchChapter(translation, book, chapter) {
    if (!navigator.onLine) {
        throw new Error('Offline mode: Cannot fetch new chapters. Using cached data if available.');
    }
    const trans = translation.trim();
    const bk = book.replace(/\s+/g, '').toUpperCase();
    const ch = Number(chapter);
    if (!trans || !bk || Number.isNaN(ch) || ch < 1) {
        throw new Error('Invalid parameters for Bible API request');
    }
    const url = `${API_BASE_URL}/${trans}/${bk}/${ch}.json`;
    try {
        const resp = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        });
        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`API error ${resp.status}: ${txt}`);
        }
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
export async function loadPassageFromAPI(passageInfo) {
    try {
        showLoading(true);
        const { book, chapter, startVerse, endVerse, displayRef } = passageInfo;
        state.currentPassageReference = displayRef;
        const apiMap = apiTranslationCode(state.settings.bibleTranslation);
        const apiBook = getApiBookCode(book);
        const chapterData = await fetchChapter(apiMap, apiBook, chapter);
        if (!chapterData || !chapterData.chapter || 
            !Array.isArray(chapterData.chapter.content)) {
            throw new Error('Malformed API response – missing chapter.content');
        }
        const chapterFootnotes = chapterData.chapter.footnotes || [];
        const footnoteCounter = { value: 1 };
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
        displayPassage(verses);
        afterContentLoad();
        clearError();
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