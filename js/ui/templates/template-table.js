/**
 * Pure functions that consume state data and return parameterized HTML strings 
 * for the main schedule grid and term headers.
 */

import { State } from '../../state.js';
import { Utils } from '../../utils.js';
import { TemplateCard } from './template-card.js';

export const TemplateTable = {
    calculateBreakdowns() {
        if (!State.showBreakdown) return [];
        let tagsMap = new Map();
        State.tags.forEach(t => {
            tagsMap.set(t.id, {
                id: t.id, name: t.name, color: t.color,
                icon: t.icon ? t.icon.replace('-fill', '') : 'ph-circle',
                bankTotal: 0, termTotals: {}
            });
        });
                 
        let untaggedBreakdown = { id: 'untagged', name: 'Untagged', colorClass: 'text-text-muted', icon: 'ph-minus', bankTotal: 0, termTotals: {} };
        State.terms.forEach(term => {
            tagsMap.forEach(tb => tb.termTotals[term.id] = 0);
            untaggedBreakdown.termTotals[term.id] = 0;
        });
        const assignments = State.termAssignments;
        Object.values(State.courses).forEach(course => {
            const credits = course.credits || 0;
            const hasTags = course.tags && course.tags.length > 0;
            if (!hasTags) untaggedBreakdown.bankTotal += credits;
            else course.tags.forEach(tId => {
                const tagObj = tagsMap.get(tId);
                if (tagObj) tagObj.bankTotal += credits;
            });
        });
        State.terms.forEach(term => {
            const activeCourseIds = assignments[term.id] || [];
            activeCourseIds.forEach(cId => {
                const course = State.courses[cId];
                if (!course) return;
                const credits = course.credits || 0;
                const hasTags = course.tags && course.tags.length > 0;
                if (!hasTags) untaggedBreakdown.termTotals[term.id] += credits;
                else course.tags.forEach(tId => {
                    const tagObj = tagsMap.get(tId);
                    if (tagObj) tagObj.termTotals[term.id] += credits;
                });
            });
        });
        return [...Array.from(tagsMap.values()), untaggedBreakdown];
    },

    buildHeaders() {
        const breakdowns = this.calculateBreakdowns();
        let totalBankCredits = Object.values(State.courses).reduce((sum, c) => sum + (c.credits || 0), 0);
                 
        let bankBreakdownHTML = '';
        if (State.showBreakdown) {
            bankBreakdownHTML = `<div class="flex flex-col gap-1 w-full">`;
            breakdowns.forEach(tb => {
                const iconHTML = tb.id === 'untagged' 
                    ? `<i class="ph ${tb.icon} text-caption ${tb.colorClass}"></i>` 
                    : `<i class="ph-fill ${tb.icon} text-caption drop-shadow-sm" style="color: ${tb.color}"></i>`;
                bankBreakdownHTML += `
                    <div class="flex justify-start items-center gap-2 text-caption h-5 font-normal opacity-80">
                        <span class="flex items-center gap-1.5 truncate text-text-main">${iconHTML} ${tb.name}</span>
                        <span class="shrink-0">${tb.bankTotal} cr</span>
                    </div>`;
            });
            bankBreakdownHTML += `</div>`;
        }

        let html = `<tr class="bg-surface">
        <th class="cell-size sticky-col px-3 py-2 z-30 border-b border-border bg-surface-alt align-top">
            <div class="font-bold text-heading" title="${State.compactMode ? 'Course Bank' : 'Courses'}">${State.compactMode ? 'Course Bank' : 'Courses'}</div>
            <div class="text-caption font-normal opacity-80 mt-0.5">${totalBankCredits} hours</div>
            ${bankBreakdownHTML}
        </th>`;
                 
        State.terms.forEach(term => {
            const activeCourseIds = State.termAssignments[term.id] || [];
            let termCredits = activeCourseIds.reduce((sum, cId) => sum + (State.courses[cId]?.credits || 0), 0);
            let termBreakdownHTML = '';
            if (State.showBreakdown) {
                termBreakdownHTML = `<div class="flex flex-col gap-1 w-full">`;
                breakdowns.forEach(tb => {
                    const displayTotal = tb.termTotals[term.id] > 0 ? `${tb.termTotals[term.id]} cr` : `<span class="opacity-40">0 cr</span>`;
                    termBreakdownHTML += `<div class="flex justify-start items-center text-caption h-5 font-normal opacity-80">${displayTotal}</div>`;
                });
                termBreakdownHTML += `</div>`;
            }
            let termActionMenu = '';
            if (!State.isPreviewMode) {
                termActionMenu = `
                <div class="card-action-menu top-0.5 right-0.5">
                    <button data-action="edit-term" data-tid="${term.id}" class="btn-icon"><i class="ph ph-pencil-simple text-base leading-none"></i></button>
                    <button data-action="delete-term" data-tid="${term.id}" class="btn-icon-danger"><i class="ph ph-trash text-base leading-none"></i></button>
                </div>`;
            }
                         
            let styleStr = term.color ? `style="background-color: ${term.color}; color: ${Utils.getContrastColor(term.color)};"` : ``;
            let bgClass = term.color ? '' : 'bg-surface';
                         
            html += `<th ${styleStr} class="cell-size px-3 py-2 font-bold border-r border-border group text-left border-b align-top ${bgClass}">
                <div class="truncate w-full pr-8 text-heading" title="${term.name}">${term.name}</div>
                <div class="text-caption font-normal opacity-80 mt-0.5">${termCredits} hours</div>
                ${termActionMenu}
                ${termBreakdownHTML}
            </th>`;
        });
        html += `</tr>`;
        return html;
    },

    buildCompactBody(sortedCourses) {
        let html = `<tr class="compact-main-row">`;
        html += `<td class="cell-size course-bank-cell sticky-col align-top border-r border-b border-border bg-surface-mid">
            <div class="course-bank-container flex flex-col gap-2">`;
        sortedCourses.forEach(course => { html += TemplateCard.generateCourseCardHTML(course, null, false, true); });
        html += `</div></td>`;
                 
        State.terms.forEach(term => {
            html += `<td class="cell-size p-2 align-top border-r border-b border-border bg-surface relative z-0">
                <div class="flex flex-col gap-2 w-full" data-column-tid="${term.id}">`;
            let visibleHTML = '', hiddenHTML = '';
            sortedCourses.forEach(course => {
                if (course.id === State.selectedCourseId) return;
                const isVisible = State.displayedGrid[course.id]?.[term.id];
                if (isVisible !== undefined) {
                    if (!isVisible) hiddenHTML += TemplateCard.generateCourseCardHTML(course, term, true, false);
                    else visibleHTML += TemplateCard.generateCourseCardHTML(course, term, false, false);
                }
            });
            html += visibleHTML + hiddenHTML;
            html += `</div></td>`;
        });
        html += `</tr>`;

        if (!State.isPreviewMode && State.selectedCourseId && State.courses[State.selectedCourseId]) {
            const activeCourse = State.courses[State.selectedCourseId];
            let activeCourseStyle = activeCourse.color ? `style="background-color: ${activeCourse.color}; color: ${Utils.getContrastColor(activeCourse.color)};"` : ``;
                         
            html += `<tr class="sticky-bottom-row">
                <td class="cell-size sticky-col align-top border-r border-border p-2">
                    <div ${activeCourseStyle} class="course-card compact-mode-card selected-card flex flex-col justify-between group/card relative overflow-hidden m-0" data-action="select-course" data-cid="${activeCourse.id}">
                        <div class="flex flex-col w-full">
                            <span class="font-bold text-heading leading-tight truncate pr-8" title="${activeCourse.id}">${activeCourse.id}</span>
                            <div class="text-base opacity-90 truncate leading-tight mt-0.5" title="${activeCourse.title}">${activeCourse.title}</div>
                        </div>
                        <div class="card-action-menu top-0.5 right-0.5">
                            <button class="btn-icon-danger" data-action="select-course" data-cid="${activeCourse.id}" title="Close Editor">
                                <i class="ph ph-x text-base leading-none"></i>
                            </button>
                        </div>
                    </div>
                </td>`;
                         
            State.terms.forEach(term => {
                const isVisible = State.displayedGrid[activeCourse.id]?.[term.id];
                html += `<td class="cell-size align-top border-r border-border p-2">`;
                if (isVisible !== undefined) {
                    html += TemplateCard.generateCourseCardHTML(activeCourse, term, !isVisible, false);
                } else {
                    html += `
                        <div class="edit-target-zone" data-action="toggle-cell" data-cid="${activeCourse.id}" data-tid="${term.id}">
                            <i class="ph ph-plus text-2xl mb-0.5"></i>
                            <span class="text-micro font-bold uppercase tracking-wider">Add Here</span>
                        </div>
                    `;
                }
                html += `</td>`;
            });
            html += `</tr>`;
        }
        return html;
    },

    buildStandardBody(sortedCourses) {
        let html = '';
        sortedCourses.forEach(course => {
            html += `<tr class="hover:bg-surface-hover transition-colors" data-course-row="${course.id}">`;
            let cStyleStr = course.color ? `style="background-color: ${course.color}; color: ${Utils.getContrastColor(course.color)};"` : ``;
            let bgClass = course.color ? '' : 'bg-surface-mid';

            let courseActionMenu = '';
            if (!State.isPreviewMode) {
                courseActionMenu = `
                <div class="card-action-menu top-0.5 right-0.5">
                    <button data-action="edit-course" data-cid="${course.id}" class="btn-icon"><i class="ph ph-pencil-simple text-base leading-none"></i></button>
                    <button data-action="delete-course" data-cid="${course.id}" class="btn-icon-danger"><i class="ph ph-trash text-base leading-none"></i></button>
                </div>`;
            }

            html += `
                <td ${cStyleStr} class="cell-size course-cell-height sticky-col px-3 py-2 align-top group border-b border-border ${bgClass}">
                    <div class="flex justify-between items-start relative">
                        <span class="font-bold text-heading leading-tight truncate pr-8" title="${course.id}">${course.id} <span class="font-normal text-meta opacity-80">(${course.credits})</span></span>
                        ${courseActionMenu}
                    </div>
                    <div class="text-base opacity-90 truncate leading-tight mt-0.5" title="${course.title}">${course.title}</div>
                </td>`;
            
            State.terms.forEach(term => {
                const isVisible = State.displayedGrid[course.id]?.[term.id];
                html += `<td class="cell-size course-cell-height p-0 align-top border-r border-b border-border bg-surface relative z-0" 
                              data-action="toggle-cell" data-cid="${course.id}" data-tid="${term.id}" 
                              data-cell-cid="${course.id}" data-cell-tid="${term.id}">`;
                if (isVisible !== undefined) html += TemplateCard.generateCourseCardHTML(course, term, !isVisible, false);
                html += `</td>`;
            });
            html += `</tr>`;
        });
        return html;
    }
};