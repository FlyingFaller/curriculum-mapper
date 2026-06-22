import { ThemeConfig } from './theme.js';
import { State } from './state.js';
import { Storage } from './storage.js';
import { HoverEngine } from './hover.js';
import { UI } from './ui.js';

const App = {
    init() {
        ThemeConfig.init();
        if (!Storage.load()) {
            State.initDefault();
            Storage.save();
        }
        UI.initColoris();
        UI.renderTable();
        UI.initResizer();

        // NEW: Global listener to clear pins via Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && UI.pinnedNode) {
                App.clearPin();
            }
        });
    },

    saveTag() {
        const idInput = document.getElementById('tag-edit-id').value;
        const name = document.getElementById('tag-edit-name').value.trim();
        const color = document.getElementById('tag-edit-color').value;
        const icon = document.getElementById('tag-edit-icon-val').value || 'ph-circle';

        if (!name) return alert("Tag name is required");

        let newTagId = null; 

        if (idInput) {
            // Edit existing
            const tag = State.tags.find(t => t.id === idInput);
            if (tag) { 
                tag.name = name; 
                tag.color = color; 
                tag.icon = icon; 
            }
        } else {
            // Create new
            newTagId = 'tag-' + Date.now();
            State.tags.push({ id: newTagId, name, color, icon });
        }

        Storage.save();
        UI.closeTagEditor();
        
        // Refresh whichever UI elements are currently visible
        UI.renderGlobalTags(); 
        
        // Grab currently checked tags so we don't lose them when redrawing the form
        const checkedBoxes = Array.from(document.querySelectorAll('.course-tag-checkbox:checked')).map(cb => cb.value);
        
        if (newTagId) {
            checkedBoxes.push(newTagId);
        }

        UI.renderCourseTagsForm(checkedBoxes); 
        UI.renderTable();
    },

    deleteTag(tagId) {
        UI.showConfirm("Delete Tag", "Are you sure? This will remove the tag from all courses.", () => {
            State.tags = State.tags.filter(t => t.id !== tagId);
            // Scrub from all courses
            Object.values(State.courses).forEach(c => {
                c.tags = (c.tags || []).filter(t => t !== tagId);
            });
            Storage.save();
            UI.renderGlobalTags();
            UI.renderCourseTagsForm();
            UI.renderTable();
        });
    },

    saveWhitelist() {
        const rawInput = document.getElementById('whitelist-input').value;
        State.whitelist = UI.utils.parseList(rawInput);
        Storage.save();
        UI.closeModals();
        UI.renderTable();
    },

    togglePin(event, courseId, termId) {
        event.stopPropagation(); 

        // If clicking the currently pinned card, unpin it
        if (UI.pinnedNode && UI.pinnedNode.cId === courseId && UI.pinnedNode.tId === termId) {
            this.clearPin();
        } else {
            // Pin the new card
            UI.pinnedNode = { cId: courseId, tId: termId };
            UI.renderTable(); // Re-render to apply the CSS selection ring
            
            // Because re-rendering destroys the old DOM nodes, we must manually 
            // force the hover engine to reapply the CSS background highlights
            UI.handleMouseOver(courseId, termId, true);
        }
    },

    clearPin() {
        UI.pinnedNode = null;
        UI.renderTable();
        UI.handleMouseOut();
    },

    selectCourse(courseId) {
        UI.selectedCourseId = (UI.selectedCourseId === courseId) ? null : courseId;
        UI.renderTable();
    },

    toggleCompactMode() {
        UI.compactMode = !UI.compactMode;
        if (!UI.compactMode) UI.selectedCourseId = null; 
        
        const btn = document.getElementById('compact-toggle');
        const icon = btn.querySelector('i');
        
        if (UI.compactMode) {
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
        UI.showBreakdown = !UI.showBreakdown;
        
        const btn = document.getElementById('breakdown-toggle');
        if (UI.showBreakdown) {
            btn.classList.add('text-accent');
            btn.classList.remove('text-text-muted');
        } else {
            btn.classList.remove('text-accent');
            btn.classList.add('text-text-muted');
        }
        
        UI.renderTable();
    },
    
    saveTerm() {
        const name = document.getElementById('term-name').value.trim();
        if (!name) return;
        
        const colorVal = document.getElementById('term-color').value;
        const color = colorVal !== '#ffffff' ? colorVal : '';
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
        UI.closeModals();
        UI.renderTable();
    },

    deleteTerm(termId) {
        UI.showConfirm("Delete Term", "Delete this term and all course assignments in it?", () => {
            State.terms = State.terms.filter(t => t.id !== termId);
            Object.keys(State.schedule).forEach(cId => {
                if (State.schedule[cId][termId]) delete State.schedule[cId][termId];
            });
            Storage.save();
            UI.renderTable();
        });
    },

    saveCourse() {
        const rawId = document.getElementById('course-id').value;
        const id = UI.utils.sanitizeId(rawId);
        if(!id) return alert("Course ID is required.");
        
        const originalId = document.getElementById('course-form').dataset.originalId;
        
        const colorVal = document.getElementById('course-color').value;
        const color = colorVal !== '#ffffff' ? colorVal : '';

        if (originalId && originalId !== id) {
            if (State.courses[id]) return alert("A course with this new ID already exists!");
            
            State.courses[id] = State.courses[originalId];
            State.courses[id].id = id;
            delete State.courses[originalId];
            
            if (State.schedule[originalId]) {
                State.schedule[id] = State.schedule[originalId];
                delete State.schedule[originalId];
            }
            
            Object.values(State.courses).forEach(c => {
                c.prereqs = c.prereqs.map(req => req === originalId ? id : req);
                c.coreqs = c.coreqs.map(req => req === originalId ? id : req);
                c.joint = c.joint.map(req => req === originalId ? id : req);
            });
        }

        const selectedTags = Array.from(document.querySelectorAll('.course-tag-checkbox:checked')).map(cb => cb.value);

        State.courses[id] = {
            id: id,
            title: document.getElementById('course-title').value.trim(),
            credits: parseInt(document.getElementById('course-credits').value) || 0,
            prereqs: UI.utils.parseList(document.getElementById('course-prereqs').value),
            coreqs: UI.utils.parseList(document.getElementById('course-coreqs').value),
            joint: UI.utils.parseList(document.getElementById('course-joint').value),
            tags: selectedTags, // NEW: Save the tags array here!
            desc: document.getElementById('course-desc').value.trim(),
            color: color
        };

        Storage.save();
        UI.closeModals();
        UI.renderTable();
    },

    deleteCourse(courseId) {
        UI.showConfirm("Delete Course", `Delete course ${courseId} completely?`, () => {
            delete State.courses[courseId];
            delete State.schedule[courseId];
            Object.values(State.courses).forEach(c => {
                c.prereqs = c.prereqs.filter(req => req !== courseId);
                c.coreqs = c.coreqs.filter(req => req !== courseId);
                c.joint = c.joint.filter(req => req !== courseId);
            });
            Storage.save();
            UI.renderTable();
        });
    },

    toggleCell(courseId, termId) {
        if (!State.schedule[courseId]) State.schedule[courseId] = {};
        if (!State.schedule[courseId][termId]?.active) {
            State.schedule[courseId][termId] = { active: true, hidden: false };
            Storage.save();
            UI.renderTable();
        }
    },

    removeCard(event, courseId, termId) {
        event.stopPropagation(); 
        if (State.schedule[courseId]?.[termId]) {
            State.schedule[courseId][termId].active = false;
            Storage.save();
            UI.renderTable();
            UI.handleMouseOut();
        }
    },

    toggleHidden(event, courseId, termId) {
        event.stopPropagation();
        if (State.schedule[courseId]?.[termId]) {
            State.schedule[courseId][termId].hidden = !State.schedule[courseId][termId].hidden;
            Storage.save();
            UI.renderTable();
        }
    },

    hideDeadEnds(event, courseId, termId) {
        event.stopPropagation();
        const { highlights } = HoverEngine.analyze(courseId, termId);
        
        let hiddenCount = 0;
        
        // Find all keys that were marked as dead ends (hl-err-temp)
        for (const [key, highlightClass] of Object.entries(highlights)) {
            if (highlightClass === 'hl-err-temp') {
                const [targetCid, targetTid] = key.split('_');
                if (State.schedule[targetCid] && State.schedule[targetCid][targetTid]) {
                    State.schedule[targetCid][targetTid].hidden = true;
                    hiddenCount++;
                }
            }
        }

        if (hiddenCount > 0) {
            Storage.save();
            UI.renderTable();
            UI.handleMouseOver(courseId, termId, true); // UPDATED: Added true flag
        }
    },

    showAllHidden() {
        UI.showConfirm("Unhide All", "Are you sure you want to make all hidden course cards visible?", () => {
            Object.values(State.schedule).forEach(termMap => {
                Object.values(termMap).forEach(cell => {
                    if (cell.active) cell.hidden = false;
                });
            });
            Storage.save();
            UI.renderTable();
        });
    },

    hideErrors() {
        UI.showConfirm("Hide Errors", "This will automatically hide scheduled instances that have missing or incorrectly timed prerequisites. Proceed?", () => {
            let changed = true;
            let passLimit = 100; 
            let passes = 0;
            
            while (changed && passes < passLimit) {
                changed = false;
                passes++;
                let toHide = [];

                const allCourses = Object.keys(State.schedule);
                for (const cId of allCourses) {
                    for (const tId in State.schedule[cId]) {
                        let cell = State.schedule[cId][tId];
                        if (cell.active && !cell.hidden) {
                            let { status } = HoverEngine.analyze(cId, tId);
                            if (status.hasTempError || status.hasMissError) {
                                toHide.push({ cId, tId });
                            }
                        }
                    }
                }

                if (toHide.length > 0) {
                    toHide.forEach(({ cId, tId }) => {
                        State.schedule[cId][tId].hidden = true;
                    });
                    changed = true; 
                }
            }
            Storage.save();
            UI.renderTable();
        });
    },

    resetMap() {
        UI.showConfirm("Reset Map", "Are you sure you want to completely reset the schedule builder?", () => {
            localStorage.removeItem('curriculumMap');
            State.initDefault();
            Storage.save();
            UI.renderTable();
        });
    }
};

// Mount to global window object so inline HTML 'onclick' handlers still work
window.ThemeConfig = ThemeConfig;
window.State = State;
window.Storage = Storage;
window.HoverEngine = HoverEngine;
window.UI = UI;
window.App = App;

// Boot the application
document.addEventListener('DOMContentLoaded', () => App.init());