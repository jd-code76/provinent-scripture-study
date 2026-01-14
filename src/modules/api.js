/*=====================================================================
  Provinent Scripture Study – api.js
  API communication and audio management
=====================================================================*/

import { handleError, showError } from '../main.js';
import { nextPassage } from './navigation.js';
import { extractVerseText } from './passage.js';
import { bookNameMapping, state, saveToStorage } from './state.js';

/* ====================================================================
   CONSTANTS
==================================================================== */

const API_BASE_URL = 'https://bible.helloao.org/api';
const AUDIO_TIMEOUT_MS = 10000; // 10 second timeout for audio
const FETCH_TIMEOUT_MS = 15000; // 15 second timeout for API requests

/**
 * Translation code mapping for API compatibility
 */
const translationMap = {
    BSB: 'BSB',
    KJV: 'eng_kjv', 
    NET: 'eng_net',
    ASV: 'eng_asv',
    GNV: 'eng_gnv'
};

/**
 * KJV book code mapping for audio URLs
 */
const KJV_BOOK_MAP = {
    Genesis: '01_Gen', Exodus: '02_Exo', Leviticus: '03_Lev', Numbers: '04_Num', Deuteronomy: '05_Deu',
    Joshua: '06_Jos', Judges: '07_Jdg', Ruth: '08_Rut', '1 Samuel': '09_1Sa', '2 Samuel': '10_2Sa',
    '1 Kings': '11_1Ki', '2 Kings': '12_2Ki', '1 Chronicles': '13_1Ch', '2 Chronicles': '14_2Ch',
    Ezra: '15_Ezr', Nehemiah: '16_Neh', Esther: '17_Est', Job: '18_Job', Psalms: '19_Psa',
    Proverbs: '20_Pro', Ecclesiastes: '21_Ecc', 'Song of Solomon': '22_Sng', 
    Isaiah: '23_Isa', Jeremiah: '24_Jer', Lamentations: '25_Lam', Ezekiel: '26_Eze', Daniel: '27_Dan',
    Hosea: '28_Hos', Joel: '29_Joe', Amos: '30_Amo', Obadiah: '31_Oba', Jonah: '32_Jon', 
    Micah: '33_Mic', Nahum: '34_Nah', Habakkuk: '35_Hab', Zephaniah: '36_Zep', Haggai: '37_Hag',
    Zechariah: '38_Zec', Malachi: '39_Mal', Matthew: '40_Mat', Mark: '41_Mar', Luke: '42_Luk',
    John: '43_Joh', Acts: '44_Act', Romans: '45_Rom', '1 Corinthians': '46_1Co', '2 Corinthians': '47_2Co',
    Galatians: '48_Gal', Ephesians: '49_Eph', Philippians: '50_Php', Colossians: '51_Col',
    '1 Thessalonians': '52_1Th', '2 Thessalonians': '53_2Th', '1 Timothy': '54_1Ti', '2 Timothy': '55_2Ti',
    Titus: '56_Tit', Philemon: '57_Phm', Hebrews: '58_Heb', James: '59_Jas', '1 Peter': '60_1Pe',
    '2 Peter': '61_2Pe', '1 John': '62_1Jn', '2 John': '63_2Jn', '3 John': '64_3Jn', Jude: '65_Jud',
    Revelation: '66_Rev'
};

/* ====================================================================
   UTILITY FUNCTIONS
==================================================================== */

/**
 * Get API translation code from UI code
 * @param {string} uiCode - UI translation code
 * @returns {string} - API translation code
 */
export function apiTranslationCode(uiCode) {
    return translationMap[uiCode] ?? uiCode;
}

/**
 * Get API book code from display name
 * @param {string} displayName - Book display name
 * @returns {string} - API book code
 * @throws {Error} - If book code not found
 */
export function getApiBookCode(displayName) {
    const code = bookNameMapping[displayName];
    if (code) return code;

    const error = new Error(`Missing book code mapping for: ${displayName}`);
    console.warn(error.message);
    showError(`Cannot load "${displayName}" – unknown book code.`);
    throw error;
}

/**
 * Check if current translation is KJV
 * @param {string} translation - Translation code
 * @returns {boolean} - True if KJV
 */
export function isKJV(translation) {
    return translation === 'KJV';
}

/* ====================================================================
   API COMMUNICATION
==================================================================== */

/**
 * Fetch chapter from Bible API with timeout
 * @param {string} translation - Translation code
 * @param {string} book - Book code
 * @param {number} chapter - Chapter number
 * @returns {Promise<Object>} - Chapter data
 * @throws {Error} - If fetch fails
 */
export async function fetchChapter(translation, book, chapter) {
    // Validate offline status
    if (!navigator.onLine) {
        throw new Error('Offline mode: Cannot fetch new chapters. Using cached data if available.');
    }

    // Validate parameters
    const trans = translation?.trim();
    const bk = book?.replace(/\s+/g, '').toUpperCase();
    const ch = Number(chapter);
    
    if (!trans || !bk || Number.isNaN(ch) || ch < 1) {
        throw new Error('Invalid parameters for Bible API request');
    }

    const url = `${API_BASE_URL}/${trans}/${bk}/${ch}.json`;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const response = await fetch(url, {
            method: 'GET',
            headers: { 
                Accept: 'application/json'
            },
            cache: 'no-cache',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error ${response.status}: ${errorText}`);
        }

        // Validate content type
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            if (contentType.startsWith('<')) {
                throw new Error('API returned HTML instead of JSON');
            }
            throw new Error('Invalid content type: expected JSON');
        }

        const data = await response.json();
        
        // Validate response structure
        if (!data?.chapter?.content || !Array.isArray(data.chapter.content)) {
            throw new Error('Malformed API response – missing or invalid chapter content');
        }

        return data;

    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('API request timed out');
        }
        handleError(error, 'fetchChapter');
        throw error;
    }
}

/* ====================================================================
   AUDIO MANAGEMENT
==================================================================== */

/**
 * Get audio links for current chapter
 * @returns {Object|null} - Audio links object or null
 */
export function getCurrentChapterAudioLinks() {
    const { manualBook, manualChapter, bibleTranslation } = state.settings;
    
    if (!manualBook || !manualChapter || !bibleTranslation) {
        return null;
    }
    
    return state.currentChapterData?.thisChapterAudioLinks || null;
}

/**
 * Get KJV audio link for book and chapter
 * @param {string} book - Book name
 * @param {number} chapter - Chapter number
 * @returns {string|null} - Audio URL or null
 */
export function getKJVAudioLink(book, chapter) {
    const bookCode = KJV_BOOK_MAP[book];
    if (!bookCode) return null;
    
    const paddedChapter = chapter.toString().padStart(3, '0');
    return `https://openbible.com/audio/kjv/KJV_${bookCode}_${paddedChapter}.mp3`;
}

/**
 * Create and configure audio element
 * @param {string} audioUrl - Audio URL
 * @returns {HTMLAudioElement} - Configured audio element
 */
function createAudioElement(audioUrl) {
    const audio = new Audio(audioUrl);
    
    // Set timeout for audio loading
    const loadTimeout = setTimeout(() => {
        if (audio.readyState < 3) { // HAVE_FUTURE_DATA or better
            const errorEvent = new Event('error');
            errorEvent.message = 'Audio loading timeout';
            audio.dispatchEvent(errorEvent);
        }
    }, AUDIO_TIMEOUT_MS);

    audio.addEventListener('loadeddata', () => clearTimeout(loadTimeout));
    audio.addEventListener('error', () => clearTimeout(loadTimeout));

    return audio;
}

/**
 * Play audio for current chapter
 * @param {string} narrator - Narrator key (optional)
 */
export async function playChapterAudio(narrator = null) {
    try {
        const { bibleTranslation, manualBook, manualChapter } = state.settings;
        
        if (isKJV(bibleTranslation)) {
            await playKJVAudio(manualBook, manualChapter);
        } else {
            await playBSBAudio(narrator);
        }
        
    } catch (error) {
        console.error('Audio playback error:', error);
        showError(`Could not play audio: ${error.message}`);
        const hint =
            'Unable to start audio playback. Please ensure your device’s sound is on, ' +
            'the browser is allowed to play media, and that you have granted any required permissions.';
        handleError(error, 'playChapterAudio', `${hint}`);
    }
}

/**
 * Play KJV audio
 * @param {string} book - Book name
 * @param {number} chapter - Chapter number
 */
async function playKJVAudio(book, chapter) {
    cleanupAudioPlayer();
    const audioUrl = getKJVAudioLink(book, chapter);
    if (!audioUrl) {
        throw new Error('KJV audio not available for this book');
    }
    const audio = createAudioElement(audioUrl);
    state.audioPlayer = {
        audio,
        currentNarrator: 'default',
        isPlaying: false,
        isPaused: false
    };
    setupAudioEventHandlers(audio, 'default');

    try {
        await audio.play(); // Normal success path
        state.audioPlayer.isPlaying = true;
        updateAudioPlayerUI(true);
    } catch (error) {
        // Firefox may reject with AbortError even though playback started.
        if (error.name === 'AbortError') {
            // Treat it as a successful start.
            state.audioPlayer.isPlaying = true;
            updateAudioPlayerUI(true);
        } else {
            console.error('Audio playback failed (KJV):', error);
            showError(`Could not play audio: ${error.message}`);
        }
    }
}

/**
 * Play BSB audio with narrator selection
 * @param {string} narrator - Narrator key
 */
async function playBSBAudio(narrator) {
    const selectedNarrator = narrator || state.settings.audioNarrator || 'gilbert';
    if (narrator && narrator !== state.settings.audioNarrator) {
        state.settings.audioNarrator = selectedNarrator;
        saveToStorage();
    }
    cleanupAudioPlayer();
    const audioLinks = getCurrentChapterAudioLinks();
    if (!audioLinks || !audioLinks[selectedNarrator]) {
        throw new Error(`Audio not available for current chapter from ${selectedNarrator}`);
    }
    const audioUrl = audioLinks[selectedNarrator];
    const audio = createAudioElement(audioUrl);
    state.audioPlayer = {
        audio,
        currentNarrator: selectedNarrator,
        isPlaying: false,
        isPaused: false
    };
    setupAudioEventHandlers(audio, selectedNarrator);

    try {
        await audio.play(); // Normal success path
        state.audioPlayer.isPlaying = true;
        updateAudioPlayerUI(true, selectedNarrator);
    } catch (error) {
        // Firefox may reject with AbortError even though playback started.
        if (error.name === 'AbortError') {
            // Treat it as a successful start.
            state.audioPlayer.isPlaying = true;
            updateAudioPlayerUI(true, selectedNarrator);
        } else {
            console.error('Audio playback failed (BSB):', error);
            showError(`Could not play audio: ${error.message}`);
        }
    }
}

/**
 * Setup audio event handlers.
 * 
 * When the audio ends **naturally** (i.e. not because the user hit Pause/Stop),
 * we want to advance to the next chapter and start playback automatically.
 *
 * The UI button will already have switched back to the “play” icon because
 * `isPlaying` is set to false.  We therefore check that the player is **not**
 * in a paused state before triggering the auto‑advance.
 * @param {HTMLAudioElement} audio - Audio element
 * @param {string} narrator - Narrator identifier
 */
function setupAudioEventHandlers(audio, narrator) {
    audio.addEventListener('ended', async () => {
        if (!state.audioPlayer) return;

        // Reset UI state first (play button becomes visible again)
        state.audioPlayer.isPlaying = false;
        state.audioPlayer.isPaused = false;
        updateAudioPlayerUI(false, narrator);
        
        const isLastChapter = state.settings.manualBook === 'Revelation' && Number(state.settings.manualChapter) === 22;

        if (state.settings.autoplayAudio && !state.audioPlayer.isPaused && !isLastChapter) {
            try {
                nextPassage();
                setTimeout(() => {
                    const translation = state.settings.bibleTranslation;
                    if (isKJV(translation)) {
                        playChapterAudio();
                    } else {
                        const narr = state.settings.audioNarrator || 'gilbert';
                        playChapterAudio(narr);
                    }
                }, 300);
            } catch (e) {
                console.error('Autoplay after audio end failed:', e);
            }
        }
    });
    
    audio.addEventListener('error', (error) => {
        console.error('Audio error:', error);
        if (state.audioPlayer) {
            state.audioPlayer.isPlaying = false;
            state.audioPlayer.isPaused = false;
            updateAudioPlayerUI(false, narrator);
        }
    });
}


/**
 * Pause currently playing audio
 */
export function pauseChapterAudio() {
    if (state.audioPlayer?.audio && state.audioPlayer.isPlaying) {
        state.audioPlayer.audio.pause();
        state.audioPlayer.isPlaying = false;
        state.audioPlayer.isPaused = true;
        updateAudioPlayerUI(false, state.audioPlayer.currentNarrator);
    }
}

/**
 * Stop and reset audio playback
 */
export function stopChapterAudio() {
    if (state.audioPlayer?.audio) {
        state.audioPlayer.audio.pause();
        state.audioPlayer.audio.currentTime = 0;
        state.audioPlayer.isPlaying = false;
        state.audioPlayer.isPaused = false;
        updateAudioPlayerUI(false, state.audioPlayer.currentNarrator);
    }
}

/**
 * Resume paused audio playback
 */
export function resumeChapterAudio() {
    if (state.audioPlayer?.audio && state.audioPlayer.isPaused) {
        state.audioPlayer.audio.play().catch(error => {
            console.error('Audio resume failed:', error);
            showError('Could not resume audio');
        });
        state.audioPlayer.isPlaying = true;
        state.audioPlayer.isPaused = false;
        updateAudioPlayerUI(true, state.audioPlayer.currentNarrator);
    }
}

/**
 * Update audio player UI controls
 * @param {boolean} isPlaying - Whether audio is playing
 * @param {string} narrator - Current narrator
 */
function updateAudioPlayerUI(isPlaying, narrator = null) {
    const audioControls = document.getElementById('audioControls');
    if (!audioControls) return;

    const playBtn  = audioControls.querySelector('.play-audio-btn');
    const pauseBtn = audioControls.querySelector('.pause-audio-btn');
    const stopBtn  = audioControls.querySelector('.stop-audio-btn');

    if (playBtn)  playBtn.style.display  = isPlaying ? 'none' : 'inline-block';
    if (pauseBtn) pauseBtn.style.display = isPlaying ? 'inline-block' : 'none';

    const showStop = isPlaying || (state.audioPlayer && state.audioPlayer.isPaused);
    if (stopBtn) {
        stopBtn.style.display = showStop ? 'inline-block' : 'none';
    }

    if (narrator && !isKJV(state.settings.bibleTranslation)) {
        const narratorSelect = audioControls.querySelector('.narrator-select');
        if (narratorSelect) {
            narratorSelect.value = narrator;
        }
    }
}

/**
 * Update audio controls based on available audio
 * @param {Object} audioLinks - Available audio links
 */
export function updateAudioControls(audioLinks) {
    const audioControls = document.getElementById('audioControls');
    const translation = state.settings.bibleTranslation;
    
    if (!audioControls) return;
    
    if (isKJV(translation)) {
        handleKJVAudioControls(audioControls);
    } else if (translation === 'BSB') {
        handleBSBAudioControls(audioControls, audioLinks);
    } else {
        handleOtherTranslationAudioControls(audioControls);
    }
}

/**
 * Handle KJV audio controls
 * @param {HTMLElement} audioControls - Audio controls container
 */
function handleKJVAudioControls(audioControls) {
    audioControls.style.display = 'block';
    
    const narratorSelect = audioControls.querySelector('.narrator-select');
    const narratorLabel = audioControls.querySelector('span');
    
    if (narratorSelect) narratorSelect.style.display = 'none';
    if (narratorLabel) narratorLabel.style.display = 'inline';
}

/**
 * Handle BSB audio controls
 * @param {HTMLElement} audioControls - Audio controls container
 * @param {Object} audioLinks - Available audio links
 */
function handleBSBAudioControls(audioControls, audioLinks) {
    if (audioLinks && Object.keys(audioLinks).length > 0) {
        audioControls.style.display = 'block';
        
        const narratorSelect = audioControls.querySelector('.narrator-select');
        const narratorLabel = audioControls.querySelector('span');
        
        if (narratorSelect) {
            narratorSelect.style.display = 'inline-block';
            narratorSelect.innerHTML = '';
            
            Object.keys(audioLinks).forEach(narrator => {
                const option = document.createElement('option');
                option.value = narrator;
                option.textContent = narrator.charAt(0).toUpperCase() + narrator.slice(1);
                option.selected = narrator === state.settings.audioNarrator;
                narratorSelect.appendChild(option);
            });
        }
        
        if (narratorLabel) narratorLabel.style.display = 'inline';
        
        updateAudioPlayerUI(state.audioPlayer?.isPlaying || false, state.settings.audioNarrator);
    } else {
        audioControls.style.display = 'none';
    }
}

/**
 * Handle other translation audio controls
 * @param {HTMLElement} audioControls - Audio controls container
 */
function handleOtherTranslationAudioControls(audioControls) {
    const audioDivider = document.getElementById('audio-tb-divider');
    if (audioDivider) audioDivider.style.display = 'none';
    audioControls.style.display = 'none';
}

/**
 * Clean up audio player resources
 */
export function cleanupAudioPlayer() {
    if (state.audioPlayer?.audio) {
        state.audioPlayer.audio.pause();
        state.audioPlayer.audio.currentTime = 0;
        state.audioPlayer.audio.src = '';
    }
    state.audioPlayer = null;
}

/* ====================================================================
   PASSAGE LOADING
==================================================================== */

/**
 * Process chapter content into display items
 * @param {Array} content - Raw chapter content
 * @param {string} book - Book name
 * @param {number} chapter - Chapter number
 * @param {number} startVerse - Start verse
 * @param {number} endVerse - End verse
 * @param {Array} footnotes - Chapter footnotes
 * @param {Object} footnoteCounter - Footnote counter object
 * @returns {Array} - Processed content items
 */
function processChapterContent(content, book, chapter, startVerse, endVerse, footnotes, footnoteCounter) {
    return content
        .filter(item => {
            if (item.type === 'verse') {
                return item.number >= startVerse && item.number <= endVerse;
            }
            return true;
        })
        .map(item => {
            switch (item.type) {
                case 'verse': {
                    const verseData = extractVerseText(item.content, footnotes, footnoteCounter);
                    return {
                        type: 'verse',
                        number: item.number,
                        text: verseData,
                        reference: `${book} ${chapter}:${item.number}`,
                        rawContent: item.content
                    };
                }
                    
                case 'heading':
                    return {
                        type: 'heading',
                        content: item.content.join(' '),
                        reference: `${book} ${chapter}`
                    };
                    
                case 'line_break':
                    return { type: 'line_break' };
                    
                default:
                    return null;
            }
        })
        .filter(item => item !== null);
}
