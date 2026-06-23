import { State } from './state.js';
import { HoverEngine } from './hover.js';
import { Components } from './components.js';

export const UI = {
    // ==========================================
    // CONFIG, STATE & DOM CACHE
    // ==========================================
    config: {
        defaultTermColor: '#ffffff',
        defaultCourseColor: '#ffffff',
        defaultTagColor: '#3b82f6',
        colorisSwatches: [ '#ffffff', '#fca5a5', '#fdba74', '#fde047', '#86efac', '#93c5fd', '#d8b4fe', '#f9a8d4' ]
    },
    
    compactMode: false,
    showBreakdown: false,
    selectedCourseId: null,
    pinnedNode: null,

    elements: {}, 

    initDOM() {
        this.elements = {
            // Layout & Controls
            tableHead: document.getElementById('table-head'),
            tableBody: document.getElementById('table-body'),
            scheduleTable: document.getElementById('schedule-table'),
            compactToggle: document.getElementById('compact-toggle'),
            breakdownToggle: document.getElementById('breakdown-toggle'),
            // Footer
            descTitle: document.getElementById('desc-title'),
            descTags: document.getElementById('desc-tags'),
            descContent: document.getElementById('desc-content'),
            infoFooter: document.getElementById('info-footer'),
            footerResizer: document.getElementById('footer-resizer'),
            // Term Modal
            termModal: document.getElementById('term-modal'),
            termName: document.getElementById('term-name'),
            termColor: document.getElementById('term-color'),
            // Course Modal
            courseModal: document.getElementById('course-modal'),
            courseModalTitle: document.getElementById('course-modal-title'),
            courseForm: document.getElementById('course-form'),
            courseId: document.getElementById('course-id'),
            courseTitle: document.getElementById('course-title'),
            courseCredits: document.getElementById('course-credits'),
            courseColor: document.getElementById('course-color'),
            coursePrereqs: document.getElementById('course-prereqs'),
            courseCoreqs: document.getElementById('course-coreqs'),
            courseJoint: document.getElementById('course-joint'),
            courseDesc: document.getElementById('course-desc'),
            courseTagsContainer: document.getElementById('course-tags-container'),
            // Tag Manager & Editor Modals
            tagManagerModal: document.getElementById('tag-manager-modal'),
            globalTagsList: document.getElementById('global-tags-list'),
            tagEditorModal: document.getElementById('tag-editor-modal'),
            tagEditorTitle: document.getElementById('tag-editor-title'),
            tagEditId: document.getElementById('tag-edit-id'),
            tagEditName: document.getElementById('tag-edit-name'),
            tagEditColor: document.getElementById('tag-edit-color'),
            tagEditIconVal: document.getElementById('tag-edit-icon-val'),
            tagEditIcons: document.getElementById('tag-edit-icons'),
            // Whitelist Modal
            whitelistModal: document.getElementById('whitelist-modal'),
            whitelistInput: document.getElementById('whitelist-input'),
            // Confirm Modal
            confirmModal: document.getElementById('confirm-modal'),
            confirmTitle: document.getElementById('confirm-title'),
            confirmMessage: document.getElementById('confirm-message'),
            confirmBtn: document.getElementById('confirm-btn')
        };
    },

    utils: {
        sanitizeId: (str) => str.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9_-]/g, ''),
        parseList: (str) => str.split(',').map(s => s.trim().toUpperCase().replace(/\s+/g, '')).filter(s => s.length > 0),
        getContrastColor(hexColor) {
            if (!hexColor) return '';
            let r = parseInt(hexColor.substr(1, 2), 16);
            let g = parseInt(hexColor.substr(3, 2), 16);
            let b = parseInt(hexColor.substr(5, 2), 16);
            let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            return (yiq >= 128) ? '#000000' : '#ffffff';
        },
        setColoris(el, color) {
            if (el) {
                el.value = color;
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    },

    modals: {
        open(modalEl, focusEl = null) {
            if(modalEl) modalEl.classList.remove('hidden');
            if(focusEl) setTimeout(() => focusEl.focus(), 50);
        },
        closeAll() {
            const allModals = [
                UI.elements.termModal, UI.elements.courseModal, 
                UI.elements.whitelistModal, UI.elements.tagManagerModal, 
                UI.elements.tagEditorModal, UI.elements.confirmModal
            ];
            allModals.forEach(el => { if (el) el.classList.add('hidden'); });
        }
    },

    // ==========================================
    // INITIALIZATION
    // ==========================================
    initColoris() {
        if(window.Coloris) {
            Coloris({
                theme: 'pill',
                formatToggle: true,
                alpha: false,
                swatches: this.config.colorisSwatches
            });
        }
    },

    initResizer() {
        const resizer = this.elements.footerResizer;
        const footer = this.elements.infoFooter;
        let isDragging = false;

        resizer.addEventListener('mousedown', () => {
            isDragging = true;
            document.body.style.cursor = 'row-resize';
            document.body.classList.add('select-none');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newHeight = window.innerHeight - e.clientY;
            const maxHeight = window.innerHeight * 0.8;
            if (newHeight < 100) newHeight = 100;
            if (newHeight > maxHeight) newHeight = maxHeight;
            footer.style.height = `${newHeight}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = '';
                document.body.classList.remove('select-none');
            }
        });
    },

    // ==========================================
    // CORE RENDERING 
    // ==========================================
    renderTable() {
        let savedScrollPos = 0;
        const existingContainer = document.querySelector('.course-bank-container');
        if (existingContainer) savedScrollPos = existingContainer.scrollTop;

        this.elements.scheduleTable.classList.toggle('compact-table', this.compactMode);
        this.elements.tableHead.innerHTML = Components.buildHeaders();
        
        const sortedCourses = Object.values(State.courses).sort((a,b) => a.id.localeCompare(b.id));

        if (this.compactMode) {
            this.elements.tableBody.innerHTML = Components.buildCompactBody(sortedCourses);
            const newContainer = document.querySelector('.course-bank-container');
            if (newContainer) newContainer.scrollTop = savedScrollPos;
        } else {
            this.elements.tableBody.innerHTML = Components.buildStandardBody(sortedCourses);
        }

        if (this.pinnedNode) this.handleMouseOver(this.pinnedNode.cId, this.pinnedNode.tId, true);
    },

    // ==========================================
    // HOVER & FOOTER ENGINE
    // ==========================================
    updateFooter(cId) {
        const cData = State.courses[cId];
        if(!cData) return;

        this.elements.descTitle.innerText = `${cData.id}: ${cData.title}`;
        
        let tags = `<span class="bg-surface-alt px-2 py-1 rounded border border-border">${cData.credits} Credits</span>`;
        if(cData.prereqs.length) tags += `<span class="px-2 py-1 rounded border tag-prereq">Prereqs: ${cData.prereqs.join(', ')}</span>`;
        if(cData.coreqs.length) tags += `<span class="px-2 py-1 rounded border tag-coreq">Coreqs: ${cData.coreqs.join(', ')}</span>`;
        if(cData.joint && cData.joint.length) tags += `<span class="px-2 py-1 rounded border tag-joint">Joint: ${cData.joint.join(', ')}</span>`;
        
        if(cData.tags && cData.tags.length) {
            cData.tags.forEach(tId => {
                const tag = State.tags.find(t => t.id === tId);
                if(tag) {
                    const iconClass = tag.icon || 'ph-circle';
                    tags += `<span class="px-2 py-1 rounded bg-surface border flex items-center gap-1 text-text-main" style="border-color: ${tag.color};"><i class="ph-fill ${iconClass} text-sm" style="color: ${tag.color};"></i>${tag.name}</span>`;
                }
            });
        }
        
        this.elements.descTags.innerHTML = tags;
        this.elements.descContent.innerText = cData.desc || "No description provided.";
    },

    handleMouseOver(cId, tId, forceHighlight = false) {
        if (this.pinnedNode && !forceHighlight) {
            this.updateFooter(cId);
            return; 
        }

        this.updateFooter(cId);
        const classesToRemove = ['hl-hover', 'hl-imm-pre', 'hl-sec-pre', 'hl-post', 'hl-coreq', 'hl-err-temp', 'hl-err-miss'];
        
        // *Note: Using querySelectorAll here specifically because course cards are dynamic HTML strings rendered via innerHTML, not static layout elements.
        document.querySelectorAll('.card-node').forEach(node => node.classList.remove(...classesToRemove));

        const { highlights, status } = HoverEngine.analyze(cId, tId);

        document.querySelectorAll('.card-node').forEach(node => {
            const nodeCid = node.getAttribute('data-cid');
            const nodeTid = node.getAttribute('data-tid');
            
            if (nodeCid === cId && nodeTid === tId) {
                if (status.hasMissError) node.classList.add('hl-err-miss');
                else if (status.hasTempError) node.classList.add('hl-err-temp');
                else node.classList.add('hl-hover');
            } else {
                const key = `${nodeCid}_${nodeTid}`;
                if (highlights[key]) node.classList.add(highlights[key]);
            }
        });
    },

    handleMouseOut() {
        if (this.pinnedNode) {
            this.updateFooter(this.pinnedNode.cId);
            return;
        }
        this.elements.descTitle.innerText = "Hover over a course";
        this.elements.descTags.innerHTML = "";
        this.elements.descContent.innerText = "";
        
        const classesToRemove = ['hl-hover', 'hl-imm-pre', 'hl-sec-pre', 'hl-post', 'hl-coreq', 'hl-err-temp', 'hl-err-miss'];
        document.querySelectorAll('.card-node').forEach(node => node.classList.remove(...classesToRemove));
    },

    // ==========================================
    // ENTITY MODALS & FORMS
    // ==========================================
    openTermModal() {
        this.elements.termName.dataset.id = '';
        this.elements.termName.value = '';
        this.utils.setColoris(this.elements.termColor, this.config.defaultTermColor);
        this.modals.open(this.elements.termModal, this.elements.termName);
    },
    
    editTerm(tId) {
        const term = State.terms.find(t => t.id === tId);
        if(!term) return;
        this.elements.termName.dataset.id = tId;
        this.elements.termName.value = term.name;
        this.utils.setColoris(this.elements.termColor, term.color || this.config.defaultTermColor);
        this.modals.open(this.elements.termModal);
    },
    
    openCourseModal() {
        this.renderCourseTagsForm([]);
        this.elements.courseForm.reset();
        this.elements.courseForm.dataset.originalId = '';
        this.elements.courseId.readOnly = false;
        this.utils.setColoris(this.elements.courseColor, this.config.defaultCourseColor);
        this.elements.courseModalTitle.innerText = "Add Course";
        this.modals.open(this.elements.courseModal, this.elements.courseId);
    },

    editCourse(cId) {
        const c = State.courses[cId];
        if(!c) return;

        this.renderCourseTagsForm(c.tags || []);
        this.elements.courseForm.dataset.originalId = c.id;
        this.elements.courseId.value = c.id;
        this.elements.courseId.readOnly = false;
        this.elements.courseTitle.value = c.title;
        this.elements.courseCredits.value = c.credits;
        this.utils.setColoris(this.elements.courseColor, c.color || this.config.defaultCourseColor);
        this.elements.coursePrereqs.value = c.prereqs.join(', ');
        this.elements.courseCoreqs.value = c.coreqs.join(', ');
        this.elements.courseJoint.value = c.joint.join(', ');
        this.elements.courseDesc.value = c.desc;
        
        this.elements.courseModalTitle.innerText = "Edit Course";
        this.modals.open(this.elements.courseModal);
    },

    openTagManager() {
        this.renderGlobalTags();
        this.modals.open(this.elements.tagManagerModal);
    },

    openTagEditor(tagId = null) {
        this.elements.tagEditId.value = tagId || '';
        this.elements.tagEditorTitle.innerText = tagId ? 'Edit Tag' : 'Create Tag';
        
        let selectedIcon = 'ph-circle';
        if (tagId) {
            const tag = State.tags.find(t => t.id === tagId);
            this.elements.tagEditName.value = tag.name;
            this.utils.setColoris(this.elements.tagEditColor, tag.color);
            if (tag.icon) selectedIcon = tag.icon;
        } else {
            this.elements.tagEditName.value = '';
            this.utils.setColoris(this.elements.tagEditColor, this.config.defaultTagColor); 
        }
        
        this.renderIconPicker(selectedIcon);
        this.modals.open(this.elements.tagEditorModal, this.elements.tagEditName);
    },

    closeTagEditor() {
        this.elements.tagEditorModal.classList.add('hidden');
    },

    renderGlobalTags() {
        this.elements.globalTagsList.innerHTML = Components.buildGlobalTagsHTML();
    },

    renderCourseTagsForm(selectedTagIds = []) {
        this.elements.courseTagsContainer.innerHTML = Components.buildCourseTagsFormHTML(selectedTagIds);
    },

    renderIconPicker(selectedIcon = null) {
        const currentColor = this.elements.tagEditColor.value || this.config.defaultTagColor;
        if (!selectedIcon) selectedIcon = this.elements.tagEditIconVal.value || 'ph-circle';
        
        this.elements.tagEditIcons.innerHTML = Components.buildIconPickerHTML(selectedIcon, currentColor);
        this.elements.tagEditIconVal.value = selectedIcon;
    },

    selectIcon(icon) {
        this.renderIconPicker(icon);
    },

    // ==========================================
    // MISC UI UTILITIES
    // ==========================================
    openWhitelistModal() {
        this.elements.whitelistInput.value = State.whitelist.join(', ');
        this.modals.open(this.elements.whitelistModal, this.elements.whitelistInput);
    },

    showConfirm(title, msg, onConfirmCallback) {
        this.elements.confirmTitle.innerText = title;
        this.elements.confirmMessage.innerText = msg;
        this.modals.open(this.elements.confirmModal);
        
        // Re-assign the click handler to clear the modal and execute callback
        this.elements.confirmBtn.onclick = () => {
            this.closeConfirm();
            onConfirmCallback();
        };
    },

    closeConfirm() {
        this.elements.confirmModal.classList.add('hidden');
    }
};