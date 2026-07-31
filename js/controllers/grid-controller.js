/**
 * Handles user interactions with the curriculum board, such as toggling course cells,
 * pinning hover states, and triggering visibility filters.
 */

import { State }       from '../state.js';
import { Storage }     from '../storage.js';
import { HoverEngine } from '../hover-engine.js';
import { UIModals }    from '../ui/ui-modals.js';
import { UIRenderer }  from '../ui/ui-renderer.js';

export const GridController = {
    toggleCompactMode() {
        State.compactMode = !State.compactMode;
        if (!State.compactMode) State.selectedCourseId = null;
        UIRenderer.toggleCompactModeStyles();
        UIRenderer.renderTable();
    },

    toggleBreakdown() {
        State.showBreakdown = !State.showBreakdown;
        UIRenderer.toggleBreakdownStyles();
        UIRenderer.renderTable();
    },

    showAllHidden(bypass = false) {
        if (State.isPreviewMode) return;
        const execute = () => {
            Object.values(State.activeGrid).forEach(termMap => {
                Object.keys(termMap).forEach(tId => termMap[tId] = true);
            });
            Storage.save();
            UIRenderer.renderTable();
        };
        if (bypass) execute();
        else UIModals.showConfirm("Unhide All", "Are you sure you want to make all hidden course cards visible?", execute);
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
            UIRenderer.renderTable();
        };
        if (bypass) execute();
        else UIModals.showConfirm("Hide Errors", "This will automatically hide scheduled instances that have missing or incorrectly timed prerequisites. Proceed?", execute);
    },

    resetMap(bypass = false) {
        if (State.isPreviewMode) return;
        const execute = () => {
            localStorage.removeItem('curriculumMap');
            State.initDefault();
            Storage.save();
            UIRenderer.renderTable();
            UIRenderer.renderSidebarSchedules();
        };
        if (bypass) execute();
        else UIModals.showConfirm("Reset Map", "Are you sure you want to completely reset the schedule builder?", execute);
    },

    togglePin(courseId, termId) {
        if (State.pinnedNode && State.pinnedNode.cId === courseId && State.pinnedNode.tId === termId) {
            this.clearPin();
        } else {
            State.pinnedNode = { cId: courseId, tId: termId };
            UIRenderer.renderBody();
            UIRenderer.handleMouseOver(courseId, termId, true);
        }
    },

    clearPin() {
        State.pinnedNode = null;
        UIRenderer.renderBody();
        UIRenderer.handleMouseOut();
    },

    selectCourse(courseId) {
        if (State.isPreviewMode) return;
        if (State.pinnedNode) this.clearPin();
        State.selectedCourseId = (State.selectedCourseId === courseId) ? null : courseId;
        UIRenderer.renderBody();
    },

    toggleCell(courseId, termId) {
        if (State.isPreviewMode) return;
        if (!State.activeGrid[courseId]) State.activeGrid[courseId] = {};
        if (State.activeGrid[courseId][termId] === undefined) {
            State.activeGrid[courseId][termId] = true;
            Storage.save();
            UIRenderer.refreshCell(courseId, termId);
            if (State.pinnedNode) UIRenderer.handleMouseOver(State.pinnedNode.cId, State.pinnedNode.tId, true);
        }
    },

    removeCard(courseId, termId) {
        if (State.activeGrid[courseId]?.[termId] !== undefined) {
            if (State.pinnedNode && State.pinnedNode.cId === courseId && State.pinnedNode.tId === termId) {
                this.clearPin();
            }
            delete State.activeGrid[courseId][termId];
            Storage.save();
            UIRenderer.refreshCell(courseId, termId);
            if (State.pinnedNode) UIRenderer.handleMouseOver(State.pinnedNode.cId, State.pinnedNode.tId, true);
            else UIRenderer.handleMouseOut();
        }
    },

    toggleHidden(courseId, termId) {
        if (State.activeGrid[courseId]?.[termId] !== undefined) {
            State.activeGrid[courseId][termId] = !State.activeGrid[courseId][termId];
            Storage.save();
            UIRenderer.refreshCell(courseId, termId);
            if (State.pinnedNode) UIRenderer.handleMouseOver(State.pinnedNode.cId, State.pinnedNode.tId, true);
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
            UIRenderer.renderTable();
            UIRenderer.handleMouseOver(courseId, termId, true);
        }
    }
};