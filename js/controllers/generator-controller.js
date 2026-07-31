/**
 * Orchestrates the optimization pipeline. Gathers configuration parameters, executes 
 * the WASM solver, handles error states, and passes results to the UI.
 */

import { State } from '../state.js';
import { parseCurriculumState } from '../solver/preparser.js';
import { generateOptimalSchedule } from '../solver/solver.js';
import { processGeneratedSchedules } from '../solver/postprocessing.js';
import { UIModals } from '../ui/ui-modals.js';
import { UIRenderer } from '../ui/ui-renderer.js';

export const GeneratorController = {
    async generateSchedule(bypass = false) {
        const execute = async () => {
            const config = UIRenderer.getGeneratorConfig();
          
            UIRenderer.setGeneratorLoading(true);
            UIRenderer.setGeneratorSummary('Initializing solver...');
            const startTime = performance.now();
            
            try {
                const parsedData = parseCurriculumState(State);
                const result = await generateOptimalSchedule(parsedData, config);
                const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
                
                if (result.schedules && result.schedules.length > 0) {
                    const processedData = processGeneratedSchedules(result.schedules, parsedData);
                    State.generatedSchedules = {};
                    const baseGrid = State.activeGrid;
                    
                    processedData.namedSchedules.forEach((item, optionIdx) => {
                        const schedule = item.schedule;
                        const genId = 'gen-sched-' + Date.now() + '-' + optionIdx;
                        const uiGrid = JSON.parse(JSON.stringify(baseGrid));
                        
                        Object.keys(uiGrid).forEach(cId => {
                            Object.keys(uiGrid[cId]).forEach(tId => uiGrid[cId][tId] = false);
                        });
                        
                        Object.entries(schedule).forEach(([tIdx, cIds]) => {
                            const termId = parsedData.termIds[parseInt(tIdx)];
                            cIds.forEach(cId => {
                                if (!uiGrid[cId]) uiGrid[cId] = {};
                                uiGrid[cId][termId] = true;
                            });
                        });
                        
                        State.generatedSchedules[genId] = {
                            name: item.name,
                            grid: uiGrid,
                            totalCredits: item.totalCredits,
                            maxTermLoad: item.maxTermLoad,
                            sortedTermLoadsDesc: item.sortedTermLoadsDesc,
                            sortedTermLoadsAsc: item.sortedTermLoadsAsc
                        };
                    });
                    
                    UIRenderer.setGeneratorSummary(`Found ${result.schedules.length} schedule(s) with score ${result.score} in ${elapsed}s`);
                    UIRenderer.renderGeneratedSchedules();
                } else {
                    State.generatedSchedules = {};
                    const statusCode = result.status || 'UNKNOWN';
                    UIRenderer.setGeneratorSummary(`No schedules found (${statusCode}) in ${elapsed}s`, true);
                    UIRenderer.renderGeneratedSchedules();
                    UIRenderer.injectGeneratorError(statusCode, false);
                }
            } catch (error) {
                console.error("Solver Error:", error);
                State.generatedSchedules = {};
                UIRenderer.setGeneratorSummary('Solver encountered a fatal error.', true);
                UIRenderer.renderGeneratedSchedules();
                UIRenderer.injectGeneratorError(null, true, error.message);
            } finally {
                UIRenderer.setGeneratorLoading(false);
            }
        };

        const hasExistingResults = Object.keys(State.generatedSchedules || {}).length > 0;
        if (hasExistingResults && !bypass) {
            UIModals.showConfirm("Overwrite Results", "Generating new schedules will discard your current optimal results. Proceed?", execute);
        } else {
            execute();
        }
    },

    clearGenerated(bypass = false) {
        const execute = () => {
            State.generatedSchedules = {};
            if (State.pinnedScheduleId && String(State.pinnedScheduleId).startsWith('gen-')) State.pinnedScheduleId = null;
            if (State.hoveredScheduleId && String(State.hoveredScheduleId).startsWith('gen-')) State.hoveredScheduleId = null;
            
            UIRenderer.setGeneratorSummary('');
            UIRenderer.renderGeneratedSchedules();
            UIRenderer.renderTable();
        };
        if (bypass) execute();
        else UIModals.showConfirm("Clear Results", "Are you sure you want to discard all generated schedules?", execute);
    },

    applyGeneratorFilters() {
        UIRenderer.renderGeneratedSchedules();
    }
};