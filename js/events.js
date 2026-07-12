import { App } from './main.js';
import { UI } from './ui.js';
import { Storage } from './storage.js';
import { ThemeConfig } from './theme.js';
import { State } from './state.js';

export function setupEventListeners() {
    // 1. General Click Delegation
    document.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
        
        e.stopPropagation();

        const action = actionEl.getAttribute('data-action');
        const cId = actionEl.getAttribute('data-cid');
        const tId = actionEl.getAttribute('data-tid');
        const target = actionEl.getAttribute('data-target');
        const value = actionEl.getAttribute('data-value');

        switch(action) {
            case 'toggle-theme': ThemeConfig.toggle(); break;
            case 'toggle-compact': App.toggleCompactMode(); break;
            case 'toggle-breakdown': App.toggleBreakdown(); break;
            case 'show-all-hidden': App.showAllHidden(); break;
            case 'hide-errors': App.hideErrors(); break;
            case 'reset-map': App.resetMap(); break;
            case 'toggle-cell': App.toggleCell(cId, tId); break;
            case 'toggle-pin': App.togglePin(cId, tId); break;
            case 'select-course': App.selectCourse(cId); break;
            case 'hide-dead-ends': App.hideDeadEnds(cId, tId); break;
            case 'toggle-hidden': App.toggleHidden(cId, tId); break;
            case 'remove-card': App.removeCard(cId, tId); break;
            case 'close-modals': UI.modals.closeAll(); break;
            case 'close-confirm': UI.closeConfirm(); break;
            case 'open-term-modal': UI.openTermModal(); break;
            case 'edit-term': UI.editTerm(tId); break;
            case 'delete-term': App.deleteTerm(tId); break;
            case 'save-term': App.saveTerm(); break;
            case 'open-course-modal': UI.openCourseModal(); break;
            case 'edit-course': UI.editCourse(cId); break;
            case 'delete-course': App.deleteCourse(cId); break;
            case 'save-course': App.saveCourse(); break;
            case 'open-tag-manager': UI.openTagManager(); break;
            case 'open-tag-editor': UI.openTagEditor(cId); break;
            case 'close-tag-editor': UI.closeTagEditor(); break;
            case 'save-tag': App.saveTag(); break;
            case 'delete-tag': App.deleteTag(cId); break;
            case 'select-icon': UI.selectIcon(value); break;
            case 'open-whitelist': UI.openWhitelistModal(); break;
            case 'save-whitelist': App.saveWhitelist(); break;
            case 'open-export': UI.openExportModal(); break;
            case 'execute-export': Storage.executeExport(); break;
            case 'toggle-sidebar': UI.toggleGeneratorSidebar(); break;
            case 'snapshot-schedule': App.snapshotSchedule(); break;
            case 'switch-schedule': App.switchSchedule(value); break;
            case 'delete-schedule': App.deleteSchedule(value); break;
            case 'toggle-pin-schedule': App.togglePinSchedule(value); break;
            case 'clear-color': UI.utils.setColoris(target, ''); break;
        }
    });

    // 2. Specific Input Event Listeners
    const termInput = document.getElementById('term-name');
    if (termInput) {
        termInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') App.saveTerm();
        });
    }

    const schedInput = document.getElementById('active-schedule-name');
    if (schedInput) {
        schedInput.addEventListener('input', (e) => App.updateScheduleName(e.target.value));
    }

    const importInput = document.getElementById('importFile');
    if (importInput) {
        importInput.addEventListener('change', (e) => Storage.importData(e));
    }
    
    const exportFormat = document.getElementById('export-format');
    if (exportFormat) {
        exportFormat.addEventListener('change', () => UI.toggleExportOptions());
    }

    const weightInput = document.getElementById('tag-edit-weight');
    if (weightInput) {
        weightInput.addEventListener('input', (e) => {
            document.getElementById('tag-weight-val').innerText = e.target.value;
        });
    }

    const tagColorInput = document.getElementById('tag-edit-color');
    if (tagColorInput) tagColorInput.addEventListener('input', () => UI.renderIconPicker());

    const tagConstraintsToggle = document.getElementById('tag-edit-enable-constraints');
    if (tagConstraintsToggle) tagConstraintsToggle.addEventListener('change', () => UI.toggleTagConstraints());

    const reqTypeSelect = document.getElementById('tag-edit-req-type');
    if (reqTypeSelect) reqTypeSelect.addEventListener('change', () => UI.toggleTagConstraints());

    // 3. Hover Interactions (Delegated)
    document.addEventListener('mouseover', (e) => {
        const scheduleNode = e.target.closest('.schedule-item');
        if (scheduleNode) {
            const sId = scheduleNode.getAttribute('data-sid');
            App.hoverSchedule(sId);
            return;
        }
        
        const card = e.target.closest('.card-node');
        if (card) {
            const cId = card.getAttribute('data-cid');
            const tId = card.getAttribute('data-tid');
            UI.handleMouseOver(cId, tId);
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('.schedule-item')) {
            App.unhoverSchedule();
            return;
        }
        if (e.target.closest('.card-node')) {
            UI.handleMouseOut();
        }
    });

    // 4. Global Keyboard Overrides
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
}