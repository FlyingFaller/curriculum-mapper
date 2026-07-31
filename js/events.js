/**
 * Global event delegation handler.
 * Captures DOM interactions and routes them to the appropriate controller methods
 * based on 'data-action' HTML attributes.
 */

import { ThemeConfig }         from './theme.js';
import { State }               from './state.js';
import { Storage }             from './storage.js';
import { UIRenderer }          from './ui/ui-renderer.js';
import { UIModals }            from './ui/ui-modals.js';
import { GridController }      from './controllers/grid-controller.js';
import { EntityController }    from './controllers/entity-controller.js';
import { ScheduleController }  from './controllers/schedule-controller.js';
import { GeneratorController } from './controllers/generator-controller.js';
import { Utils }               from './utils.js';

export function setupEventListeners() {
    document.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
                 
        e.stopPropagation();
        const action = actionEl.getAttribute('data-action');
        const cId = actionEl.getAttribute('data-cid');
        const tId = actionEl.getAttribute('data-tid');
        const target = actionEl.getAttribute('data-target');
        const value = actionEl.getAttribute('data-value');
        const bypass = e.shiftKey || e.ctrlKey;

        switch(action) {
            case 'toggle-theme'            : ThemeConfig.toggle(); break;
            case 'toggle-compact'          : GridController.toggleCompactMode(); break;
            case 'toggle-breakdown'        : GridController.toggleBreakdown(); break;
            case 'show-all-hidden'         : GridController.showAllHidden(bypass); break;
            case 'hide-errors'             : GridController.hideErrors(bypass); break;
            case 'reset-map'               : GridController.resetMap(bypass); break;
            case 'toggle-cell'             : GridController.toggleCell(cId, tId); break;
            case 'toggle-pin'              : GridController.togglePin(cId, tId); break;
            case 'select-course'           : GridController.selectCourse(cId); break;
            case 'hide-dead-ends'          : GridController.hideDeadEnds(cId, tId); break;
            case 'toggle-hidden'           : GridController.toggleHidden(cId, tId); break;
            case 'remove-card'             : GridController.removeCard(cId, tId); break;
              
            case 'close-modals'            : UIModals.closeAll(); break;
            case 'close-confirm'           : UIModals.closeConfirm(); break;
              
            case 'open-term-modal'         : UIModals.openTermModal(); break;
            case 'edit-term'               : UIModals.editTerm(tId); break;
            case 'delete-term'             : EntityController.deleteTerm(tId, bypass); break;
            case 'save-term'               : EntityController.saveTerm(); break;
              
            case 'open-course-modal'       : UIModals.openCourseModal(); break;
            case 'edit-course'             : UIModals.editCourse(cId); break;
            case 'delete-course'           : EntityController.deleteCourse(cId, bypass); break;
            case 'save-course'             : EntityController.saveCourse(); break;
              
            case 'open-tag-manager'        : UIModals.openTagManager(); break;
            case 'open-tag-editor'         : UIModals.openTagEditor(cId); break;
            case 'close-tag-editor'        : UIModals.closeTagEditor(); break;
            case 'save-tag'                : EntityController.saveTag(); break;
            case 'delete-tag'              : EntityController.deleteTag(cId, bypass); break;
            case 'select-icon'             : UIModals.selectIcon(value); break;
              
            case 'open-whitelist'          : UIModals.openWhitelistModal(); break;
            case 'save-whitelist'          : EntityController.saveWhitelist(); break;
              
            case 'open-export'             : UIModals.openExportModal(); break;
            case 'execute-export'          : Storage.executeExport(); break;
            case 'toggle-export-options'   : UIModals.toggleExportOptions(); break;
              
            case 'toggle-sidebar'          : UIRenderer.toggleGeneratorSidebar(); break;
            case 'snapshot-schedule'       : ScheduleController.snapshotSchedule(); break;
            case 'switch-schedule'         : ScheduleController.switchSchedule(value); break;
            case 'delete-schedule'         : ScheduleController.deleteSchedule(value, bypass); break;
            case 'delete-active-schedule'  : ScheduleController.deleteActiveSchedule(bypass); break;
            case 'toggle-pin-schedule'     : ScheduleController.togglePinSchedule(value); break;
              
            case 'clear-color'             : Utils.setColoris(document.querySelector(target), ''); break;
              
            case 'generate-schedule'       : GeneratorController.generateSchedule(bypass); break;
            case 'clear-generated'         : GeneratorController.clearGenerated(bypass); break;
            case 'toggle-generator-filters': UIRenderer.toggleGeneratorFilters(); break;
            case 'apply-generator-filters' : GeneratorController.applyGeneratorFilters(); break;
            case 'toggle-tag-constraints'  : UIModals.toggleTagConstraints(); break;
        }
    });

    if (UIModals.elements.termName) {
        UIModals.elements.termName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') EntityController.saveTerm();
        });
    }

    if (UIRenderer.elements.activeScheduleName) {
        UIRenderer.elements.activeScheduleName.addEventListener('input', (e) => ScheduleController.updateScheduleName(e.target.value));
        UIRenderer.elements.activeScheduleName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });
    }

    const importInput = document.getElementById('importFile');
    if (importInput) importInput.addEventListener('change', (e) => Storage.importData(e));

    if (UIModals.elements.tagEditWeight) {
        UIModals.elements.tagEditWeight.addEventListener('input', (e) => UIModals.updateTagWeightDisplay(e.target.value));
    }
    if (UIModals.elements.tagEditColor) {
        UIModals.elements.tagEditColor.addEventListener('input', () => UIModals.renderIconPicker());
    }

    document.addEventListener('mouseover', (e) => {
        const scheduleNode = e.target.closest('.schedule-item');
        if (scheduleNode) return ScheduleController.hoverSchedule(scheduleNode.getAttribute('data-sid'));
                 
        const card = e.target.closest('.card-node');
        if (card) UIRenderer.handleMouseOver(card.getAttribute('data-cid'), card.getAttribute('data-tid'));
    });

    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('.schedule-item')) return ScheduleController.unhoverSchedule();
        if (e.target.closest('.card-node')) UIRenderer.handleMouseOut();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!UIModals.elements.confirmModal.classList.contains('hidden')) return UIModals.closeConfirm();
            if (!UIModals.elements.tagEditorModal.classList.contains('hidden')) return UIModals.closeTagEditor();
            
            const openBaseModal = [
                UIModals.elements.termModal, UIModals.elements.courseModal, 
                UIModals.elements.whitelistModal, UIModals.elements.tagManagerModal, 
                UIModals.elements.exportModal
            ].find(el => !el.classList.contains('hidden'));
                         
            if (openBaseModal) return openBaseModal.classList.add('hidden');
                         
            if (!UIRenderer.elements.generatorSidebar.classList.contains('-translate-x-full')) return UIRenderer.toggleGeneratorSidebar();
            
            if (State.pinnedNode) return GridController.clearPin();
            if (State.pinnedScheduleId) {
                State.pinnedScheduleId = null;
                UIRenderer.renderSidebarSchedules();
                return UIRenderer.renderTable();
            }
        }
    });
}