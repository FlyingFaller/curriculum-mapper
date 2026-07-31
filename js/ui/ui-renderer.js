/**
 * Primary View Renderer.
 * Exclusively owns the structural DOM nodes (grid, sidebars, headers). 
 * Handles DOM injection, dynamic CSS class toggling, and layout recalculations.
 */

import { State }           from '../state.js';
import { Utils }           from '../utils.js';
import { HoverEngine }     from '../hover-engine.js';
import { TemplateTable }   from './templates/template-table.js';
import { TemplateCard }    from './templates/template-card.js';
import { TemplateSidebar } from './templates/template-sidebar.js';

export const UIRenderer = {
    elements: {},
    
    init() {
        const ids = [
            'table-head', 'table-body', 'schedule-table', 'compact-toggle', 'breakdown-toggle',
            'desc-title', 'desc-tags', 'desc-content', 'info-footer', 'footer-resizer',
            'generator-sidebar', 'sidebar-resizer', 'gen-max-terms', 'gen-max-results', 'gen-max-time', 
            'gen-min-credits', 'gen-max-credits', 'gen-filter-courses', 'gen-filter-min-credits',
            'gen-filter-max-credits', 'gen-sort-select',
            'saved-schedules-list', 'generator-results-list', 'btn-generate', 'generator-summary',
            'active-schedule-name', 'preview-schedule-name', 'preview-schedule-text', 
            'sidebar-active-name', 'active-schedule-action-menu', 'generator-filters-panel'
        ];
        this.elements = ids.reduce((acc, id) => {
            const camelKey = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            acc[camelKey] = document.getElementById(id);
            return acc;
        }, {});

        this.initResizer();
        this.updateLegendContrast();
        const themeObserver = new MutationObserver(() => this.updateLegendContrast());
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    },

    initResizer() {
        const footerResizer = this.elements.footerResizer;
        const footer = this.elements.infoFooter;
        let isDraggingFooter = false;

        const sidebarResizer = this.elements.sidebarResizer;
        const sidebar = this.elements.generatorSidebar;
        let isDraggingSidebar = false;

        footerResizer.addEventListener('mousedown', () => {
            isDraggingFooter = true;
            document.body.classList.add('cursor-row-resize', 'select-none');
        });
        sidebarResizer.addEventListener('mousedown', () => {
            isDraggingSidebar = true;
            document.body.classList.add('cursor-col-resize', 'select-none');
        });

        document.addEventListener('mousemove', (e) => {
            if (isDraggingFooter) {
                let newHeight = window.innerHeight - e.clientY;
                const maxHeight = window.innerHeight * 0.8;
                if (newHeight < 100) newHeight = 100;
                if (newHeight > maxHeight) newHeight = maxHeight;
                footer.style.height = `${newHeight}px`;
            } else if (isDraggingSidebar) {
                let newWidth = e.clientX;
                const minWidth = 240; 
                const maxWidth = window.innerWidth * 0.5; 
                if (newWidth < minWidth) newWidth = minWidth;
                if (newWidth > maxWidth) newWidth = maxWidth;
                sidebar.style.width = `${newWidth}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDraggingFooter) {
                isDraggingFooter = false;
                document.body.classList.remove('cursor-row-resize', 'select-none');
            }
            if (isDraggingSidebar) {
                isDraggingSidebar = false;
                document.body.classList.remove('cursor-col-resize', 'select-none');
            }
        });
    },

    updateLegendContrast() {
        document.querySelectorAll('.legend-item').forEach(el => {
            const computedBg = getComputedStyle(el).backgroundColor;
            el.style.color = Utils.getContrastColor(computedBg);
        });
    },

    updateScheduleDisplay() {
        const activeSched = State.schedules[State.activeScheduleId];
        if (activeSched) {
            this.elements.activeScheduleName.value = activeSched.name;
            if (this.elements.sidebarActiveName) {
                this.elements.sidebarActiveName.innerText = activeSched.name;
            }
        }
        if (this.elements.activeScheduleActionMenu) {
            const schedCount = Object.keys(State.schedules).length;
            this.elements.activeScheduleActionMenu.classList.toggle('hidden', schedCount <= 1);
        }
        
        const isPreview = State.isPreviewMode;
        this.elements.activeScheduleName.classList.toggle('hidden', isPreview);
        
        if (this.elements.previewScheduleName) {
            this.elements.previewScheduleName.classList.toggle('hidden', !isPreview);
            if (isPreview) {
                const displayedSched = State.displayedSchedule;
                if (displayedSched) this.elements.previewScheduleText.innerText = displayedSched.name;
            }
        }
    },

    toggleCompactModeStyles() {
        this.elements.scheduleTable.classList.toggle('compact-table', State.compactMode);
        const icon = this.elements.compactToggle.querySelector('i');
        if (State.compactMode) {
            icon.className = 'ph ph-rows text-xl';
            this.elements.compactToggle.classList.add('text-accent');
            this.elements.compactToggle.classList.remove('text-text-muted');
        } else {
            icon.className = 'ph ph-squares-four text-xl';
            this.elements.compactToggle.classList.remove('text-accent');
            this.elements.compactToggle.classList.add('text-text-muted');
        }
    },

    toggleBreakdownStyles() {
        if (State.showBreakdown) {
            this.elements.breakdownToggle.classList.add('text-accent');
            this.elements.breakdownToggle.classList.remove('text-text-muted');
        } else {
            this.elements.breakdownToggle.classList.remove('text-accent');
            this.elements.breakdownToggle.classList.add('text-text-muted');
        }
    },

    renderHeaders() {
        this.elements.tableHead.innerHTML = TemplateTable.buildHeaders();
    },
    
    renderTable() {
        this.updateScheduleDisplay();
        this.elements.scheduleTable.classList.toggle('compact-table', State.compactMode);
        this.renderHeaders(); 
        this.renderBody();
        if (State.pinnedNode) this.handleMouseOver(State.pinnedNode.cId, State.pinnedNode.tId, true);
    },

    renderBody() {
        let savedScrollPos = 0;
        const existingContainer = document.querySelector('.course-bank-container');
        if (existingContainer) savedScrollPos = existingContainer.scrollTop;

        const sortedCourses = Object.values(State.courses).sort((a,b) => a.id.localeCompare(b.id));

        if (State.compactMode) {
            this.elements.tableBody.innerHTML = TemplateTable.buildCompactBody(sortedCourses);
            const newContainer = document.querySelector('.course-bank-container');
            if (newContainer) newContainer.scrollTop = savedScrollPos;
        } else {
            this.elements.tableBody.innerHTML = TemplateTable.buildStandardBody(sortedCourses);
        }
    },

    refreshCell(cId, tId) {
        const course = State.courses[cId];
        const hasCredits = course && (course.credits || 0) > 0;

        if (State.compactMode) {
            this.renderBody();
        } else {
            const td = document.querySelector(`td[data-cell-cid="${cId}"][data-cell-tid="${tId}"]`);
            if (td) {
                const isVisible = State.displayedGrid[cId]?.[tId];
                if (isVisible !== undefined) {
                    const term = State.terms.find(t => t.id === tId);
                    td.innerHTML = TemplateCard.generateCourseCardHTML(course, term, !isVisible, false);
                } else {
                    td.innerHTML = '';
                }
            }
        }
        if (hasCredits) this.renderHeaders();
    },

    renderSidebarSchedules() {
        if (!this.elements.savedSchedulesList) return;
        const schedIds = Object.keys(State.schedules).filter(id => id !== State.activeScheduleId);
        const anyPinned = !!State.pinnedScheduleId;
                  
        if (schedIds.length === 0) {
            this.elements.savedSchedulesList.innerHTML = TemplateSidebar.buildEmptyState("No saved schedules.");
            return;
        }
        
        let html = '';
        schedIds.forEach(id => {
            const sched = State.schedules[id];
            const isPinned = State.pinnedScheduleId === id;
            html += TemplateSidebar.buildSavedScheduleCard(id, sched, isPinned, anyPinned);
        });
        
        this.elements.savedSchedulesList.innerHTML = html;
    },

    updateSidebarHighlights() {
        const anyPinned = !!State.pinnedScheduleId;
        document.querySelectorAll('.schedule-item').forEach(el => {
            const id = el.getAttribute('data-sid');
            const isPinned = State.pinnedScheduleId === id;
            const innerBox = el.querySelector('.border');
            const textSpan = el.querySelector('span.truncate.text-left');
            
            if (!innerBox || !textSpan) return;
            
            const activeClasses = ['selected-card', 'bg-[var(--color-hover)]', 'shadow-md'];
            const unpinnedAnyClasses = ['border-border', 'bg-surface', 'group-hover:bg-surface-hover', 'group-hover:border-border-focus'];
            const unpinnedNoneClasses = ['border-border', 'bg-surface', 'group-hover:bg-[var(--color-hover)]', 'group-hover:border-[var(--color-hover)]'];
            
            const textActiveClasses = ['text-white'];
            const textUnpinnedAnyClasses = ['text-text-main', 'group-hover:text-text-main'];
            const textUnpinnedNoneClasses = ['text-text-main', 'group-hover:text-white'];

            innerBox.classList.remove(...activeClasses, ...unpinnedAnyClasses, ...unpinnedNoneClasses);
            textSpan.classList.remove(...textActiveClasses, ...textUnpinnedAnyClasses, ...textUnpinnedNoneClasses);

            if (isPinned) {
                innerBox.classList.add(...activeClasses);
                textSpan.classList.add(...textActiveClasses);
            } else if (anyPinned) {
                innerBox.classList.add(...unpinnedAnyClasses);
                textSpan.classList.add(...textUnpinnedAnyClasses);
            } else {
                innerBox.classList.add(...unpinnedNoneClasses);
                textSpan.classList.add(...textUnpinnedNoneClasses);
            }
        });
    },

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
        const { highlights, status } = HoverEngine.analyze(cId, tId);
        const semanticToClass = {
            'immediatePrereq': 'hl-imm-pre',
            'secondaryPrereq': 'hl-sec-pre',
            'postrequisite': 'hl-post',
            'corequisite': 'hl-coreq',
            'errorTemp': 'hl-err-temp'
        };

        document.querySelectorAll('.card-node').forEach(node => {
            node.classList.remove('hl-hover', 'hl-imm-pre', 'hl-sec-pre', 'hl-post', 'hl-coreq', 'hl-err-temp', 'hl-err-miss');
            const nodeCid = node.getAttribute('data-cid');
            const nodeTid = node.getAttribute('data-tid');
            
            if (nodeCid === cId && nodeTid === tId) {
                if (status.hasMissError) node.classList.add('hl-err-miss');
                else if (status.hasTempError) node.classList.add('hl-err-temp');
                else node.classList.add('hl-hover');
            } else {
                const key = `${nodeCid}_${nodeTid}`;
                if (highlights[key]) node.classList.add(semanticToClass[highlights[key]]);
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

    toggleGeneratorSidebar() {
        this.elements.generatorSidebar.classList.toggle('-translate-x-full');
    },

    toggleGeneratorFilters() {
        if (this.elements.generatorFiltersPanel) {
            this.elements.generatorFiltersPanel.classList.toggle('hidden');
        }
    },

    getGeneratorConfig() {
        return {
            minCredits: parseInt(this.elements.genMinCredits.value) || 7,
            maxCredits: parseInt(this.elements.genMaxCredits.value) || 15,
            maxTerms: parseInt(this.elements.genMaxTerms.value) || 6,
            maxResults: parseInt(this.elements.genMaxResults.value) || Infinity,
            maxTime: parseInt(this.elements.genMaxTime.value) || Infinity
        };
    },

    setGeneratorLoading(isLoading) {
        const btn = this.elements.btnGenerate;
        if (!btn) return;
        
        if (isLoading) {
            btn.disabled = true;
            btn.classList.add('opacity-70', 'cursor-not-allowed');
            this._generatorStartTime = Date.now();
            this._generatorTimer = setInterval(() => {
                const elapsed = ((Date.now() - this._generatorStartTime) / 1000).toFixed(1);
                btn.innerHTML = TemplateSidebar.buildGeneratorButtonContent(true, elapsed);
            }, 100);
        } else {
            clearInterval(this._generatorTimer);
            btn.disabled = false;
            btn.classList.remove('opacity-70', 'cursor-not-allowed');
            btn.innerHTML = TemplateSidebar.buildGeneratorButtonContent(false);
        }
    },

    setGeneratorSummary(text, isError = false) {
        const summaryEl = this.elements.generatorSummary;
        if (summaryEl) {
            summaryEl.dataset.baseText = text;
            summaryEl.innerText = text;
            summaryEl.classList.toggle('text-danger-main', isError);
            summaryEl.classList.toggle('text-text-muted', !isError);
        }
    },

    injectGeneratorError(statusCode, isFatal = false, message = '') {
        const container = this.elements.generatorResultsList;
        if (!container) return;
        
        container.innerHTML = TemplateSidebar.buildGeneratorError(statusCode, isFatal, message);
    },

    renderGeneratedSchedules() {
        const container = this.elements.generatorResultsList;
        const summaryEl = this.elements.generatorSummary;
        if (!container) return;
        
        const totalCount = Object.keys(State.generatedSchedules || {}).length;
        const schedIds = this.getFilteredAndSortedScheduleIds(); 
        const filteredCount = schedIds.length;
        const anyPinned = !!State.pinnedScheduleId;
        
        if (summaryEl && summaryEl.dataset.baseText) {
            if (filteredCount < totalCount) {
                summaryEl.innerText = `${summaryEl.dataset.baseText} (Showing ${filteredCount})`;
            } else {
                summaryEl.innerText = summaryEl.dataset.baseText;
            }
        }
        
        if (filteredCount === 0) {
            container.innerHTML = TemplateSidebar.buildEmptyState("No results match your filters.");
            return;
        }
        
        let html = '';
        schedIds.forEach((id, index) => {
            const sched = State.generatedSchedules[id];
            const isPinned = State.pinnedScheduleId === id;
            html += TemplateSidebar.buildGeneratedScheduleCard(id, sched, index, isPinned, anyPinned);
        });
        
        container.innerHTML = html;
    },

    getFilteredAndSortedScheduleIds() {
        let schedIds = Object.keys(State.generatedSchedules || {});
        if (schedIds.length === 0) return [];
        
        const filterText = this.elements.genFilterCourses?.value.trim().toUpperCase() || '';
        const minCredits = parseInt(this.elements.genFilterMinCredits?.value) || 0;
        const maxCredits = parseInt(this.elements.genFilterMaxCredits?.value) || Infinity;
        const sortVal = this.elements.genSortSelect?.value || 'totalCreditsAsc';

        schedIds = schedIds.filter(id => {
            const sched = State.generatedSchedules[id];
            if (sched.totalCredits < minCredits || sched.totalCredits > maxCredits) return false;
            if (filterText) {
                const tokens = filterText.split(',').map(t => t.trim()).filter(Boolean);
                const passesText = tokens.every(token => {
                    const exclude = token.startsWith('-');
                    const termSplit = exclude ? token.substring(1).split(':') : token.split(':');
                    const courseId = termSplit[0];
                    const termConstraint = termSplit[1] ? parseInt(termSplit[1].replace('T', '')) - 1 : null;
                    const courseGrid = sched.grid[courseId];
                    let isPresent = false;
                    if (courseGrid) {
                        if (termConstraint !== null) {
                            const termId = State.terms[termConstraint]?.id;
                            isPresent = courseGrid[termId] === true;
                        } else {
                            isPresent = Object.values(courseGrid).some(val => val === true);
                        }
                    }
                    return exclude ? !isPresent : isPresent;
                });
                if (!passesText) return false;
            }
            return true;
        });

        schedIds.sort((a, b) => {
            const schedA = State.generatedSchedules[a];
            const schedB = State.generatedSchedules[b];
            
            if (sortVal === 'totalCreditsAsc') {
                if (schedA.totalCredits !== schedB.totalCredits) return schedA.totalCredits - schedB.totalCredits;
                return schedA.maxTermLoad - schedB.maxTermLoad;
            }
            if (sortVal === 'totalCreditsDesc') {
                if (schedA.totalCredits !== schedB.totalCredits) return schedB.totalCredits - schedA.totalCredits;
                return schedB.maxTermLoad - schedA.maxTermLoad;
            }
            if (sortVal.startsWith('maxLoad') || sortVal.startsWith('minLoad')) {
                const isMaxSort = sortVal.startsWith('maxLoad');
                const isAsc = sortVal.endsWith('Asc');
                const loadsA = isMaxSort ? schedA.sortedTermLoadsDesc : schedA.sortedTermLoadsAsc;
                const loadsB = isMaxSort ? schedB.sortedTermLoadsDesc : schedB.sortedTermLoadsAsc;
                
                const len = Math.max(loadsA.length, loadsB.length);
                for (let i = 0; i < len; i++) {
                    const valA = loadsA[i] || 0;
                    const valB = loadsB[i] || 0;
                    if (valA !== valB) return isAsc ? valA - valB : valB - valA;
                }
                return isAsc ? schedA.totalCredits - schedB.totalCredits : schedB.totalCredits - schedA.totalCredits;
            }
            return 0;
        });
        return schedIds;
    }
};