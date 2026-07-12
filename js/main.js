import { ThemeConfig } from './theme.js';
import { State } from './state.js';
import { Storage } from './storage.js';
import { HoverEngine } from './hover.js';
import { UI } from './ui.js';
import { setupEventListeners } from './events.js';

export const App = {
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

        setupEventListeners();
    },

    toggleCompactMode() {
        State.compactMode = !State.compactMode;
        if (!State.compactMode) State.selectedCourseId = null; 
        
        const btn = document.getElementById('compact-toggle');
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
        
        const btn = document.getElementById('breakdown-toggle');
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
            UI.renderBody(); 
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
            UI.renderBody(); 
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
        const rawInput = document.getElementById('whitelist-input').value;
        State.whitelist = UI.utils.parseList(rawInput);
        Storage.save();
        UI.modals.closeAll();
        UI.renderTable();
    },

    saveCourse() {
        const rawId = document.getElementById('course-id').value;
        const id = UI.utils.sanitizeId(rawId);
        if(!id) return alert("Course ID is required.");
        
        const originalId = document.getElementById('course-form').dataset.originalId;
        const colorVal = document.getElementById('course-color').value;
        const color = colorVal !== UI.config.defaultCourseColor ? colorVal : '';

        if (originalId && originalId !== id) {
            if (State.courses[id]) return alert("A course with this new ID already exists!");
            State.updateCourseId(originalId, id);
        }

        const selectedTags = Array.from(document.querySelectorAll('.course-tag-checkbox:checked')).map(cb => cb.value);

        State.courses[id] = {
            id: id,
            title: document.getElementById('course-title').value.trim(),
            credits: parseInt(document.getElementById('course-credits').value) || 0,
            prereqs: UI.utils.parseList(document.getElementById('course-prereqs').value),
            coreqs: UI.utils.parseList(document.getElementById('course-coreqs').value),
            joint: UI.utils.parseList(document.getElementById('course-joint').value),
            tags: selectedTags,
            desc: document.getElementById('course-desc').value.trim(),
            color: color
        };

        Storage.save();
        UI.modals.closeAll();
        UI.renderTable();
    },

    deleteCourse(courseId) {
        UI.showConfirm("Delete Course", `Delete course ${courseId} completely?`, () => {
            // Clear UI states if the course being deleted is currently active
            if (State.pinnedNode && State.pinnedNode.cId === courseId) this.clearPin();
            if (State.selectedCourseId === courseId) State.selectedCourseId = null;
            
            State.deleteCourse(courseId);
            Storage.save();
            UI.renderTable();
        });
    },

    saveTerm() {
        const name = document.getElementById('term-name').value.trim();
        if (!name) return;
        
        const colorVal = document.getElementById('term-color').value;
        const color = colorVal !== UI.config.defaultTermColor ? colorVal : '';
        const id = document.getElementById('term-name').dataset.id;
        
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
        const idInput = document.getElementById('tag-edit-id').value;
        const name = document.getElementById('tag-edit-name').value.trim();
        const color = document.getElementById('tag-edit-color').value;
        const icon = document.getElementById('tag-edit-icon-val').value || 'ph-circle';

        if (!name) return alert("Tag name is required");

        let constraints = null;
        if (document.getElementById('tag-edit-enable-constraints').checked) {
            const maxVal = document.getElementById('tag-edit-max').value;
            constraints = {
                type: document.getElementById('tag-edit-req-type').value,
                metric: document.getElementById('tag-edit-metric').value,
                min: parseInt(document.getElementById('tag-edit-min').value) || 0,
                max: maxVal ? parseInt(maxVal) : null,
                weight: parseInt(document.getElementById('tag-edit-weight').value) || 5
            };
        }

        let newTagId = null; 
        if (idInput) {
            const tag = State.tags.find(t => t.id === idInput);
            if (tag) { 
                tag.name = name; tag.color = color; tag.icon = icon; tag.constraints = constraints;
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
        UI.renderBody(); 
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

    togglePin(courseId, termId) {
        if (State.pinnedNode && State.pinnedNode.cId === courseId && State.pinnedNode.tId === termId) {
            this.clearPin();
        } else {
            State.pinnedNode = { cId: courseId, tId: termId };
            UI.renderBody(); 
            UI.handleMouseOver(courseId, termId, true);
        }
    },

    clearPin() {
        State.pinnedNode = null;
        UI.renderBody();
        UI.handleMouseOut();
    },

    selectCourse(courseId) {
        if (State.isPreviewMode) return;
        
        // Clear any active pins to prevent visual conflicts when toggling the editor
        if (State.pinnedNode) this.clearPin();
        
        State.selectedCourseId = (State.selectedCourseId === courseId) ? null : courseId;
        UI.renderBody();
    },

    toggleCell(courseId, termId) {
        if (State.isPreviewMode) return;
        if (!State.activeGrid[courseId]) State.activeGrid[courseId] = {};
        if (!State.activeGrid[courseId][termId]?.active) {
            State.activeGrid[courseId][termId] = { active: true, hidden: false };
            Storage.save();
            UI.refreshCell(courseId, termId);
            
            if (State.pinnedNode) UI.handleMouseOver(State.pinnedNode.cId, State.pinnedNode.tId, true);
        }
    },

    removeCard(courseId, termId) {
        if (State.activeGrid[courseId]?.[termId]) {
            // 1. Clear the pin if the specific instance being deleted is the pinned one
            if (State.pinnedNode && State.pinnedNode.cId === courseId && State.pinnedNode.tId === termId) {
                this.clearPin();
            }

            State.activeGrid[courseId][termId].active = false;
            Storage.save();
            UI.refreshCell(courseId, termId);
            
            // 2. Refresh highlights to reflect the change, or clear them if unpinned
            if (State.pinnedNode) {
                UI.handleMouseOver(State.pinnedNode.cId, State.pinnedNode.tId, true);
            } else {
                UI.handleMouseOut();
            }
        }
    },

    toggleHidden(courseId, termId) {
        if (State.activeGrid[courseId]?.[termId]) {
            State.activeGrid[courseId][termId].hidden = !State.activeGrid[courseId][termId].hidden;
            Storage.save();
            UI.refreshCell(courseId, termId);
            
            if (State.pinnedNode) UI.handleMouseOver(State.pinnedNode.cId, State.pinnedNode.tId, true);
        }
    },

    hideDeadEnds(courseId, termId) {
        const { highlights } = HoverEngine.analyze(courseId, termId);
        let hiddenCount = 0;
        
        for (const [key, semantic] of Object.entries(highlights)) {
            if (semantic === 'errorTemp') {
                const [targetCid, targetTid] = key.split('_');
                if (State.activeGrid[targetCid] && State.activeGrid[targetCid][targetTid]) {
                    State.activeGrid[targetCid][targetTid].hidden = true;
                    hiddenCount++;
                }
            }
        }

        if (hiddenCount > 0) {
            Storage.save();
            UI.renderBody();
            UI.handleMouseOver(courseId, termId, true); 
        }
    },

    updateScheduleName(newName) {
        if (State.schedules[State.activeScheduleId]) {
            State.schedules[State.activeScheduleId].name = newName;
            State.schedules[State.activeScheduleId].lastModified = Date.now();
            Storage.save();
            if (document.getElementById('sidebar-active-name')) {
                document.getElementById('sidebar-active-name').innerText = newName;
            }
        }
    },

    snapshotSchedule() {
        const currentSched = State.schedules[State.activeScheduleId];
        if (!currentSched) return;

        const newId = 'sched-' + Date.now();
        const newName = currentSched.name + ' Copy';
        const gridCopy = JSON.parse(JSON.stringify(currentSched.grid));

        State.schedules[newId] = { name: newName, lastModified: Date.now(), grid: gridCopy };
        Storage.save();
        UI.renderSidebarSchedules();
    },

    hoverSchedule(id) {
        if (State.pinnedScheduleId) return; 
        State.hoveredScheduleId = id;
        UI.updateScheduleDisplay(); // Updates the "Previewing..." header
        UI.renderBody();
    },

    unhoverSchedule() {
        if (State.pinnedScheduleId) return;
        State.hoveredScheduleId = null;
        UI.updateScheduleDisplay(); // Updates the "Previewing..." header
        UI.renderBody();
    },

    togglePinSchedule(id) {
        State.pinnedScheduleId = (State.pinnedScheduleId === id) ? null : id;
        State.hoveredScheduleId = null; 
        UI.renderSidebarSchedules();
        UI.renderTable();
    },

    switchSchedule(scheduleId) {
        if (State.schedules[scheduleId]) {
            State.activeScheduleId = scheduleId;
            State.pinnedScheduleId = null;
            State.hoveredScheduleId = null;
            Storage.save();
            UI.renderSidebarSchedules();
            UI.renderTable(); 
        }
    },

    deleteSchedule(scheduleId) {
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

document.addEventListener('DOMContentLoaded', () => App.init());