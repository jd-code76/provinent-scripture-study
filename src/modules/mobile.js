/* ====================================================================
   MOBILE NAVIGATION - mobile.js
   Mobile tab-based navigation for smaller screens
==================================================================== */

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

/* ====================================================================
   MOBILE NAVIGATION INITIALIZATION
==================================================================== */

/**
 * Initialize mobile navigation tabs and panel switching
 * Only runs on screens 850px or smaller
 */
function initMobileNav() {
    const mobileTabs = document.querySelectorAll('.mobile-nav-tab');
    const mobilePanel = document.getElementById('mobilePanel');
    const mobilePanelContent = document.getElementById('mobilePanelContent');
    const mobilePanelClose = document.getElementById('mobilePanelClose');
    const sidebar = document.querySelector('.sidebar');
    const notesSection = document.querySelector('.notes-section');
    const referencePanel = document.getElementById('referencePanel');

    // Only initialize on mobile screens
    if (window.innerWidth > 850) return;

    // Attach click handlers to each mobile tab
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

    // Handle mobile panel close button
    if (mobilePanelClose) {
        mobilePanelClose.addEventListener('click', () => {
            closeMobilePanel(mobilePanel, mobileTabs);
        });
    }
}

/**
 * Handle mobile tab click and switch to appropriate panel
 * @param {HTMLElement} clickedTab - The tab that was clicked
 * @param {Object} elements - Object containing all relevant DOM elements
 */
function handleMobileTabClick(clickedTab, elements) {
    const { mobileTabs, mobilePanel, mobilePanelContent, sidebar, notesSection, referencePanel } = elements;
    const panel = clickedTab.dataset.panel;

    // Clear all active states
    mobileTabs.forEach(t => t.classList.remove('active'));

    // Hide all panels
    if (sidebar) sidebar.style.display = 'none';
    if (notesSection) notesSection.style.display = 'none';
    mobilePanel.classList.remove('active');

    // Handle each panel type
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

/**
 * Handle switching to scripture panel (main reading view)
 * @param {HTMLElement} tab - The scripture tab element
 * @param {HTMLElement} referencePanel - The reference panel element
 */
function handleScripturePanel(tab, referencePanel) {
    if (referencePanel) referencePanel.classList.remove('active');
    state.settings.referencePanelOpen = false;
    state.settings.mobileActiveTab = 'scripture';
    saveToStorage();
    tab.classList.add('active');
}

/**
 * Handle switching to sidebar panel (resources)
 * @param {HTMLElement} tab - The sidebar tab element
 * @param {HTMLElement} sidebar - The sidebar element
 * @param {HTMLElement} mobilePanel - The mobile panel container
 * @param {HTMLElement} mobilePanelContent - The mobile panel content area
 * @param {HTMLElement} referencePanel - The reference panel element
 */
function handleSidebarPanel(tab, sidebar, mobilePanel, mobilePanelContent, referencePanel) {
    if (referencePanel) referencePanel.classList.remove('active');
    tab.classList.add('active');
    state.settings.mobileActiveTab = 'sidebar';
    saveToStorage();

    if (sidebar) {
        sidebar.classList.remove('panel-collapsed');

        // Clone sidebar into mobile panel
        mobilePanelContent.innerHTML = sidebar.outerHTML;
        const clonedSidebar = mobilePanelContent.querySelector('.sidebar');
        clonedSidebar.style.display = 'flex';
        clonedSidebar.style.flexDirection = 'column';
        clonedSidebar.style.height = '100%';
        clonedSidebar.querySelector('.collapse-toggle')?.remove();

        // Reattach event listeners to cloned sidebar
        reattachSidebarEvents(clonedSidebar);
    }

    mobilePanel.classList.add('active');
}

/**
 * Handle switching to notes panel (text-only view on mobile)
 * @param {HTMLElement} tab - The notes tab element
 * @param {HTMLElement} notesSection - The notes section element
 * @param {HTMLElement} mobilePanel - The mobile panel container
 * @param {HTMLElement} mobilePanelContent - The mobile panel content area
 * @param {HTMLElement} referencePanel - The reference panel element
 */
function handleNotesPanel(tab, notesSection, mobilePanel, mobilePanelContent, referencePanel) {
    if (referencePanel) referencePanel.classList.remove('active');
    tab.classList.add('active');
    state.settings.mobileActiveTab = 'notes';

    // Ensure notes section is not collapsed
    state.settings.notesCollapsed = false;
    saveToStorage();

    if (notesSection) {
        notesSection.classList.remove('panel-collapsed');

        // Clone notes section into mobile panel
        mobilePanelContent.innerHTML = notesSection.outerHTML;
        const clonedNotes = mobilePanelContent.querySelector('.notes-section');
        clonedNotes.style.display = 'flex';
        clonedNotes.style.height = '100%';
        clonedNotes.querySelector('.collapse-toggle')?.remove();

        // Setup simple text-only notes view
        setupMobileTextView(clonedNotes);
    }

    mobilePanel.classList.add('active');
}

/**
 * Handle switching to reference panel.
 * Always highlights the tab. Only reloads the iframe if the panel
 * was not already active — prevents unnecessary reloads on repeated taps
 * while keeping the tab highlight correct.
 * @param {HTMLElement} tab - The reference tab element
 * @param {HTMLElement} referencePanel - The reference panel element
 * @param {NodeList} mobileTabs - All mobile navigation tabs
 */
function handleReferencePanel(tab, referencePanel, mobileTabs) {
    if (!referencePanel) return;

    const wasAlreadyActive = referencePanel.classList.contains('active');

    // Always mark the tab active regardless of prior panel state
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

/**
 * Handle switching to settings (opens settings modal)
 * @param {NodeList} mobileTabs - All mobile navigation tabs
 */
function handleSettingsPanel(mobileTabs) {
    openSettings();

    // Keep scripture tab active after closing settings
    const scriptureTab = document.querySelector('[data-panel="scripture"]');
    if (scriptureTab) scriptureTab.classList.add('active');
}

/**
 * Close the mobile panel and return to scripture view
 * @param {HTMLElement} mobilePanel - The mobile panel container
 * @param {NodeList} mobileTabs - All mobile navigation tabs
 */
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

/* ====================================================================
   REFERENCE PANEL HANDLERS
==================================================================== */

/**
 * Setup close button for reference panel on mobile
 * @param {HTMLElement} referencePanel - The reference panel element
 * @param {NodeList} mobileTabs - All mobile navigation tabs
 */
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

/* ====================================================================
   SIDEBAR EVENT HANDLERS
==================================================================== */

/**
 * Reattach event listeners to cloned sidebar in mobile panel
 * @param {HTMLElement} sidebarElement - The cloned sidebar element
 */
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

/**
 * Handle sidebar section expand/collapse
 * Saves state so both mobile and desktop remain in sync
 * @param {HTMLElement} header - The section header element
 */
function handleSidebarSectionToggle(header) {
    const sectionId = header.dataset.section;
    const content = header.nextElementSibling;
    const toggle = header.querySelector('.section-toggle');

    if (!content || !content.classList.contains('sidebar-section-content')) return;

    const isCollapsed = content.classList.contains('collapsed');

    // Toggle collapsed state on the mobile clone
    if (isCollapsed) {
        content.classList.remove('collapsed');
        if (toggle) toggle.classList.remove('collapsed');
    } else {
        content.classList.add('collapsed');
        if (toggle) toggle.classList.add('collapsed');
    }

    // Save sidebar section state so desktop view also persists it
    if (!state.settings.collapsedSections) {
        state.settings.collapsedSections = {};
    }
    state.settings.collapsedSections[sectionId] = isCollapsed ? false : true;
    saveToStorage();

    // Sync collapsed state to the desktop sidebar
    syncDesktopSidebarSection(sectionId, isCollapsed);
}

/**
 * Sync sidebar section collapsed state to the desktop sidebar
 * @param {string} sectionId - The section identifier
 * @param {boolean} wasCollapsed - Whether the section was collapsed before the click
 */
function syncDesktopSidebarSection(sectionId, wasCollapsed) {
    // Target the original sidebar, not any cloned copy inside .mobile-panel
    const desktopSidebar = document.querySelector('.sidebar:not(#mobilePanel .sidebar)');
    if (!desktopSidebar) return;

    const desktopHeader = desktopSidebar.querySelector(`[data-section="${sectionId}"]`);
    if (!desktopHeader) return;

    const desktopContent = desktopHeader.nextElementSibling;
    const desktopToggle = desktopHeader.querySelector('.section-toggle');

    if (!desktopContent) return;

    // Apply the new state (opposite of wasCollapsed)
    if (wasCollapsed) {
        desktopContent.classList.remove('collapsed');
        if (desktopToggle) desktopToggle.classList.remove('collapsed');
    } else {
        desktopContent.classList.add('collapsed');
        if (desktopToggle) desktopToggle.classList.add('collapsed');
    }
}

/* ====================================================================
   NOTES - TEXT-ONLY MOBILE VIEW
==================================================================== */

/**
 * Set up simple text-only notes view for mobile.
 * Markdown toggle, toolbar, and preview are all hidden.
 * The textarea saves directly to state and syncs with desktop.
 * @param {HTMLElement} notesElement - The cloned notes section element
 */
function setupMobileTextView(notesElement) {
    const notesInput = notesElement.querySelector('#notesInput');
    const notesDisplay = notesElement.querySelector('#notesDisplay');
    const toolbar = notesElement.querySelector('#markdownToolbar');
    const viewToggle = notesElement.querySelector('.notes-view-toggle');

    // Hide elements not needed on mobile
    if (viewToggle) viewToggle.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
    if (notesDisplay) notesDisplay.style.display = 'none';

    if (notesInput) {
        // Ensure textarea fills the available space
        notesInput.style.display = 'block';
        notesInput.style.flex = '1';
        notesInput.style.width = '100%';
        notesInput.style.minHeight = '0';
        notesInput.style.resize = 'none';

        // Populate with current saved notes
        notesInput.value = state.notes || '';

        // Save on every keystroke and sync to desktop textarea
        notesInput.addEventListener('input', function(e) {
            const value = e.target.value;
            state.notes = value;
            saveToStorage();

            // Sync to the original desktop notes input
            const origInput = document.querySelector('.notes-section #notesInput');
            if (origInput && origInput !== this) {
                origInput.value = value;
            }
        });
    }

    // Keep the export button accessible
    const notesControls = notesElement.querySelector('.notes-controls');
    if (notesControls) {
        notesControls.style.display = 'flex';
    }

    // Reattach export button
    notesElement.querySelectorAll('.notes-controls button').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => exportNotes());
    });
}

/* ====================================================================
   RESIZE HANDLING
==================================================================== */

/**
 * Handle responsive behavior when window is resized
 * Switches between mobile and desktop modes
 */
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

/**
 * Switch to mobile mode UI.
 * On first entry, restores the last active tab from state so that
 * a page refresh lands on the correct tab rather than always defaulting
 * to Scripture.
 * @param {HTMLElement} mobileNavTabs - Mobile navigation tabs container
 * @param {HTMLElement} mobilePanel - Mobile panel container
 * @param {HTMLElement} sidebar - Sidebar element
 * @param {HTMLElement} notesSection - Notes section element
 */
function enterMobileMode(mobileNavTabs, mobilePanel, sidebar, notesSection) {
    if (mobileNavTabs && !mobileNavTabs.classList.contains('active')) {
        mobileNavTabs.classList.add('active');

        if (sidebar) sidebar.style.display = 'none';
        if (notesSection) notesSection.style.display = 'none';

        if (!mobilePanel.dataset.initialized) {
            initMobileNav();
            mobilePanel.dataset.initialized = 'true';
        }

        // Restore the tab that was active before the refresh
        restoreMobileTabState(mobileNavTabs, mobilePanel);
    }
}

/**
 * Restore the last active mobile tab from persisted state.
 * Called once after initMobileNav() so all click handlers are already bound.
 * @param {HTMLElement} mobileNavTabs - Mobile navigation tabs container
 * @param {HTMLElement} mobilePanel - Mobile panel container
 */
function restoreMobileTabState(mobileNavTabs, mobilePanel) {
    const savedTab = state.settings.mobileActiveTab || 'scripture';

    // Find and simulate a click on the saved tab so all panel
    // open/close logic runs exactly as if the user tapped it
    const tabToRestore = document.querySelector(
        `.mobile-nav-tab[data-panel="${savedTab}"]`
    );

    if (tabToRestore) {
        tabToRestore.click();
    } else {
        // Fallback: activate scripture tab
        const scriptureTab = document.querySelector('[data-panel="scripture"]');
        if (scriptureTab) scriptureTab.classList.add('active');
    }
}

/**
 * Switch to desktop mode UI
 * @param {HTMLElement} mobileNavTabs - Mobile navigation tabs container
 * @param {HTMLElement} mobilePanel - Mobile panel container
 * @param {HTMLElement} sidebar - Sidebar element
 * @param {HTMLElement} notesSection - Notes section element
 * @param {HTMLElement} referencePanel - Reference panel element
 */
function enterDesktopMode(mobileNavTabs, mobilePanel, sidebar, notesSection, referencePanel) {
    if (mobileNavTabs) mobileNavTabs.classList.remove('active');
    if (mobilePanel) {
        mobilePanel.classList.remove('active');
        delete mobilePanel.dataset.activePanel;
    }

    // Restore desktop sidebar
    if (sidebar) {
        sidebar.style.display = '';
        if (state.settings.sidebarCollapsed) {
            sidebar.classList.add('panel-collapsed');
        } else {
            sidebar.classList.remove('panel-collapsed');
        }
    }

    // Restore desktop notes section
    if (notesSection) {
        notesSection.style.display = '';
        if (state.settings.notesCollapsed) {
            notesSection.classList.add('panel-collapsed');
        } else {
            notesSection.classList.remove('panel-collapsed');
        }

        // Re-initialize desktop notes view
        initNotesView();
    }

    // Restore reference panel state
    if (referencePanel) {
        referencePanel.classList.remove('mobile-panel');
        if (state.settings.referencePanelOpen) {
            referencePanel.classList.add('active');
        } else {
            referencePanel.classList.remove('active');
        }
    }

    // Reset mobile tabs to scripture
    const mobileTabs = document.querySelectorAll('.mobile-nav-tab');
    mobileTabs.forEach(tab => tab.classList.remove('active'));
    const scriptureTab = document.querySelector('[data-panel="scripture"]');
    if (scriptureTab) scriptureTab.classList.add('active');

    // Clear mobile panel content
    const mobilePanelContent = document.getElementById('mobilePanelContent');
    if (mobilePanelContent) mobilePanelContent.innerHTML = '';

    // Restore all desktop event listeners
    restoreDesktopEventListeners();
}

/* ====================================================================
   DESKTOP EVENT RESTORATION
==================================================================== */

/**
 * Restore all desktop event listeners after switching from mobile
 */
function restoreDesktopEventListeners() {
    restoreSidebarListeners();
    restorePanelCollapseListeners();
    restoreReferencePanelListeners();
    restoreNotesListeners();
}

/**
 * Restore sidebar section toggle event listeners for desktop
 */
function restoreSidebarListeners() {
    document.querySelectorAll('.sidebar-section-header').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        newHeader.addEventListener('click', () => toggleSection(newHeader.dataset.section));
    });
}

/**
 * Restore panel collapse toggle event listeners for desktop
 */
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

/**
 * Restore reference panel control event listeners for desktop
 */
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

/**
 * Restore notes section event listeners for desktop
 */
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
