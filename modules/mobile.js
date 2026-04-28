import { openSettings } from './settings.js';
import { saveToStorage, state } from './state.js';
import {
    exportNotes,
    initNotesView,
    togglePanelCollapse,
    toggleReferencePanel,
    toggleSection,
    updateReferencePanel,
    switchNotesView
} from './ui.js';
function initMobileNav() {
    const mobileTabs = document.querySelectorAll('.mobile-nav-tab');
    const mobilePanel = document.getElementById('mobilePanel');
    const mobilePanelContent = document.getElementById('mobilePanelContent');
    const mobilePanelClose = document.getElementById('mobilePanelClose');
    const sidebar = document.querySelector('.sidebar');
    const notesSection = document.querySelector('.notes-section');
    const referencePanel = document.getElementById('referencePanel');
    if (window.innerWidth > 850) return;
    mobileTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            handleMobileTabClick(this, {
                mobileTabs,
                mobilePanel,
                mobilePanelContent,
                sidebar,
                notesSection,
                referencePanel
            });
        });
    });
    if (mobilePanelClose) {
        mobilePanelClose.addEventListener('click', () => {
            closeMobilePanel(mobilePanel, mobileTabs);
        });
    }
}
function handleMobileTabClick(clickedTab, elements) {
    const { mobileTabs, mobilePanel, mobilePanelContent, sidebar, notesSection, referencePanel } = elements;
    const panel = clickedTab.dataset.panel;
    mobileTabs.forEach(t => t.classList.remove('active'));
    if (sidebar) sidebar.style.display = 'none';
    if (notesSection) notesSection.style.display = 'none';
    mobilePanel.classList.remove('active');
    switch (panel) {
        case 'scripture':
            handleScripturePanel(clickedTab, referencePanel);
            break;
        case 'sidebar':
            handleSidebarPanel(clickedTab, sidebar, mobilePanel, mobilePanelContent, referencePanel);
            break;
        case 'notes':
            handleNotesPanel(clickedTab, notesSection, mobilePanel, mobilePanelContent, referencePanel);
            break;
        case 'reference':
            handleReferencePanel(clickedTab, referencePanel, mobileTabs);
            break;
        case 'settings':
            handleSettingsPanel(mobileTabs);
            break;
    }
}
function handleScripturePanel(tab, referencePanel) {
    if (referencePanel) referencePanel.classList.remove('active');
    state.settings.referencePanelOpen = false;
    state.settings.mobileActiveTab = 'scripture';
    saveToStorage();
    tab.classList.add('active');
}
function handleSidebarPanel(tab, sidebar, mobilePanel, mobilePanelContent, referencePanel) {
    if (referencePanel) referencePanel.classList.remove('active');
    tab.classList.add('active');
    state.settings.mobileActiveTab = 'sidebar';
    saveToStorage();
    if (sidebar) {
        sidebar.classList.remove('panel-collapsed');
        mobilePanelContent.innerHTML = sidebar.outerHTML;
        const clonedSidebar = mobilePanelContent.querySelector('.sidebar');
        clonedSidebar.style.display = 'flex';
        clonedSidebar.style.flexDirection = 'column';
        clonedSidebar.style.height = '100%';
        clonedSidebar.querySelector('.collapse-toggle')?.remove();
        reattachSidebarEvents(clonedSidebar);
    }
    mobilePanel.classList.add('active');
}
function handleNotesPanel(tab, notesSection, mobilePanel, mobilePanelContent, referencePanel) {
    if (referencePanel) referencePanel.classList.remove('active');
    tab.classList.add('active');
    state.settings.mobileActiveTab = 'notes';
    state.settings.notesCollapsed = false;
    saveToStorage();
    if (notesSection) {
        notesSection.classList.remove('panel-collapsed');
        mobilePanelContent.innerHTML = notesSection.outerHTML;
        const clonedNotes = mobilePanelContent.querySelector('.notes-section');
        clonedNotes.style.display = 'flex';
        clonedNotes.style.height = '100%';
        clonedNotes.querySelector('.collapse-toggle')?.remove();
        setupMobileTextView(clonedNotes);
    }
    mobilePanel.classList.add('active');
}
function handleReferencePanel(tab, referencePanel, mobileTabs) {
    if (!referencePanel) return;
    const wasAlreadyActive = referencePanel.classList.contains('active');
    tab.classList.add('active');
    state.settings.mobileActiveTab = 'reference';
    saveToStorage();
    if (!wasAlreadyActive) {
        referencePanel.classList.add('active');
        state.settings.referencePanelOpen = true;
        saveToStorage();
        const iframe = referencePanel.querySelector('.reference-panel-iframe');
        if (iframe) {
            updateReferencePanel();
            setTimeout(() => {
                if (!iframe.src || iframe.src === 'about:blank') {
                    updateReferencePanel();
                }
            }, 100);
        }
        setupReferencePanelCloseButton(referencePanel, mobileTabs);
    }
}
function handleSettingsPanel(mobileTabs) {
    openSettings();
    const scriptureTab = document.querySelector('[data-panel="scripture"]');
    if (scriptureTab) scriptureTab.classList.add('active');
}
function closeMobilePanel(mobilePanel, mobileTabs) {
    mobilePanel.classList.remove('active');
    delete mobilePanel.dataset.activePanel;
    mobileTabs.forEach(t => {
        if (t.dataset.panel === 'scripture') {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });
    state.settings.mobileActiveTab = 'scripture';
    saveToStorage();
}
function setupReferencePanelCloseButton(referencePanel, mobileTabs) {
    const refClose = referencePanel.querySelector('.reference-panel-close');
    if (!refClose) return;
    const newRefClose = refClose.cloneNode(true);
    refClose.parentNode.replaceChild(newRefClose, refClose);
    newRefClose.addEventListener('click', () => {
        referencePanel.classList.remove('active');
        state.settings.referencePanelOpen = false;
        state.settings.mobileActiveTab = 'scripture';
        saveToStorage();
        mobileTabs.forEach(t => t.classList.remove('active'));
        const scriptureTab = document.querySelector('[data-panel="scripture"]');
        if (scriptureTab) scriptureTab.classList.add('active');
    });
}
function reattachSidebarEvents(sidebarElement) {
    sidebarElement.querySelectorAll('.sidebar-section-header').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        newHeader.addEventListener('click', () => {
            handleSidebarSectionToggle(newHeader);
        });
    });
    const refToggle = sidebarElement.querySelector('#referencePanelToggle');
    if (refToggle) {
        const newRefToggle = refToggle.cloneNode(true);
        refToggle.parentNode.replaceChild(newRefToggle, refToggle);
        newRefToggle.addEventListener('click', toggleReferencePanel);
    }
}
function handleSidebarSectionToggle(header) {
    const sectionId = header.dataset.section;
    const content = header.nextElementSibling;
    const toggle = header.querySelector('.section-toggle');
    if (!content || !content.classList.contains('sidebar-section-content')) return;
    const isCollapsed = content.classList.contains('collapsed');
    if (isCollapsed) {
        content.classList.remove('collapsed');
        if (toggle) toggle.classList.remove('collapsed');
    } else {
        content.classList.add('collapsed');
        if (toggle) toggle.classList.add('collapsed');
    }
    if (!state.settings.collapsedSections) {
        state.settings.collapsedSections = {};
    }
    state.settings.collapsedSections[sectionId] = isCollapsed ? false : true;
    saveToStorage();
    syncDesktopSidebarSection(sectionId, isCollapsed);
}
function syncDesktopSidebarSection(sectionId, wasCollapsed) {
    const desktopSidebar = document.querySelector('.sidebar:not(#mobilePanel .sidebar)');
    if (!desktopSidebar) return;
    const desktopHeader = desktopSidebar.querySelector(`[data-section="${sectionId}"]`);
    if (!desktopHeader) return;
    const desktopContent = desktopHeader.nextElementSibling;
    const desktopToggle = desktopHeader.querySelector('.section-toggle');
    if (!desktopContent) return;
    if (wasCollapsed) {
        desktopContent.classList.remove('collapsed');
        if (desktopToggle) desktopToggle.classList.remove('collapsed');
    } else {
        desktopContent.classList.add('collapsed');
        if (desktopToggle) desktopToggle.classList.add('collapsed');
    }
}
function setupMobileTextView(notesElement) {
    const notesInput = notesElement.querySelector('#notesInput');
    const notesDisplay = notesElement.querySelector('#notesDisplay');
    const toolbar = notesElement.querySelector('#markdownToolbar');
    const viewToggle = notesElement.querySelector('.notes-view-toggle');
    if (viewToggle) viewToggle.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
    if (notesDisplay) notesDisplay.style.display = 'none';
    if (notesInput) {
        notesInput.style.display = 'block';
        notesInput.style.flex = '1';
        notesInput.style.width = '100%';
        notesInput.style.minHeight = '0';
        notesInput.style.resize = 'none';
        notesInput.value = state.notes || '';
        notesInput.addEventListener('input', function(e) {
            const value = e.target.value;
            state.notes = value;
            saveToStorage();
            const origInput = document.querySelector('.notes-section #notesInput');
            if (origInput && origInput !== this) {
                origInput.value = value;
            }
        });
    }
    const notesControls = notesElement.querySelector('.notes-controls');
    if (notesControls) {
        notesControls.style.display = 'flex';
    }
    notesElement.querySelectorAll('.notes-controls button').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => exportNotes());
    });
}
export function handleMobileNavResize() {
    const mobileNavTabs = document.getElementById('mobileNavTabs');
    const mobilePanel = document.getElementById('mobilePanel');
    const sidebar = document.querySelector('.sidebar');
    const notesSection = document.querySelector('.notes-section');
    const referencePanel = document.getElementById('referencePanel');
    const isMobile = window.innerWidth <= 850;
    if (isMobile) {
        enterMobileMode(mobileNavTabs, mobilePanel, sidebar, notesSection);
    } else {
        enterDesktopMode(mobileNavTabs, mobilePanel, sidebar, notesSection, referencePanel);
    }
}
function enterMobileMode(mobileNavTabs, mobilePanel, sidebar, notesSection) {
    if (mobileNavTabs && !mobileNavTabs.classList.contains('active')) {
        mobileNavTabs.classList.add('active');
        if (sidebar) sidebar.style.display = 'none';
        if (notesSection) notesSection.style.display = 'none';
        if (!mobilePanel.dataset.initialized) {
            initMobileNav();
            mobilePanel.dataset.initialized = 'true';
        }
        restoreMobileTabState(mobileNavTabs, mobilePanel);
    }
}
function restoreMobileTabState(mobileNavTabs, mobilePanel) {
    const savedTab = state.settings.mobileActiveTab || 'scripture';
    const tabToRestore = document.querySelector(
        `.mobile-nav-tab[data-panel="${savedTab}"]`
    );
    if (tabToRestore) {
        tabToRestore.click();
    } else {
        const scriptureTab = document.querySelector('[data-panel="scripture"]');
        if (scriptureTab) scriptureTab.classList.add('active');
    }
}
function enterDesktopMode(mobileNavTabs, mobilePanel, sidebar, notesSection, referencePanel) {
    if (mobileNavTabs) mobileNavTabs.classList.remove('active');
    if (mobilePanel) {
        mobilePanel.classList.remove('active');
        delete mobilePanel.dataset.activePanel;
    }
    if (sidebar) {
        sidebar.style.display = '';
        if (state.settings.sidebarCollapsed) {
            sidebar.classList.add('panel-collapsed');
        } else {
            sidebar.classList.remove('panel-collapsed');
        }
    }
    if (notesSection) {
        notesSection.style.display = '';
        if (state.settings.notesCollapsed) {
            notesSection.classList.add('panel-collapsed');
        } else {
            notesSection.classList.remove('panel-collapsed');
        }
        initNotesView();
    }
    if (referencePanel) {
        referencePanel.classList.remove('mobile-panel');
        if (state.settings.referencePanelOpen) {
            referencePanel.classList.add('active');
        } else {
            referencePanel.classList.remove('active');
        }
    }
    const mobileTabs = document.querySelectorAll('.mobile-nav-tab');
    mobileTabs.forEach(tab => tab.classList.remove('active'));
    const scriptureTab = document.querySelector('[data-panel="scripture"]');
    if (scriptureTab) scriptureTab.classList.add('active');
    const mobilePanelContent = document.getElementById('mobilePanelContent');
    if (mobilePanelContent) mobilePanelContent.innerHTML = '';
    restoreDesktopEventListeners();
}
function restoreDesktopEventListeners() {
    restoreSidebarListeners();
    restorePanelCollapseListeners();
    restoreReferencePanelListeners();
    restoreNotesListeners();
}
function restoreSidebarListeners() {
    document.querySelectorAll('.sidebar-section-header').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        newHeader.addEventListener('click', () => toggleSection(newHeader.dataset.section));
    });
}
function restorePanelCollapseListeners() {
    document.querySelectorAll('.collapse-toggle').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function() {
            const panel = this.closest('[id]');
            if (panel) togglePanelCollapse(panel.id);
        });
    });
}
function restoreReferencePanelListeners() {
    const refSource = document.getElementById('referenceSource');
    const refTranslation = document.getElementById('referenceTranslation');
    const refClose = document.querySelector('.reference-panel-close');
    if (refSource) {
        const newRefSource = refSource.cloneNode(true);
        refSource.parentNode.replaceChild(newRefSource, refSource);
        newRefSource.addEventListener('change', updateReferencePanel);
    }
    if (refTranslation) {
        const newRefTranslation = refTranslation.cloneNode(true);
        refTranslation.parentNode.replaceChild(newRefTranslation, refTranslation);
        newRefTranslation.addEventListener('change', updateReferencePanel);
    }
    if (refClose) {
        const newRefClose = refClose.cloneNode(true);
        refClose.parentNode.replaceChild(newRefClose, refClose);
        newRefClose.addEventListener('click', toggleReferencePanel);
    }
}
function restoreNotesListeners() {
    const notesInput = document.getElementById('notesInput');
    const textViewBtn = document.getElementById('textViewBtn');
    const markdownViewBtn = document.getElementById('markdownViewBtn');
    if (notesInput) {
        const newNotesInput = notesInput.cloneNode(true);
        newNotesInput.value = state.notes || '';
        notesInput.parentNode.replaceChild(newNotesInput, notesInput);
        newNotesInput.addEventListener('input', function(e) {
            state.notes = e.target.value;
            saveToStorage();
        });
    }
    if (textViewBtn) {
        const newTextViewBtn = textViewBtn.cloneNode(true);
        textViewBtn.parentNode.replaceChild(newTextViewBtn, textViewBtn);
        newTextViewBtn.addEventListener('click', () => switchNotesView('text'));
    }
    if (markdownViewBtn) {
        const newMarkdownViewBtn = markdownViewBtn.cloneNode(true);
        markdownViewBtn.parentNode.replaceChild(newMarkdownViewBtn, markdownViewBtn);
        newMarkdownViewBtn.addEventListener('click', () => switchNotesView('markdown'));
    }
    document.querySelectorAll('.notes-section .markdown-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            import('./ui.js').then(({ insertMarkdown }) => insertMarkdown(newBtn.dataset.format));
        });
    });
    document.querySelectorAll('.notes-section .notes-controls button').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => exportNotes(newBtn.dataset.format));
    });
}