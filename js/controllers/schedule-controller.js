/**
 * Manages the lifecycle of user schedules, including creating, switching, duplicating,
 * and deleting schedule instances.
 */

import { State } from '../state.js';
import { Storage } from '../storage.js';
import { UIModals } from '../ui/ui-modals.js';
import { UIRenderer } from '../ui/ui-renderer.js';

export const ScheduleController = {
    updateScheduleName(newName) {
        if (State.schedules[State.activeScheduleId]) {
            State.schedules[State.activeScheduleId].name = newName;
            State.schedules[State.activeScheduleId].lastModified = Date.now();
            Storage.save();
            UIRenderer.updateScheduleDisplay();
        }
    },

    snapshotSchedule() {
        const currentSched = State.schedules[State.activeScheduleId];
        if (!currentSched) return;
        
        const newId = 'sched-' + Date.now();
        const newName = currentSched.name + ' Copy';
        const gridCopy = JSON.parse(JSON.stringify(currentSched.grid));
        
        State.schedules[newId] = { name: newName, lastModified: Date.now(), grid: gridCopy };
        State.activeScheduleId = newId;
        State.pinnedScheduleId = null;
        State.hoveredScheduleId = null;
        
        Storage.save();
        UIRenderer.renderSidebarSchedules();
        UIRenderer.renderTable();
        
        if (UIRenderer.elements.activeScheduleName) {
            UIRenderer.elements.activeScheduleName.focus();
            UIRenderer.elements.activeScheduleName.select();
        }
    },

    hoverSchedule(id) {
        if (State.pinnedScheduleId) return;
        State.hoveredScheduleId = id;
        UIRenderer.renderTable();
    },

    unhoverSchedule() {
        if (State.pinnedScheduleId) return;
        State.hoveredScheduleId = null;
        UIRenderer.renderTable();
    },

    togglePinSchedule(id) {
        State.pinnedScheduleId = (State.pinnedScheduleId === id) ? null : id;
        State.hoveredScheduleId = null;
        UIRenderer.updateSidebarHighlights();
        UIRenderer.renderTable();
    },

    switchSchedule(scheduleId) {
        const targetSched = State.getSchedule(scheduleId);
        if (!targetSched) return;
        
        if (State.schedules[scheduleId]) {
            State.activeScheduleId = scheduleId;
        } else {
            const newId = 'sched-' + Date.now();
            State.schedules[newId] = {
                name: targetSched.name,
                lastModified: Date.now(),
                grid: JSON.parse(JSON.stringify(targetSched.grid))
            };
        }
        
        State.pinnedScheduleId = null;
        State.hoveredScheduleId = null;
        Storage.save();
        UIRenderer.renderSidebarSchedules();
        UIRenderer.renderGeneratedSchedules();
        UIRenderer.renderTable();
    },

    deleteActiveSchedule(bypass = false) {
        this.deleteSchedule(State.activeScheduleId, bypass);
    },

    deleteSchedule(scheduleId, bypass = false) {
        if (State.generatedSchedules && State.generatedSchedules[scheduleId]) {
            delete State.generatedSchedules[scheduleId];
            if (State.pinnedScheduleId === scheduleId) State.pinnedScheduleId = null;
            if (State.hoveredScheduleId === scheduleId) State.hoveredScheduleId = null;
            UIRenderer.renderGeneratedSchedules();
            UIRenderer.updateScheduleDisplay();
            UIRenderer.renderTable();
            return;
        }
        
        const execute = () => {
            const schedIds = Object.keys(State.schedules);
            if (schedIds.length <= 1) return;
            
            if (State.activeScheduleId === scheduleId) {
                const remainingIds = schedIds.filter(id => id !== scheduleId);
                remainingIds.sort((a, b) => State.schedules[b].lastModified - State.schedules[a].lastModified);
                State.activeScheduleId = remainingIds[0];
            }
            
            delete State.schedules[scheduleId];
            if (State.pinnedScheduleId === scheduleId) State.pinnedScheduleId = null;
            if (State.hoveredScheduleId === scheduleId) State.hoveredScheduleId = null;
            
            Storage.save();
            UIRenderer.renderSidebarSchedules();
            UIRenderer.renderTable();
        };
        
        if (bypass) execute();
        else UIModals.showConfirm("Delete Schedule", "Are you sure you want to permanently delete this schedule?", execute);
    }
};