import {
    arrayBufferToBase64,
    base64ToArrayBuffer,
    handleError,
    readFileAsArrayBuffer,
    showLoading
} from '../main.js'
import {
    saveToStorage,
    state
} from './state.js'
import { updateReferencePanel } from './ui.js'
const DB_NAME = 'BibleStudyDB';
const DB_VERSION = 1;
export const STORE_NAME = 'pdfStore';
export let currentSearch = {
    query: '',
    results: [],
    currentResult: -1,
    highlights: []
};
export async function openDB() {
    try {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result);
            req.onupgradeneeded = ev => {
                const db = ev.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }  catch (err) {
        handleError(err, 'openDB');
    }
}
export async function savePDFToIndexedDB(pdfData) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(pdfData, 'customPdf');
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        handleError(err, 'savePDFToIndexedDB');
    }
}
export async function loadPDFFromIndexedDB() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get('customPdf');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        handleError(err, 'loadPDFFromIndexedDB');
    }
}
export async function deletePDFFromIndexedDB() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete('customPdf');
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        handleError(err, 'deletePDFFromIndexedDB');
    }
}
export async function handlePDFUpload(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
        alert('PDF file is too large (max 50 MiB).');
        ev.target.value = '';
        return;
    }
    try {
        showLoading(true);
        const buf = await readFileAsArrayBuffer(file);
        const bufferCopy = buf.slice(0);
        const pdf = await pdfjsLib.getDocument({ data: bufferCopy }).promise;
        const storageBuffer = buf.slice(0);
        const b64 = arrayBufferToBase64(storageBuffer);
        const pdfData = {
            name: file.name,
            data: b64,
            uploadDate: new Date().toISOString(),
            numPages: pdf.numPages
        };
        await savePDFToIndexedDB(pdfData);
        state.settings.customPdf = {
            name: pdfData.name,
            uploadDate: pdfData.uploadDate,
            numPages: pdfData.numPages,
            storedInDB: true
        };
        saveToStorage();
        updateCustomPdfInfo();
        alert('PDF uploaded successfully! You can now use it in the Reference Panel.');
    } catch (e) {
        handleError(err, 'handlePDFUpload');
        alert('Error uploading PDF: ' + e.message);
    } finally {
        showLoading(false);
        ev.target.value = '';
    }
}
export function updateCustomPdfInfo() {
    const container = document.getElementById('customPdfInfo');
    if (state.settings.customPdf) {
        const date = new Date(state.settings.customPdf.uploadDate)
            .toLocaleDateString();
        container.innerHTML = `
            <div class="pdf-info">
                <div class="pdf-info-header">
                    <strong>${state.settings.customPdf.name}</strong>
                    <button class="btn btn-secondary pdf-remove-btn" id="removePdfBtn">
                        Remove
                    </button>
                </div>
                <small>Uploaded: ${date} • ${state.settings.customPdf.numPages} pages</small>
            </div>
        `;
        document.getElementById('removePdfBtn')
                .addEventListener('click', removeCustomPdf);
    } else {
        container.innerHTML = `
            <small style="opacity:0.7;display:block;margin-top:10px;">
                No custom PDF uploaded
            </small>`;
        document.getElementById('pageInput').value = 1;
        document.getElementById('pageCount').textContent = '?';
        const zoomDisplay = document.getElementById('zoomLevel');
        if (zoomDisplay) {
            zoomDisplay.textContent = '100%';
        }
    }
}
async function removeCustomPdf() {
    try {
        if (!confirm('Delete the uploaded PDF? This cannot be undone.')) return;
        await deletePDFFromIndexedDB();
        state.settings.customPdf = null;
        state.settings.referenceSource = 'biblegateway';
        saveToStorage();
        updateCustomPdfInfo();
        if (document.getElementById('referenceSource').value === 'pdf') {
            document.getElementById('referenceSource').value = 'biblegateway';
            updateReferencePanel();
        }
    } catch (err) {
        handleError(err, 'removeCustomPdf');
    } 
}
export async function loadPDF() {
    if (!state.settings.customPdf) {
        alert('No custom PDF uploaded. Please upload one first.');
        return;
    }
    try {
        showLoading(true);
        if (state.pdf.doc) {
            state.pdf.doc.destroy().catch(() => {});
            state.pdf.doc = null;
        }
        state.pdf.renderTask = null;
        const pdfData = await loadPDFFromIndexedDB();
        if (!pdfData) throw new Error('PDF not found in DB');
        const buf = base64ToArrayBuffer(pdfData.data);
        const loadingTask = pdfjsLib.getDocument({ 
            data: buf,
            onPassword: (updatePassword, reason) => {
                const password = prompt(`This PDF requires a ${reason} password. Please enter the password:`);
                if (password) {
                    updatePassword(password);
                } else {
                    throw new Error(`Password required to open this PDF. ${reason === 1 ? 'Owner' : 'User'} password needed.`);
                }
            }
        });
        state.pdf.doc = await loadingTask.promise;
        const savedPage = state.pdf.currentPage || 1;
        const validPage = Math.min(savedPage, state.pdf.doc.numPages);
        state.pdf.currentPage = validPage;
        const savedZoom = state.pdf.zoomLevel || state.settings.pdfZoom;
        updatePDFZoom(savedZoom);
        document.getElementById('pageCount').textContent = state.pdf.doc.numPages;
        document.getElementById('pageInput').max = state.pdf.doc.numPages;
        document.getElementById('pageInput').value = validPage;
    } catch (err) {
        handleError(err, 'loadPDF');
        alert('Could not load PDF: ' + err.message);
        state.pdf.doc = null;
        state.pdf.renderTask = null;
    } finally {
        showLoading(false);
    }
}
export function updatePDFZoom(zoomLevel) {
    state.settings.pdfZoom = zoomLevel; 
    state.pdf.zoomLevel = zoomLevel;    
    saveToStorage();
    const zoomDisplay = document.getElementById('zoomLevel');
    if (zoomDisplay) {
        zoomDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
    if (state.pdf.doc && state.pdf.currentPage) {
        renderPage(state.pdf.currentPage);
    }
}
export function setupPDFCleanup() {
    window.addEventListener('beforeunload', () => {
        if (state.pdf.renderTask) {
            state.pdf.renderTask.cancel().catch(() => {});
            state.pdf.renderTask = null;
        }
    });
}
export async function renderPage(pageNum) {
    if (!state.pdf.doc) {
        console.warn('PDF document not loaded, attempting to reload...');
        await loadPDF();
        return;
    }
    try {
        if (state.pdf.renderTask) {
            try {
                await state.pdf.renderTask.cancel();
            } catch (e) {
            }
            state.pdf.renderTask = null;
        }
        const page = await state.pdf.doc.getPage(pageNum);
        const canvas = document.getElementById('pdfCanvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const viewport = page.getViewport({ scale: state.pdf.zoomLevel });
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        canvas.width = viewport.width * window.devicePixelRatio;
        canvas.height = viewport.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        state.pdf.renderTask = page.render({
            canvasContext: ctx,
            viewport: viewport
        });
        await state.pdf.renderTask.promise;
        page.cleanup();
        state.pdf.renderTask = null;
        document.getElementById('pageInput').value = pageNum;
        document.getElementById('prevPage').disabled = pageNum <= 1;
        document.getElementById('nextPage').disabled = pageNum >= state.pdf.doc.numPages;
        state.pdf.currentPage = pageNum;
        saveToStorage();
    } catch (err) {
        if (err.name === 'RenderingCancelledException') {
            console.log('Rendering cancelled normally');
            return;
        }
        console.warn('Render error, reloading PDF:', err);
        await loadPDF(); 
        handleError(err, 'renderPage');
    }
}
export async function searchPDF() {
    const query = document.getElementById('pdfSearchInput').value.trim();
    if (!query || !state.pdf.doc) return;
    const resultsSpan = document.getElementById('pdfSearchResults');
    const searchBtn = document.getElementById('pdfSearchBtn');
    resultsSpan.textContent = 'Searching...';
    searchBtn.disabled = true;
    searchBtn.textContent = 'Searching...';
    clearSearchHighlights();
    currentSearch = {
        query: query,
        results: [],
        currentResult: -1,
        highlights: []
    };
    try {
        for (let pageNum = 1; pageNum <= state.pdf.doc.numPages; pageNum++) {
            const page = await state.pdf.doc.getPage(pageNum)
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ');
            const regex = new RegExp(query.replace(/[.*+?^{}()|[\]\\]/g, '\\$&'), 'gi');
            let match;
            while ((match = regex.exec(text)) !== null) {
                currentSearch.results.push({
                    page: pageNum,
                    index: match.index,
                    text: match[0]
                });
            }
        }
        if (currentSearch.results.length > 0) {
            resultsSpan.textContent = `Found ${currentSearch.results.length} results`;
            document.getElementById('clearSearchBtn').style.display = 'inline-block';
            if (currentSearch.results.length > 1) {
                document.getElementById('prevSearchResult').style.display = 'inline-block';
                document.getElementById('nextSearchResult').style.display = 'inline-block';
            }
            navigateToSearchResult(0); 
        } else {
            resultsSpan.textContent = 'No results found';
            document.getElementById('clearSearchBtn').style.display = 'none';
            document.getElementById('prevSearchResult').style.display = 'none';
            document.getElementById('nextSearchResult').style.display = 'none';
        }
    } catch (err) {
        handleError(err, 'searchPDF');
        resultsSpan.textContent = 'Search failed';
        document.getElementById('clearSearchBtn').style.display = 'none';
        document.getElementById('prevSearchResult').style.display = 'none';
        document.getElementById('nextSearchResult').style.display = 'none';
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Search';
    }
}
export function clearSearch() {
    document.getElementById('pdfSearchInput').value = '';
    document.getElementById('pdfSearchResults').textContent = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    document.getElementById('prevSearchResult').style.display = 'none';
    document.getElementById('nextSearchResult').style.display = 'none';
    clearSearchHighlights();
    currentSearch = {
        query: '',
        results: [],
        currentResult: -1,
        highlights: []
    };
}
export async function navigateToSearchResult(index) {
    try {
        if (!currentSearch.results.length || index < 0 || index >= currentSearch.results.length) return;
        if (state.pdf.renderTask) {
            await state.pdf.renderTask.cancel();
            state.pdf.renderTask = null;
        }
        currentSearch.currentResult = index;
        const result = currentSearch.results[index];
        state.pdf.currentPage = result.page;
        await renderPage(result.page);
        document.getElementById('pdfSearchResults').textContent = 
            `Result ${index + 1} of ${currentSearch.results.length}`;
    }  catch (err) {
        handleError(err, 'navigateToSearchResult');
    } 
}
function clearSearchHighlights() {
    currentSearch.highlights.forEach(highlight => {
        if (highlight.animation) {
            currentSearch.highlights = [];
        }
    });
    if (state.pdf.currentPage) {
        renderPage(state.pdf.currentPage);
    }
}