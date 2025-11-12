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

/* Check if current translation is KJV */
export function isKJV(translation) {
    return translation === 'KJV';
}

/* Get KJV audio link for given book and chapter */
export function getKJVAudioLink(book, chapter) {
    const bookMap = {
        'Genesis': '01_Gen', 'Exodus': '02_Exo', 'Leviticus': '03_Lev', 'Numbers': '04_Num', 'Deuteronomy': '05_Deu',
        'Joshua': '06_Jos', 'Judges': '07_Jdg', 'Ruth': '08_Rut', '1 Samuel': '09_1Sa', '2 Samuel': '10_2Sa',
        '1 Kings': '11_1Ki', '2 Kings': '12_2Ki', '1 Chronicles': '13_1Ch', '2 Chronicles': '14_2Ch',
        'Ezra': '15_Ezr', 'Nehemiah': '16_Neh', 'Esther': '17_Est', 'Job': '18_Job', 'Psalms': '19_Psa',
        'Proverbs': '20_Pro', 'Ecclesiastes': '21_Ecc', 'Song of Solomon': '22_Sng', 
        'Isaiah': '23_Isa', 'Jeremiah': '24_Jer', 'Lamentations': '25_Lam', 'Ezekiel': '26_Eze', 'Daniel': '27_Dan',
        'Hosea': '28_Hos', 'Joel': '29_Joe', 'Amos': '30_Amo', 'Obadiah': '31_Oba', 'Jonah': '32_Jon', 
        'Micah': '33_Mic', 'Nahum': '34_Nah', 'Habakkuk': '35_Hab', 'Zephaniah': '36_Zep', 'Haggai': '37_Hag',
        'Zechariah': '38_Zec', 'Malachi': '39_Mal', 'Matthew': '40_Mat', 'Mark': '41_Mar', 'Luke': '42_Luk',
        'John': '43_Joh', 'Acts': '44_Act', 'Romans': '45_Rom', '1 Corinthians': '46_1Co', '2 Corinthians': '47_2Co',
        'Galatians': '48_Gal', 'Ephesians': '49_Eph', 'Philippians': '50_Php', 'Colossians': '51_Col',
        '1 Thessalonians': '52_1Th', '2 Thessalonians': '53_2Th', '1 Timothy': '54_1Ti', '2 Timothy': '55_2Ti',
        'Titus': '56_Tit', 'Philemon': '57_Phm', 'Hebrews': '58_Heb', 'James': '59_Jas', '1 Peter': '60_1Pe',
        '2 Peter': '61_2Pe', '1 John': '62_1Jn', '2 John': '63_2Jn', '3 John': '64_3Jn', 'Jude': '65_Jud',
        'Revelation': '66_Rev'
    };
    
    const bookCode = bookMap[book];
    if (!bookCode) return null;
    
    // Format: https://openbible.com/audio/kjv/KJV_01_Gen_001.mp3
    const paddedChapter = chapter.toString().padStart(3, '0');
    return `https://openbible.com/audio/kjv/KJV_${bookCode}_${paddedChapter}.mp3`;
}

/**
 * Play audio for current chapter using specified narrator (only one for KJV)
 * @param {string} narrator - Narrator key (e.g., 'gilbert', 'hays', 'souer')
 */
export async function playChapterAudio(narrator = null) {
    try {
        const translation = state.settings.bibleTranslation;
        
        if (isKJV(translation)) {
            // Handle KJV audio with simplified approach
            if (state.audioPlayer?.audio) {
                state.audioPlayer.audio.pause();
                state.audioPlayer.audio.currentTime = 0;
            }
            
            const book = state.settings.manualBook;
            const chapter = state.settings.manualChapter;
            const audioUrl = getKJVAudioLink(book, chapter);
            
            if (!audioUrl) {
                throw new Error('KJV audio not available for this book');
            }
            
            const audio = new Audio(audioUrl);
            
            state.audioPlayer = {
                audio: audio,
                currentNarrator: 'default',
                isPlaying: false,
                isPaused: false
            };
            
            audio.addEventListener('ended', () => {
                if (state.audioPlayer) {
                    state.audioPlayer.isPlaying = false;
                    state.audioPlayer.isPaused = false;
                    updateAudioPlayerUI(false);
                }
            });
            
            audio.addEventListener('error', (e) => {
                console.error('KJV Audio error:', e);
                showError('Could not play KJV audio. The audio file may not be available for this chapter.');
                if (state.audioPlayer) {
                    state.audioPlayer.isPlaying = false;
                    state.audioPlayer.isPaused = false;
                    updateAudioPlayerUI(false);
                }
            });
            
            // Use promise-based play with error handling
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        state.audioPlayer.isPlaying = true;
                        state.audioPlayer.isPaused = false;
                        updateAudioPlayerUI(true);
                    })
                    .catch(err => {
                        console.error('Audio play failed:', err);
                        showError('Could not play audio: ' + err.message);
                    });
            }
            
        } else {
            // BSB audio logic (unchanged)
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
        }
        
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
function updateAudioPlayerUI(isPlaying, narrator = null) {
    const audioControls = document.getElementById('audioControls');
    if (!audioControls) return;
    
    const playBtn = audioControls.querySelector('.play-audio-btn');
    const pauseBtn = audioControls.querySelector('.pause-audio-btn');
    const stopBtn = audioControls.querySelector('.stop-audio-btn');
    
    // Show play/pause buttons based on playing state
    if (playBtn) playBtn.style.display = isPlaying ? 'none' : 'inline-block';
    if (pauseBtn) pauseBtn.style.display = isPlaying ? 'inline-block' : 'none';
    
    // Show stop button only if audio has been started (playing OR paused)
    if (stopBtn) {
        const hasAudioStarted = state.audioPlayer && 
                              (state.audioPlayer.isPlaying || state.audioPlayer.isPaused);
        stopBtn.style.display = hasAudioStarted ? 'inline-block' : 'none';
    }
    
    // Only update narrator select for BSB
    if (narrator && !isKJV(state.settings.bibleTranslation)) {
        const narratorSelect = audioControls.querySelector('.narrator-select');
        if (narratorSelect) {
            narratorSelect.value = narrator;
        }
    }
}

/* Update audio controls UI based on available audio links */
export function updateAudioControls(audioLinks) {
    const audioControls = document.getElementById('audioControls');
    const translation = state.settings.bibleTranslation;
    
    if (isKJV(translation)) {
        audioControls.style.display = 'block';
        
        const narratorSelect = audioControls.querySelector('.narrator-select');
        const narratorLabel = audioControls.querySelector('span');
        
        if (narratorSelect) narratorSelect.style.display = 'none';
        if (narratorLabel) narratorLabel.style.display = 'inline';
        
    } 
    else if (translation === 'BSB') {
        // Use existing API behavior for BSB
        if (audioLinks && Object.keys(audioLinks).length > 0) {
            audioControls.style.display = 'block';
            
            // Show narrator dropdown for BSB
            const narratorSelect = audioControls.querySelector('.narrator-select');
            const narratorLabel = audioControls.querySelector('span');
            
            if (narratorSelect) narratorSelect.style.display = 'inline-block';
            if (narratorLabel) narratorLabel.style.display = 'inline';
            
            // Populate narrator options
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
    else {
        // Hide audio controls for other translations
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

        updateAudioControls(chapterData.thisChapterAudioLinks);

    } catch (err) {
        handleError(err, 'loadPassageFromAPI');
    } finally {
        showLoading(false);
    }
}
