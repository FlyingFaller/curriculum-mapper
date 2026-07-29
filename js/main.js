import { ThemeConfig } from './theme.js';
import { State } from './state.js';
import { Storage } from './storage.js';
import { HoverEngine } from './hover.js';
import { UI } from './ui.js';
import { setupEventListeners } from './events.js';
import { parseCurriculumState } from './parser.js';
import { generateOptimalSchedule } from './solver.js';
import { processGeneratedSchedules } from './postprocessing.js';

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

    showAllHidden(bypass = false) {
        if (State.isPreviewMode) return;
        const execute = () => {
            Object.values(State.activeGrid).forEach(termMap => {
                Object.keys(termMap).forEach(tId => termMap[tId] = true);
            });
            Storage.save();
            UI.renderTable();
        };
        if (bypass) execute();
        else UI.showConfirm("Unhide All", "Are you sure you want to make all hidden course cards visible?", execute);
    },

    hideErrors(bypass = false) {
        if (State.isPreviewMode) return;
        const execute = () => {
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
                        let isVisible = State.activeGrid[cId][tId];
                        if (isVisible === true) {
                            let { status } = HoverEngine.analyze(cId, tId);
                            if (status.hasTempError || status.hasMissError) toHide.push({ cId, tId });
                        }
                    }
                }

                if (toHide.length > 0) {
                    toHide.forEach(({ cId, tId }) => State.activeGrid[cId][tId] = false);
                    changed = true; 
                }
            }
            Storage.save();
            UI.renderTable();
        };
        if (bypass) execute();
        else UI.showConfirm("Hide Errors", "This will automatically hide scheduled instances that have missing or incorrectly timed prerequisites. Proceed?", execute);
    },

    resetMap(bypass = false) {
        if (State.isPreviewMode) return;
        const execute = () => {
            localStorage.removeItem('curriculumMap');
            State.initDefault();
            Storage.save();
            UI.renderTable();
            UI.renderSidebarSchedules(); 
        };
        if (bypass) execute();
        else UI.showConfirm("Reset Map", "Are you sure you want to completely reset the schedule builder?", execute);
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

    deleteCourse(courseId, bypass = false) {
        const execute = () => {
            // Clear UI states if the course being deleted is currently active
            if (State.pinnedNode && State.pinnedNode.cId === courseId) this.clearPin();
            if (State.selectedCourseId === courseId) State.selectedCourseId = null;
            
            State.deleteCourse(courseId);
            Storage.save();
            UI.renderTable();
        };

        if (bypass) execute();
        else UI.showConfirm("Delete Course", `Delete course ${courseId} completely?`, execute);
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

    deleteTerm(termId, bypass = false) {
        const execute = () => {
            State.terms = State.terms.filter(t => t.id !== termId);
            Object.values(State.schedules).forEach(sched => {
                Object.keys(sched.grid).forEach(cId => {
                    if (sched.grid[cId][termId]) delete sched.grid[cId][termId];
                });
            });
            Storage.save();
            UI.renderTable();
        };
        if (bypass) execute();
        else UI.showConfirm("Delete Term", "Delete this term and all course assignments in it?", execute);
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

    deleteTag(tagId, bypass = false) {
        const execute = () => {
            State.tags = State.tags.filter(t => t.id !== tagId);
            Object.values(State.courses).forEach(c => c.tags = (c.tags || []).filter(t => t !== tagId));
            Storage.save();
            UI.renderGlobalTags();
            UI.renderCourseTagsForm();
            UI.renderTable();
        };

        if (bypass) execute();
        else UI.showConfirm("Delete Tag", "Are you sure? This will remove the tag from all courses.", execute);
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
        if (State.activeGrid[courseId][termId] === undefined) {
            State.activeGrid[courseId][termId] = true;
            Storage.save();
            UI.refreshCell(courseId, termId);
            
            if (State.pinnedNode) UI.handleMouseOver(State.pinnedNode.cId, State.pinnedNode.tId, true);
        }
    },

    removeCard(courseId, termId) {
        if (State.activeGrid[courseId]?.[termId] !== undefined) {
            if (State.pinnedNode && State.pinnedNode.cId === courseId && State.pinnedNode.tId === termId) {
                this.clearPin();
            }

            delete State.activeGrid[courseId][termId];
            Storage.save();
            UI.refreshCell(courseId, termId);
            
            if (State.pinnedNode) {
                UI.handleMouseOver(State.pinnedNode.cId, State.pinnedNode.tId, true);
            } else {
                UI.handleMouseOut();
            }
        }
    },

    toggleHidden(courseId, termId) {
        if (State.activeGrid[courseId]?.[termId] !== undefined) {
            State.activeGrid[courseId][termId] = !State.activeGrid[courseId][termId];
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
                if (State.activeGrid[targetCid] && State.activeGrid[targetCid][targetTid] !== undefined) {
                    State.activeGrid[targetCid][targetTid] = false;
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

        // Set duplicate schedule to active immediately
        State.activeScheduleId = newId;
        State.pinnedScheduleId = null;
        State.hoveredScheduleId = null;

        Storage.save();

        UI.renderSidebarSchedules();
        UI.renderTable();

        const nameInput = document.getElementById('active-schedule-name');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    },

    hoverSchedule(id) {
        if (State.pinnedScheduleId) return; 
        State.hoveredScheduleId = id;
        UI.updateScheduleDisplay(); // Updates the "Previewing..." header
        UI.renderHeaders();
        UI.renderBody();
    },

    unhoverSchedule() {
        if (State.pinnedScheduleId) return;
        State.hoveredScheduleId = null;
        UI.updateScheduleDisplay(); // Updates the "Previewing..." header
        UI.renderHeaders();
        UI.renderBody();
    },

    togglePinSchedule(id) {
        State.pinnedScheduleId = (State.pinnedScheduleId === id) ? null : id;
        State.hoveredScheduleId = null; 
        
        // Use targeted DOM class swapping instead of full HTML re-renders
        if (UI.updateSidebarHighlights) UI.updateSidebarHighlights();
        
        UI.renderTable(); 
    },

    switchSchedule(scheduleId) {
        const targetSched = State.getSchedule(scheduleId);
        if (!targetSched) return;

        if (State.schedules[scheduleId]) {
            State.activeScheduleId = scheduleId;
        } else {
            // Adopt generated schedule as a persistent saved schedule
            const newId = 'sched-' + Date.now();
            State.schedules[newId] = {
                name: targetSched.name,
                lastModified: Date.now(),
                grid: JSON.parse(JSON.stringify(targetSched.grid))
            };
            State.activeScheduleId = newId;
        }
        
        State.pinnedScheduleId = null;
        State.hoveredScheduleId = null;
        Storage.save();
        UI.renderSidebarSchedules();
        if (UI.renderGeneratedSchedules) UI.renderGeneratedSchedules();
        UI.renderTable(); 
    },

    deleteActiveSchedule(bypass = false) {
        this.deleteSchedule(State.activeScheduleId, bypass);
    },

    deleteSchedule(scheduleId, bypass = false) {
        if (State.generatedSchedules && State.generatedSchedules[scheduleId]) {
            delete State.generatedSchedules[scheduleId];
            if (State.pinnedScheduleId === scheduleId) State.pinnedScheduleId = null;
            if (State.hoveredScheduleId === scheduleId) State.hoveredScheduleId = null;
            if (UI.renderGeneratedSchedules) UI.renderGeneratedSchedules();
            UI.updateScheduleDisplay();
            UI.renderTable();
            return;
        }

        const execute = () => {
            const schedIds = Object.keys(State.schedules);
            
            // Prevent deleting the very last schedule
            if (schedIds.length <= 1) return; 

            // Fallback logic if the active schedule is the one being deleted
            if (State.activeScheduleId === scheduleId) {
                const remainingIds = schedIds.filter(id => id !== scheduleId);
                // Sort by lastModified descending (newest first)
                remainingIds.sort((a, b) => State.schedules[b].lastModified - State.schedules[a].lastModified);
                State.activeScheduleId = remainingIds[0];
            }

            delete State.schedules[scheduleId];
            if (State.pinnedScheduleId === scheduleId) State.pinnedScheduleId = null;
            if (State.hoveredScheduleId === scheduleId) State.hoveredScheduleId = null;
            
            Storage.save();
            UI.renderSidebarSchedules();
            UI.updateScheduleDisplay(); // Ensure the active display updates
            UI.renderTable();
        };

        if (bypass) execute();
        else UI.showConfirm("Delete Schedule", "Are you sure you want to permanently delete this schedule?", execute);
    },

    async generateSchedule() {
        console.log("Parsing active state and booting WASM Solver...");
        const minCredits = parseInt(document.getElementById('gen-min-credits').value) || 7;
        const maxCredits = parseInt(document.getElementById('gen-max-credits').value) || 15;
        const maxTerms = parseInt(document.getElementById('gen-max-terms').value) || 6;
        const maxResults = parseInt(document.getElementById('gen-max-results').value) || Infinity;
        const maxTime = parseInt(document.getElementById('gen-max-time').value) || Infinity;
        
        UI.setGeneratorLoading(true);
        UI.setGeneratorSummary('Initializing solver...');
        const startTime = performance.now();

        try {
            const parsedData = parseCurriculumState(State);
            const config = { minCredits, maxCredits, maxTerms, maxOptions: maxResults, maxTime };
            const result = await generateOptimalSchedule(parsedData, config);
            
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

            if (result.schedules && result.schedules.length > 0) {
                const processedData = processGeneratedSchedules(result.schedules, parsedData);
                let outputText = `\nFound ${result.schedules.length} Optimal Schedule(s) Tied for 1st Place (Score: ${result.score}) \n`;
                outputText += "=".repeat(70) + "\n";
                
                State.generatedSchedules = {};

                // Iterate over the sorted and named results
                processedData.namedSchedules.forEach((item, optionIdx) => {
                    outputText += `\n--- [Family ${item.familyId}] ${item.name} ---\n`;
                    const schedule = item.schedule;
                    let totalDegreeCredits = 0;
                    const sortedTermIndices = Object.keys(schedule).map(Number).sort((a, b) => a - b);
                    
                    sortedTermIndices.forEach(tIdx => {
                        const tId = parsedData.termIds[tIdx];
                        const termName = parsedData.termNames[tId];
                        const termCourses = schedule[tIdx];
                        
                        let termCredits = 0;
                        let courseListString = "";
                        termCourses.forEach(c => {
                            const cCredits = parsedData.courseCredits[c];
                            termCredits += cCredits;
                            courseListString += `    [${cCredits} cr] ${c}\n`;
                        });
                        totalDegreeCredits += termCredits;
                        outputText += `  ${termName} (Term ${tIdx + 1}) - ${termCredits} credits:\n${courseListString}`;
                    });
                    outputText += "-".repeat(25) + "\n";
                    outputText += `  Total Degree Credits: ${totalDegreeCredits}\n`;

                    // Push Formatted UI Grids to App State
                    const genId = 'gen-sched-' + Date.now() + '-' + optionIdx;
                    const uiGrid = {};
                    
                    Object.entries(schedule).forEach(([tIdx, cIds]) => {
                        const termId = parsedData.termIds[parseInt(tIdx)];
                        cIds.forEach(cId => {
                            if (!uiGrid[cId]) uiGrid[cId] = {};
                            uiGrid[cId][termId] = true;
                        });
                    });

                    State.generatedSchedules[genId] = {
                        name: item.name,
                        grid: uiGrid
                    };
                });
                
                console.log(outputText);
                
                UI.setGeneratorSummary(`Found ${result.schedules.length} schedule(s) with score ${result.score} in ${elapsed}s`);
                if (UI.renderGeneratedSchedules) UI.renderGeneratedSchedules();
                
            } else {
                State.generatedSchedules = {};
                const statusCode = result.status || 'UNKNOWN';
                console.log(`INFEASIBLE \n\nThe solver could not fit the degree requirements into ${config.maxTerms} terms. Status code: ${statusCode}`);
                
                UI.setGeneratorSummary(`No schedules found (${statusCode}) in ${elapsed}s`, true);
                if (UI.renderGeneratedSchedules) UI.renderGeneratedSchedules(); // Clears old cards
                
                // Inject Error Notice
                if (UI.elements.generatorResultsList) {
                    UI.elements.generatorResultsList.innerHTML = `
                        <div class="text-caption text-danger-main p-3 text-center border border-dashed border-danger-border bg-danger-bg rounded mt-1">
                            <strong>Status: ${statusCode}</strong><br>The solver could not fit the degree requirements into ${config.maxTerms} terms with the current constraints.
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error("Solver Error:", error);
            State.generatedSchedules = {};
            UI.setGeneratorSummary('Solver encountered a fatal error.', true);
            if (UI.renderGeneratedSchedules) UI.renderGeneratedSchedules(); 
            
            // Inject Fatal Error Notice
            if (UI.elements.generatorResultsList) {
                UI.elements.generatorResultsList.innerHTML = `
                    <div class="text-caption text-danger-main p-3 text-center border border-dashed border-danger-border bg-danger-bg rounded mt-1 break-words">
                        <strong>Error:</strong><br>${error.message || 'Check the console for details.'}
                    </div>
                `;
            }
        } finally {
            UI.setGeneratorLoading(false);
        }
    },

    clearGenerated() {
        State.generatedSchedules = {};
        
        // Discard visual previews if they were pointing to a generated result
        if (State.pinnedScheduleId && String(State.pinnedScheduleId).startsWith('gen-')) State.pinnedScheduleId = null;
        if (State.hoveredScheduleId && String(State.hoveredScheduleId).startsWith('gen-')) State.hoveredScheduleId = null;
        
        UI.setGeneratorSummary('');
        if (UI.renderGeneratedSchedules) UI.renderGeneratedSchedules();
        
        UI.updateScheduleDisplay();
        UI.renderTable();
    },
};

document.addEventListener('DOMContentLoaded', () => App.init());