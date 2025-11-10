/*=====================================================================
  Provinent Scripture Study – api.js
=====================================================================*/

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
const API_BASE_URL = 'https://bible.helloao.org/api';

const translationMap = {
    BSB: 'BSB',          // Berean Standard Bible
    KJV: 'eng_kjv',      // King James Version
    NET: 'eng_net',       // New English Translation
    ASV: 'eng_asv',       // American Standard Version
    GNV: 'eng_gnv'       // Geneva 1599 Bible
};

export function apiTranslationCode(uiCode) {
    return translationMap[uiCode] ?? uiCode;
}

export function getApiBookCode(displayName) {
    const code = bookNameMapping[displayName];
    if (code) return code;

    console.warn('Missing book‑code mapping for:', displayName);
    showError(`Cannot load "${displayName}" – unknown book code.`);
    throw new Error('Unknown book code');
}

/* ====================================================================
   FETCH HELPER – API COMMUNICATION
==================================================================== */

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

/* ====================================================================
   AUDIO BIBLE FUNCTIONS
==================================================================== */

/**
 * Get audio URLs for current chapter
 * @returns {Object|null} Audio links object or null if not available
 */
export function getCurrentChapterAudioLinks() {
    const book = state.settings.manualBook;
    const chapter = state.settings.manualChapter;
    const translation = state.settings.bibleTranslation;
    
    if (!book || !chapter || !translation) return null;
    
    if (state.currentChapterData?.thisChapterAudioLinks) {
        return state.currentChapterData.thisChapterAudioLinks;
    }
    
    return null;
}

/**
 * Play audio for current chapter using specified narrator
 * @param {string} narrator - Narrator key (e.g., 'gilbert', 'hays', 'souer')
 */
export async function playChapterAudio(narrator = null) {
    try {
        const selectedNarrator = narrator || state.settings.audioNarrator || 'gilbert';
        
        if (narrator && narrator !== state.settings.audioNarrator) {
            state.settings.audioNarrator = narrator;
            saveToStorage();
        }
        
        if (state.audioPlayer?.audio) {
            state.audioPlayer.audio.pause();
            state.audioPlayer.audio.currentTime = 0;
        }
        
        const audioLinks = getCurrentChapterAudioLinks();
        if (!audioLinks || !audioLinks[selectedNarrator]) {
            throw new Error(`Audio not available for current chapter from ${selectedNarrator}`);
        }
        
        const audioUrl = audioLinks[selectedNarrator];
        const audio = new Audio(audioUrl);
        
        state.audioPlayer = {
            audio: audio,
            currentNarrator: selectedNarrator,
            isPlaying: false,
            isPaused: false
        };
        
        audio.addEventListener('ended', () => {
            if (state.audioPlayer) {
                state.audioPlayer.isPlaying = false;
                state.audioPlayer.isPaused = false;
                updateAudioPlayerUI(false, selectedNarrator);
            }
        });
        
        await audio.play();
        state.audioPlayer.isPlaying = true;
        state.audioPlayer.isPaused = false;
        updateAudioPlayerUI(true, selectedNarrator);
        
    } catch (err) {
        handleError(err, 'playChapterAudio');
        showError('Could not play audio: ' + err.message);
    }
}

/* Pause currently playing audio */
export function pauseChapterAudio() {
    if (state.audioPlayer?.audio && state.audioPlayer.isPlaying) {
        state.audioPlayer.audio.pause();
        state.audioPlayer.isPlaying = false;
        state.audioPlayer.isPaused = true;
        updateAudioPlayerUI(false, state.audioPlayer.currentNarrator);
    }
}

/* Stop and reset audio playback */
export function stopChapterAudio() {
    if (state.audioPlayer?.audio) {
        state.audioPlayer.audio.pause();
        state.audioPlayer.audio.currentTime = 0;
        state.audioPlayer.isPlaying = false;
        state.audioPlayer.isPaused = false;
        updateAudioPlayerUI(false, state.audioPlayer.currentNarrator);
    }
}

/* Resume paused audio playback */
export function resumeChapterAudio() {
    if (state.audioPlayer?.audio && state.audioPlayer.isPaused) {
        state.audioPlayer.audio.play();
        state.audioPlayer.isPlaying = true;
        state.audioPlayer.isPaused = false;
        updateAudioPlayerUI(true, state.audioPlayer.currentNarrator);
    }
}

/* Update audio player UI controls */
function updateAudioPlayerUI(isPlaying, narrator) {
    const audioControls = document.getElementById('audioControls');
    if (!audioControls) return;
    
    const playBtn = audioControls.querySelector('.play-audio-btn');
    const pauseBtn = audioControls.querySelector('.pause-audio-btn');
    
    if (playBtn) playBtn.style.display = isPlaying ? 'none' : 'inline-block';
    if (pauseBtn) pauseBtn.style.display = isPlaying ? 'inline-block' : 'none';
    
    if (narrator && state.audioPlayer) {
        const narratorSelect = audioControls.querySelector('.narrator-select');
        if (narratorSelect) {
            narratorSelect.value = narrator;
        }
    }
}

/* Update audio controls UI based on available audio links */
export function updateAudioControls(audioLinks) {
    const audioControls = document.getElementById('audioControls');
    if (!audioControls) {
        console.error('Audio controls element not found!');
        return;
    }
    
    if (audioLinks && Object.keys(audioLinks).length > 0) {
        audioControls.style.display = 'block';
        
        const narratorSelect = audioControls.querySelector('.narrator-select');
        if (narratorSelect) {
            narratorSelect.innerHTML = '';
            Object.keys(audioLinks).forEach(narrator => {
                const option = document.createElement('option');
                option.value = narrator;
                option.textContent = narrator.charAt(0).toUpperCase() + narrator.slice(1);
                option.selected = narrator === state.settings.audioNarrator;
                narratorSelect.appendChild(option);
            });
        }
        
        updateAudioPlayerUI(state.audioPlayer?.isPlaying || false, state.settings.audioNarrator);
        
    } else {
        audioControls.style.display = 'none';
    }
}

/* Cleanup audio player resources */
export function cleanupAudioPlayer() {
    if (state.audioPlayer?.audio) {
        state.audioPlayer.audio.pause();
        state.audioPlayer.audio.currentTime = 0;
    }
    state.audioPlayer = null;
}

/* ====================================================================
   LOAD PASSAGE – MAIN CONTENT FETCHER
==================================================================== */

/* Load passage from API and render it */
export async function loadPassageFromAPI(passageInfo) {
    try {
        showLoading(true);
        const { book, chapter, startVerse, endVerse, displayRef, translation } = passageInfo;

        state.currentPassageReference = displayRef;

        const apiTranslation = translation ? apiTranslationCode(translation) : apiTranslationCode(state.settings.bibleTranslation);
        const apiBook = getApiBookCode(book);

        const chapterData = await fetchChapter(apiTranslation, apiBook, chapter);

        if (!chapterData || !chapterData.chapter || 
            !Array.isArray(chapterData.chapter.content)) {
            throw new Error('Malformed API response – missing chapter.content');
        }

        state.currentChapterData = chapterData;

        const chapterFootnotes = chapterData.chapter.footnotes || [];
        const footnoteCounter = { value: 1 };

        const contentItems = chapterData.chapter.content
            .filter(item => {
                if (item.type === 'verse') {
                    return item.number >= startVerse && item.number <= endVerse;
                }
                return true;
            })
            .map(item => {
                if (item.type === 'verse') {
                    const verseData = extractVerseText(item.content, chapterFootnotes, footnoteCounter);
                    return {
                        type: 'verse',
                        number: item.number,
                        text: verseData,
                        reference: `${book} ${chapter}:${item.number}`,
                        rawContent: item.content
                    };
                } else if (item.type === 'heading') {
                    return {
                        type: 'heading',
                        content: item.content.join(' '),
                        reference: `${book} ${chapter}`
                    };
                } else if (item.type === 'line_break') {
                    return {
                        type: 'line_break'
                    };
                }
                return null;
            })
            .filter(item => item !== null);

        if (contentItems.length === 0) {
            throw new Error('No content found in the requested range');
        }

        displayPassage(contentItems);
        afterContentLoad();
        clearError();

        if (chapterData.translation && chapterData.translation.name) {
            document.getElementById('bibleName').textContent =
                chapterData.translation.name;
        }

        updateAudioControls(chapterData.thisChapterAudioLinks);

    } catch (err) {
        handleError(err, 'loadPassageFromAPI');
    } finally {
        showLoading(false);
    }
}
