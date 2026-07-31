/**
 * Pure functions that consume state data and return parameterized HTML strings 
 * for individual course cards, dependency tags, and action menus.
 */

import { State } from '../../state.js';
import { Utils } from '../../utils.js';

export const TemplateCard = {
    generateCourseCardHTML(course, term, isHidden, isBankCard = false) {
        let instanceCount = 0;
        if (State.displayedGrid[course.id]) {
            instanceCount = Object.keys(State.displayedGrid[course.id]).length;
        }
        const isSingleton = instanceCount === 1;
        const singletonStyles = isSingleton ? 'text-accent' : '';
        const hiddenClass = isHidden ? 'hidden-instance' : '';
        const compactClass = State.compactMode ? 'compact-mode-card shrink-0' : '';
        const isPinned = State.pinnedNode && State.pinnedNode.cId === course.id && State.pinnedNode.tId === (term ? term.id : 'bank');
        const selectedClass = (isBankCard && course.id === State.selectedCourseId) || isPinned ? 'selected-card' : '';
                 
        let cStyleStr = (isBankCard && course.color) ? `style="background-color: ${course.color}; color: ${Utils.getContrastColor(course.color)};"` : ``;
        let actionHook = isBankCard ? 'select-course' : 'toggle-pin';
        let tidVal = term ? term.id : 'bank';

        return `
            <div ${cStyleStr} class="course-card ${compactClass} ${hiddenClass} ${selectedClass} card-node flex flex-col justify-between group/card relative overflow-hidden" 
                 data-cid="${course.id}" data-tid="${tidVal}" data-action="${actionHook}">
                 <div class="flex flex-col w-full">
                    <span class="font-bold text-heading leading-tight truncate pr-8 ${singletonStyles}" title="${course.id}">${course.id} <span class="font-normal text-meta not-italic opacity-80">(${course.credits})</span></span>
                    <div class="text-base truncate leading-tight mt-0.5" title="${course.title}">${course.title}</div>
                 </div>
                 ${course.joint && course.joint.length ? `<div class="text-meta mt-auto font-medium opacity-80 truncate leading-tight pb-0.5 italic" title="Joint: ${course.joint.join(', ')}">Joint: ${course.joint.join(', ')}</div>` : `<div class="mt-auto"></div>`}
                 ${this._buildCardTagDots(course.tags)}
                 ${this._buildCardActionMenu(course, term, isBankCard, isHidden)}
            </div>`;
    },
    
    _buildCardTagDots(tags) {
        if (!tags || tags.length === 0) return '';
        let html = `<div class="card-tag-dots">`;
        tags.forEach(tId => {
            const tag = State.tags.find(t => t.id === tId);
            if (tag) {
                const iconClass = tag.icon || 'ph-circle';
                html += `<i class="ph-fill ${iconClass} text-sm drop-shadow-sm" style="color: ${tag.color}" title="${tag.name}"></i>`;
            }
        });
        html += `</div>`;
        return html;
    },

    _buildCardActionMenu(course, term, isBankCard, isHidden) {
        if (State.isPreviewMode) return '';
        const eyeIcon = isHidden ? 'ph-eye-slash' : 'ph-eye';
        let buttons = '';
                 
        if (isBankCard) {
            buttons = `
                <button class="btn-icon" data-action="edit-course" data-cid="${course.id}" title="Edit Course"><i class="ph ph-pencil-simple text-base leading-none"></i></button>
                <button class="btn-icon-danger" data-action="delete-course" data-cid="${course.id}" title="Delete Course"><i class="ph ph-trash text-base leading-none"></i></button>`;
        } else {
            buttons = `
                <button class="btn-icon-danger" data-action="hide-dead-ends" data-cid="${course.id}" data-tid="${term.id}" title="Hide Dead Ends for this sequence"><i class="ph ph-magic-wand text-base leading-none"></i></button>
                <button class="btn-icon" data-action="toggle-hidden" data-cid="${course.id}" data-tid="${term.id}" title="Toggle active status"><i class="ph ${eyeIcon} text-base leading-none"></i></button>
                <button class="btn-icon-danger" data-action="remove-card" data-cid="${course.id}" data-tid="${term.id}" title="Remove from term"><i class="ph ph-x text-base leading-none"></i></button>`;
        }
                 
        return `<div class="card-action-menu top-0.5 right-0.5">${buttons}</div>`;
    }
};