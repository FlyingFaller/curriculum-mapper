import { ThemeConfig } from './theme.js';
import { State } from './state.js';
import { Storage } from './storage.js';
import { HoverEngine } from './hover.js';
import { UI } from './ui.js';

const App = {
    // ==========================================
    // INITIALIZATION
    // ==========================================
    init() {
        ThemeConfig.init();
        if (!Storage.load()) {
            State.initDefault();
            Storage.save();
        }
        
        UI.initDOM(); 
        UI.initColoris();
        UI.renderTable();
        UI.renderSidebarSchedules();
        UI.initResizer();

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (State.pinnedNode) App.clearPin();
                if (State.pinnedScheduleId) {
                    State.pinnedScheduleId = null;
                    UI.renderSidebarSchedules();
                    UI.renderTable();
                }
            }
        });
    },

    // ==========================================
    // GLOBAL ACTIONS
    // ==========================================
    toggleCompactMode() {
        State.compactMode = !State.compactMode;
        if (!State.compactMode) State.selectedCourseId = null; 
        
        const btn = UI.elements.compactToggle;
        const icon = btn.querySelector('i');
        
        if (State.compactMode) {
            icon.className = 'ph ph-rows text-xl';
            btn.classList.add('text-accent');
            btn.classList.remove('text-text-muted');
        } else {
            icon.className = 'ph ph-squares-four text-xl';
            btn.classList.remove('text-accent');
            btn.classList.add('text-text-muted');
        }
        UI.renderTable();
    },

    toggleBreakdown() {
        State.showBreakdown = !State.showBreakdown;
        
        const btn = UI.elements.breakdownToggle;
        if (State.showBreakdown) {
            btn.classList.add('text-accent');
            btn.classList.remove('text-text-muted');
        } else {
            btn.classList.remove('text-accent');
            btn.classList.add('text-text-muted');
        }
        UI.renderTable();
    },

    showAllHidden() {
        if (State.isPreviewMode) return;
        UI.showConfirm("Unhide All", "Are you sure you want to make all hidden course cards visible?", () => {
            Object.values(State.activeGrid).forEach(termMap => {
                Object.values(termMap).forEach(cell => {
                    if (cell.active) cell.hidden = false;
                });
            });
            Storage.save();
            UI.renderTable();
        });
    },

    hideErrors() {
        if (State.isPreviewMode) return;
        UI.showConfirm("Hide Errors", "This will automatically hide scheduled instances that have missing or incorrectly timed prerequisites. Proceed?", () => {
            let changed = true;
            let passLimit = 100; 
            let passes = 0;
            
            while (changed && passes < passLimit) {
                changed = false;
                passes++;
                let toHide = [];

                const allCourses = Object.keys(State.activeGrid);
                for (const cId of allCourses) {
                    for (const tId in State.activeGrid[cId]) {
                        let cell = State.activeGrid[cId][tId];
                        if (cell.active && !cell.hidden) {
                            let { status } = HoverEngine.analyze(cId, tId);
                            if (status.hasTempError || status.hasMissError) toHide.push({ cId, tId });
                        }
                    }
                }

                if (toHide.length > 0) {
                    toHide.forEach(({ cId, tId }) => State.activeGrid[cId][tId].hidden = true);
                    changed = true; 
                }
            }
            Storage.save();
            UI.renderTable();
        });
    },

    resetMap() {
        if (State.isPreviewMode) return;
        UI.showConfirm("Reset Map", "Are you sure you want to completely reset the schedule builder?", () => {
            localStorage.removeItem('curriculumMap');
            State.initDefault();
            Storage.save();
            UI.renderTable();
            UI.renderSidebarSchedules(); 
        });
    },

    saveWhitelist() {
        const rawInput = UI.elements.whitelistInput.value;
        State.whitelist = UI.utils.parseList(rawInput);
        Storage.save();
        UI.modals.closeAll();
        UI.renderTable();
    },

    // ==========================================
    // ENTITY MANAGEMENT (Courses, Terms, Tags)
    // ==========================================
    saveCourse() {
        const rawId = UI.elements.courseId.value;
        const id = UI.utils.sanitizeId(rawId);
        if(!id) return alert("Course ID is required.");
        
        const originalId = UI.elements.courseForm.dataset.originalId;
        const colorVal = UI.elements.courseColor.value;
        const color = colorVal !== UI.config.defaultCourseColor ? colorVal : '';

        if (originalId && originalId !== id) {
            if (State.courses[id]) return alert("A course with this new ID already exists!");
            
            State.courses[id] = State.courses[originalId];
            State.courses[id].id = id;
            delete State.courses[originalId];
            
            Object.values(State.schedules).forEach(sched => {
                if (sched.grid[originalId]) {
                    sched.grid[id] = sched.grid[originalId];
                    delete sched.grid[originalId];
                }
            });
            
            Object.values(State.courses).forEach(c => {
                c.prereqs = c.prereqs.map(req => req === originalId ? id : req);
                c.coreqs = c.coreqs.map(req => req === originalId ? id : req);
                c.joint = c.joint.map(req => req === originalId ? id : req);
            });
        }

        const selectedTags = Array.from(document.querySelectorAll('.course-tag-checkbox:checked')).map(cb => cb.value);

        State.courses[id] = {
            id: id,
            title: UI.elements.courseTitle.value.trim(),
            credits: parseInt(UI.elements.courseCredits.value) || 0,
            prereqs: UI.utils.parseList(UI.elements.coursePrereqs.value),
            coreqs: UI.utils.parseList(UI.elements.courseCoreqs.value),
            joint: UI.utils.parseList(UI.elements.courseJoint.value),
            tags: selectedTags,
            desc: UI.elements.courseDesc.value.trim(),
            color: color
        };

        Storage.save();
        UI.modals.closeAll();
        UI.renderTable();
    },

    deleteCourse(courseId) {
        UI.showConfirm("Delete Course", `Delete course ${courseId} completely?`, () => {
            delete State.courses[courseId];
            Object.values(State.schedules).forEach(sched => {
                delete sched.grid[courseId];
            });
            Object.values(State.courses).forEach(c => {
                c.prereqs = c.prereqs.filter(req => req !== courseId);
                c.coreqs = c.coreqs.filter(req => req !== courseId);
                c.joint = c.joint.filter(req => req !== courseId);
            });
            Storage.save();
            UI.renderTable();
        });
    },

    saveTerm() {
        const name = UI.elements.termName.value.trim();
        if (!name) return;
        
        const colorVal = UI.elements.termColor.value;
        const color = colorVal !== UI.config.defaultTermColor ? colorVal : '';
        const id = UI.elements.termName.dataset.id;
        
        if (id) {
            const term = State.terms.find(t => t.id === id);
            if (term) {
                term.name = name;
                term.color = color;
            }
        } else {
            const newId = 't-' + Date.now();
            State.terms.push({ id: newId, name, color: color });
        }
        
        Storage.save();
        UI.modals.closeAll();
        UI.renderTable();
    },

    deleteTerm(termId) {
        UI.showConfirm("Delete Term", "Delete this term and all course assignments in it?", () => {
            State.terms = State.terms.filter(t => t.id !== termId);
            Object.values(State.schedules).forEach(sched => {
                Object.keys(sched.grid).forEach(cId => {
                    if (sched.grid[cId][termId]) delete sched.grid[cId][termId];
                });
            });
            Storage.save();
            UI.renderTable();
        });
    },

    saveTag() {
        const idInput = UI.elements.tagEditId.value;
        const name = UI.elements.tagEditName.value.trim();
        const color = UI.elements.tagEditColor.value;
        const icon = UI.elements.tagEditIconVal.value || 'ph-circle';

        if (!name) return alert("Tag name is required");

        let constraints = null;
        if (UI.elements.tagEditEnableConstraints.checked) {
            const maxVal = UI.elements.tagEditMax.value;
            constraints = {
                type: UI.elements.tagEditReqType.value,
                metric: UI.elements.tagEditMetric.value,
                min: parseInt(UI.elements.tagEditMin.value) || 0,
                max: maxVal ? parseInt(maxVal) : null,
                weight: parseInt(UI.elements.tagEditWeight.value) || 5
            };
        }

        let newTagId = null; 

        if (idInput) {
            const tag = State.tags.find(t => t.id === idInput);
            if (tag) { 
                tag.name = name; 
                tag.color = color; 
                tag.icon = icon; 
                tag.constraints = constraints;
            }
        } else {
            newTagId = 'tag-' + Date.now();
            State.tags.push({ id: newTagId, name, color, icon, constraints });
        }

        Storage.save();
        UI.closeTagEditor();
        UI.renderGlobalTags(); 
        
        const checkedBoxes = Array.from(document.querySelectorAll('.course-tag-checkbox:checked')).map(cb => cb.value);
        if (newTagId) checkedBoxes.push(newTagId);

        UI.renderCourseTagsForm(checkedBoxes); 
        UI.renderTable();
    },

    deleteTag(tagId) {
        UI.showConfirm("Delete Tag", "Are you sure? This will remove the tag from all courses.", () => {
            State.tags = State.tags.filter(t => t.id !== tagId);
            Object.values(State.courses).forEach(c => c.tags = (c.tags || []).filter(t => t !== tagId));
            Storage.save();
            UI.renderGlobalTags();
            UI.renderCourseTagsForm();
            UI.renderTable();
        });
    },

    // ==========================================
    // GRID INTERACTIONS
    // ==========================================
    togglePin(event, courseId, termId) {
        event.stopPropagation(); 
        if (State.pinnedNode && State.pinnedNode.cId === courseId && State.pinnedNode.tId === termId) {
            this.clearPin();
        } else {
            State.pinnedNode = { cId: courseId, tId: termId };
            UI.renderTable(); 
            UI.handleMouseOver(courseId, termId, true);
        }
    },

    clearPin() {
        State.pinnedNode = null;
        UI.renderTable();
        UI.handleMouseOut();
    },

    selectCourse(courseId) {
        if (State.isPreviewMode) return;
        State.selectedCourseId = (State.selectedCourseId === courseId) ? null : courseId;
        UI.renderTable();
    },

    toggleCell(courseId, termId) {
        if (State.isPreviewMode) return;
        if (!State.activeGrid[courseId]) State.activeGrid[courseId] = {};
        if (!State.activeGrid[courseId][termId]?.active) {
            State.activeGrid[courseId][termId] = { active: true, hidden: false };
            Storage.save();
            UI.renderTable();
        }
    },

    removeCard(event, courseId, termId) {
        event.stopPropagation(); 
        if (State.activeGrid[courseId]?.[termId]) {
            State.activeGrid[courseId][termId].active = false;
            Storage.save();
            UI.renderTable();
            UI.handleMouseOut();
        }
    },

    toggleHidden(event, courseId, termId) {
        event.stopPropagation();
        if (State.activeGrid[courseId]?.[termId]) {
            State.activeGrid[courseId][termId].hidden = !State.activeGrid[courseId][termId].hidden;
            Storage.save();
            UI.renderTable();
        }
    },

    hideDeadEnds(event, courseId, termId) {
        event.stopPropagation();
        const { highlights } = HoverEngine.analyze(courseId, termId);
        let hiddenCount = 0;
        
        for (const [key, highlightClass] of Object.entries(highlights)) {
            if (highlightClass === 'hl-err-temp') {
                const [targetCid, targetTid] = key.split('_');
                if (State.activeGrid[targetCid] && State.activeGrid[targetCid][targetTid]) {
                    State.activeGrid[targetCid][targetTid].hidden = true;
                    hiddenCount++;
                }
            }
        }

        if (hiddenCount > 0) {
            Storage.save();
            UI.renderTable();
            UI.handleMouseOver(courseId, termId, true); 
        }
    },

    // --- Schedule Preview & Management ---

    updateScheduleName(newName) {
        if (State.schedules[State.activeScheduleId]) {
            State.schedules[State.activeScheduleId].name = newName;
            State.schedules[State.activeScheduleId].lastModified = Date.now();
            Storage.save();
            if (UI.elements.sidebarActiveName) {
                UI.elements.sidebarActiveName.innerText = newName;
            }
        }
    },

    snapshotSchedule() {
        const currentSched = State.schedules[State.activeScheduleId];
        if (!currentSched) return;

        const newId = 'sched-' + Date.now();
        const newName = currentSched.name + ' Copy';
        
        // Deep copy the grid to prevent reference mutation
        const gridCopy = JSON.parse(JSON.stringify(currentSched.grid));

        State.schedules[newId] = {
            name: newName,
            lastModified: Date.now(),
            grid: gridCopy
        };

        Storage.save();
        UI.renderSidebarSchedules();
    },

    switchSchedule(scheduleId) {
        if (State.schedules[scheduleId]) {
            State.activeScheduleId = scheduleId;
            Storage.save();
            UI.renderTable(); 
        }
    },

    deleteSchedule(scheduleId) {
        UI.showConfirm("Delete Schedule", "Are you sure you want to permanently delete this schedule?", () => {
            delete State.schedules[scheduleId];
            Storage.save();
            UI.renderSidebarSchedules();
        });
    },

    hoverSchedule(id) {
        if (State.pinnedScheduleId) return; // Ignore hover if something is pinned
        State.hoveredScheduleId = id;
        UI.renderTable();
    },

    unhoverSchedule() {
        if (State.pinnedScheduleId) return;
        State.hoveredScheduleId = null;
        UI.renderTable();
    },

    togglePinSchedule(id) {
        State.pinnedScheduleId = (State.pinnedScheduleId === id) ? null : id;
        State.hoveredScheduleId = null; // Clear hover state
        UI.renderSidebarSchedules();
        UI.renderTable();
    },

    switchSchedule(event, scheduleId) {
        event.stopPropagation();
        if (State.schedules[scheduleId]) {
            State.activeScheduleId = scheduleId;
            State.pinnedScheduleId = null;
            State.hoveredScheduleId = null;
            Storage.save();
            UI.renderSidebarSchedules();
            UI.renderTable(); 
        }
    },

    deleteSchedule(event, scheduleId) {
        event.stopPropagation();
        UI.showConfirm("Delete Schedule", "Are you sure you want to permanently delete this schedule?", () => {
            delete State.schedules[scheduleId];
            if (State.pinnedScheduleId === scheduleId) State.pinnedScheduleId = null;
            if (State.hoveredScheduleId === scheduleId) State.hoveredScheduleId = null;
            Storage.save();
            UI.renderSidebarSchedules();
            UI.renderTable();
        });
    },
};

window.ThemeConfig = ThemeConfig;
window.State = State;
window.Storage = Storage;
window.HoverEngine = HoverEngine;
window.UI = UI;
window.Components = window.Components || {};
window.App = App;

document.addEventListener('DOMContentLoaded', () => App.init());