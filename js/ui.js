import { State } from './state.js';
import { HoverEngine } from './hover.js';
import { Components } from './components.js';

export const UI = {
    // ==========================================
    // CONFIG, STATE & DOM CACHE
    // ==========================================
    config: {
        defaultTermColor: '',
        defaultCourseColor: '',
        defaultTagColor: '#3b82f6',
        colorisSwatches: [ '#ffffff', '#fca5a5', '#fdba74', '#fde047', '#86efac', '#93c5fd', '#d8b4fe', '#f9a8d4' ]
    },

    elements: {}, 

    initDOM() {
        const ids = [
            'table-head', 'table-body', 'schedule-table', 'compact-toggle', 'breakdown-toggle',
            'desc-title', 'desc-tags', 'desc-content', 'info-footer', 'footer-resizer',
            'term-modal', 'term-name', 'term-color', 
            'course-modal', 'course-modal-title', 'course-form', 'course-id', 'course-title', 
            'course-credits', 'course-color', 'course-prereqs', 'course-coreqs', 'course-joint', 
            'course-desc', 'course-tags-container',
            'tag-manager-modal', 'global-tags-list', 'tag-editor-modal', 'tag-editor-title',
            'tag-edit-id', 'tag-edit-name', 'tag-edit-color', 'tag-edit-icon-val', 'tag-edit-icons',
            'tag-edit-enable-constraints', 'tag-constraints-container', 'tag-edit-req-type',
            'tag-edit-metric', 'tag-edit-min', 'tag-edit-max', 'tag-edit-weight', 
            'tag-weight-container', 'tag-weight-val',
            'whitelist-modal', 'whitelist-input',
            'confirm-modal', 'confirm-title', 'confirm-message', 'confirm-btn',
            'export-modal', 'export-format', 'export-options-container', 'export-ignore-hidden', 
            'export-ignore-bank', 'export-include-meta', 'export-meta-label',
            'generator-sidebar', 'gen-max-terms', 'gen-max-results', 'gen-max-time', 
            'saved-schedules-list', 'generator-results-list',
            'active-schedule-name', 'preview-schedule-name', 'preview-schedule-text', 
            'sidebar-active-name'
        ];

        this.elements = ids.reduce((acc, id) => {
            const camelKey = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            acc[camelKey] = document.getElementById(id);
            return acc;
        }, {});

        // Dynamically auto-contrast legend text on initial load
        this.updateLegendContrast();

        // Listen for Theme changes on the <html> tag to re-evaluate contrast
        const themeObserver = new MutationObserver(() => this.updateLegendContrast());
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    },

    utils: {
        sanitizeId: (str) => str.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9_-]/g, ''),
        parseList: (str) => str.split(',').map(s => s.trim().toUpperCase().replace(/\s+/g, '')).filter(s => s.length > 0),
        getContrastColor(colorStr) {
            if (!colorStr) return '#000000';
            let r, g, b;
            
            if (colorStr.startsWith('rgb')) {
                const match = colorStr.match(/\d+/g);
                if (!match || match.length < 3) return '#000000';
                r = parseInt(match[0]);
                g = parseInt(match[1]);
                b = parseInt(match[2]);
            } else {
                let hex = colorStr.replace('#', '');
                if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
                r = parseInt(hex.substr(0, 2), 16);
                g = parseInt(hex.substr(2, 2), 16);
                b = parseInt(hex.substr(4, 2), 16);
            }
            
            let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            // Returning exact hexes here overrides inline theme inversions.
            return (yiq >= 128) ? '#000000' : '#ffffff';
        },
        setColoris(selectorOrEl, color) {
            // Check if we were passed a string selector (like '#course-color') or an element directly
            const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
            
            if (el) {
                el.value = color;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                // Dispatch 'change' to ensure the Coloris visual swatch UI updates correctly
                el.dispatchEvent(new Event('change', { bubbles: true }));
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
                UI.elements.tagEditorModal, UI.elements.confirmModal,
                UI.elements.exportModal
            ];
            allModals.forEach(el => { if (el) el.classList.add('hidden'); });
        }
    },

    // ==========================================
    // INITIALIZATION & RESIZERS
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
    updateLegendContrast() {
        document.querySelectorAll('.legend-item').forEach(el => {
            const computedBg = getComputedStyle(el).backgroundColor;
            el.style.color = this.utils.getContrastColor(computedBg);
        });
    },

    renderTable() {
        const activeSched = State.schedules[State.activeScheduleId];
        if (activeSched) {
            this.elements.activeScheduleName.value = activeSched.name;
            if (this.elements.sidebarActiveName) {
                this.elements.sidebarActiveName.innerText = activeSched.name;
            }
        }

        const isPreview = State.isPreviewMode;
        this.elements.activeScheduleName.classList.toggle('hidden', isPreview);
        
        if (this.elements.previewScheduleName) {
            this.elements.previewScheduleName.classList.toggle('hidden', !isPreview);
            if (isPreview) {
                const displayedSched = State.schedules[State.displayedScheduleId];
                this.elements.previewScheduleText.innerText = displayedSched.name;
            }
        }
        
        let savedScrollPos = 0;
        const existingContainer = document.querySelector('.course-bank-container');
        if (existingContainer) savedScrollPos = existingContainer.scrollTop;

        this.elements.scheduleTable.classList.toggle('compact-table', State.compactMode);
        this.elements.tableHead.innerHTML = Components.buildHeaders();
        
        const sortedCourses = Object.values(State.courses).sort((a,b) => a.id.localeCompare(b.id));

        if (State.compactMode) {
            this.elements.tableBody.innerHTML = Components.buildCompactBody(sortedCourses);
            const newContainer = document.querySelector('.course-bank-container');
            if (newContainer) newContainer.scrollTop = savedScrollPos;
        } else {
            this.elements.tableBody.innerHTML = Components.buildStandardBody(sortedCourses);
        }

        if (State.pinnedNode) this.handleMouseOver(State.pinnedNode.cId, State.pinnedNode.tId, true);
    },

    renderSidebarSchedules() {
        if (!this.elements.savedSchedulesList) return;

        const schedIds = Object.keys(State.schedules).filter(id => id !== State.activeScheduleId);
        const anyPinned = !!State.pinnedScheduleId; 
        
        if (schedIds.length === 0) {
            this.elements.savedSchedulesList.innerHTML = `
                <div class="text-caption text-text-muted italic p-3 text-center border border-dashed border-border rounded bg-canvas">
                    No saved schedules.
                </div>`;
            return;
        }

        let html = '';
        schedIds.forEach(id => {
            const sched = State.schedules[id];
            const isPinned = State.pinnedScheduleId === id;
            
            let activeClass = '';
            let textClass = '';

            if (isPinned) {
                activeClass = 'selected-card bg-[var(--color-hover)] shadow-md';
                textClass = 'text-white';
            } else if (anyPinned) {
                activeClass = 'border-border bg-surface hover:bg-surface-hover hover:border-border-border';
                textClass = 'text-text-main group-hover:text-text-main';
            } else {
                activeClass = 'border-border bg-surface hover:bg-[var(--color-hover)] hover:border-[var(--color-hover)]';
                textClass = 'text-text-main group-hover:text-white';
            }
            
            html += `
            <div class="border ${activeClass} rounded-md shadow-sm p-2 flex items-center group relative cursor-pointer transition-colors duration-200"
                 onmouseenter="App.hoverSchedule('${id}')"
                 onmouseleave="App.unhoverSchedule()"
                 onclick="App.togglePinSchedule('${id}')">
                
                <span class="text-sm font-medium ${textClass} transition-colors truncate text-left w-full pr-14" title="${sched.name}">${sched.name}</span>
                
                <div class="card-action-menu" style="top: 0.125rem; right: 0.125rem;">
                    <button onclick="App.switchSchedule(event, '${id}')" class="btn-icon" title="Make Active"><i class="ph ph-arrow-right text-base leading-none"></i></button>
                    <button onclick="App.deleteSchedule(event, '${id}')" class="btn-icon-danger" title="Delete Schedule"><i class="ph ph-trash text-base leading-none"></i></button>
                </div>
            </div>`;
        });
        
        this.elements.savedSchedulesList.innerHTML = html;
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
        if (State.pinnedNode && !forceHighlight) {
            this.updateFooter(cId);
            return; 
        }

        this.updateFooter(cId);
        const classesToRemove = ['hl-hover', 'hl-imm-pre', 'hl-sec-pre', 'hl-post', 'hl-coreq', 'hl-err-temp', 'hl-err-miss'];
        
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
        if (State.pinnedNode) {
            this.updateFooter(State.pinnedNode.cId);
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
        const tag = tagId ? State.tags.find(t => t.id === tagId) : {};
        const constraints = tag.constraints || {};
        
        this.elements.tagEditId.value = tagId || '';
        this.elements.tagEditorTitle.innerText = tagId ? 'Edit Tag' : 'Create Tag';
        this.elements.tagEditName.value = tag.name || '';
        this.utils.setColoris(this.elements.tagEditColor, tag.color || this.config.defaultTagColor);
        
        const hasConstraints = !!tag.constraints;
        this.elements.tagEditEnableConstraints.checked = hasConstraints;
        
        this.elements.tagEditReqType.value = constraints.type || 'mandatory';
        this.elements.tagEditMetric.value = constraints.metric || 'courses';
        this.elements.tagEditMin.value = constraints.min !== undefined ? constraints.min : 1;
        this.elements.tagEditMax.value = constraints.max !== undefined ? constraints.max : '';
        
        const weight = constraints.weight || 5;
        this.elements.tagEditWeight.value = weight;
        this.elements.tagWeightVal.innerText = weight;
        
        this.toggleTagConstraints();
        this.renderIconPicker(tag.icon || 'ph-circle');
        this.modals.open(this.elements.tagEditorModal, this.elements.tagEditName);
    },

    toggleTagConstraints() {
        const isEnabled = this.elements.tagEditEnableConstraints.checked;
        const reqType = this.elements.tagEditReqType.value;
        
        this.elements.tagConstraintsContainer.classList.toggle('hidden', !isEnabled);
        this.elements.tagWeightContainer.classList.toggle('hidden', !isEnabled || reqType !== 'optional');
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

    openExportModal() {
        this.elements.exportFormat.value = 'json';
        this.toggleExportOptions();
        this.modals.open(this.elements.exportModal, this.elements.exportFormat);
    },

    toggleExportOptions() {
        const format = this.elements.exportFormat.value;
        const isJson = format === 'json';
        
        this.elements.exportOptionsContainer.classList.toggle('hidden', isJson);
        this.elements.exportMetaLabel.classList.toggle('hidden', isJson || format.startsWith('pdf'));
    },

    openWhitelistModal() {
        this.elements.whitelistInput.value = State.whitelist.join(', ');
        this.modals.open(this.elements.whitelistModal, this.elements.whitelistInput);
    },

    // ==========================================
    // SCHEDULE GENERATOR
    // ==========================================

    toggleGeneratorSidebar() {
        this.elements.generatorSidebar.classList.toggle('-translate-x-full');
    },

    // ==========================================
    // MISC UI UTILITIES
    // ==========================================
    showConfirm(title, msg, onConfirmCallback) {
        this.elements.confirmTitle.innerText = title;
        this.elements.confirmMessage.innerText = msg;
        this.modals.open(this.elements.confirmModal);
        
        this.elements.confirmBtn.onclick = () => {
            this.closeConfirm();
            onConfirmCallback();
        };
    },

    closeConfirm() {
        this.elements.confirmModal.classList.add('hidden');
    }
};