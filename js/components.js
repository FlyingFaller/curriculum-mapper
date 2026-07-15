import { State } from './state.js';
import { UI } from './ui.js';

export const Components = {
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
        
        let untaggedBreakdown = { id: 'untagged', name: 'Untagged', color: 'var(--text-muted)', icon: 'ph-minus', bankTotal: 0, termTotals: {} };

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
                const iconHTML = tb.id === 'untagged' ? `<i class="ph ${tb.icon} text-caption" style="color: ${tb.color}"></i>` : `<i class="ph-fill ${tb.icon} text-caption drop-shadow-sm" style="color: ${tb.color}"></i>`;
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
                <div class="card-action-menu">
                    <button data-action="edit-term" data-tid="${term.id}" class="btn-icon"><i class="ph ph-pencil-simple text-base leading-none"></i></button>
                    <button data-action="delete-term" data-tid="${term.id}" class="btn-icon-danger"><i class="ph ph-trash text-base leading-none"></i></button>
                </div>`;
            }
            
            let styleStr = term.color ? `background-color: ${term.color}; color: ${UI.utils.getContrastColor(term.color)};` : `background-color: var(--bg-surface);`;
            
            html += `<th style="${styleStr}" class="cell-size px-3 py-2 font-bold border-r border-border group text-left border-b align-top">
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
        html += `<td style="background-color: var(--bg-surface-mid);" class="cell-size course-bank-cell sticky-col align-top border-r border-b border-border">
            <div class="course-bank-container flex flex-col gap-2">`;
        sortedCourses.forEach(course => { html += this.generateCourseCardHTML(course, null, false, true); });
        html += `</div></td>`;
        
        State.terms.forEach(term => {
            html += `<td class="cell-size p-2 align-top border-r border-b border-border bg-surface relative z-0">
                <div class="flex flex-col gap-2 w-full" data-column-tid="${term.id}">`;
            let visibleHTML = '', hiddenHTML = '';
            sortedCourses.forEach(course => {
                if (course.id === State.selectedCourseId) return; 
                const isVisible = State.displayedGrid[course.id]?.[term.id];
                if (isVisible !== undefined) {
                    if (!isVisible) hiddenHTML += this.generateCourseCardHTML(course, term, true, false);
                    else visibleHTML += this.generateCourseCardHTML(course, term, false, false);
                }
            });
            html += visibleHTML + hiddenHTML;
            html += `</div></td>`;
        });
        html += `</tr>`;

        if (!State.isPreviewMode && State.selectedCourseId && State.courses[State.selectedCourseId]) {
            const activeCourse = State.courses[State.selectedCourseId];
            let activeCourseStyle = activeCourse.color ? `background-color: ${activeCourse.color}; color: ${UI.utils.getContrastColor(activeCourse.color)};` : ``;
            
            html += `<tr class="sticky-bottom-row">
                <td class="cell-size sticky-col align-top border-r border-border p-2">
                    <div style="${activeCourseStyle}" class="course-card compact-mode-card selected-card flex flex-col justify-between group/card relative overflow-hidden m-0" data-action="select-course" data-cid="${activeCourse.id}">
                        <div class="flex flex-col w-full">
                            <span class="font-bold text-heading leading-tight truncate pr-8" title="${activeCourse.id}">${activeCourse.id}</span>
                            <div class="text-base opacity-90 truncate leading-tight mt-0.5" title="${activeCourse.title}">${activeCourse.title}</div>
                        </div>
                        <div class="card-action-menu">
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
                    html += this.generateCourseCardHTML(activeCourse, term, !isVisible, false);
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
            let cStyleStr = course.color ? `background-color: ${course.color}; color: ${UI.utils.getContrastColor(course.color)};` : `background-color: var(--bg-surface-mid);`;

            let courseActionMenu = '';
            if (!State.isPreviewMode) {
                courseActionMenu = `
                <div class="card-action-menu">
                    <button data-action="edit-course" data-cid="${course.id}" class="btn-icon"><i class="ph ph-pencil-simple text-base leading-none"></i></button>
                    <button data-action="delete-course" data-cid="${course.id}" class="btn-icon-danger"><i class="ph ph-trash text-base leading-none"></i></button>
                </div>`;
            }

            html += `
                <td style="${cStyleStr}" class="cell-size course-cell-height sticky-col px-3 py-2 align-top group border-b border-border">
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
                if (isVisible !== undefined) html += this.generateCourseCardHTML(course, term, !isVisible, false);
                html += `</td>`;
            });
            html += `</tr>`;
        });
        return html;
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
        
        return `<div class="card-action-menu">${buttons}</div>`;
    },

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
        
        let cStyleStr = (isBankCard && course.color) ? `background-color: ${course.color}; color: ${UI.utils.getContrastColor(course.color)};` : ``;
        let actionHook = isBankCard ? 'select-course' : 'toggle-pin';
        let tidVal = term ? term.id : 'bank';

        return `
            <div style="${cStyleStr}" class="course-card ${compactClass} ${hiddenClass} ${selectedClass} card-node flex flex-col justify-between group/card relative overflow-hidden" 
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

    buildGlobalTagsHTML() {
        return State.tags.map(tag => {
            const iconClass = tag.icon || 'ph-circle';
            return `
            <div class="flex justify-between items-center bg-canvas border border-border rounded p-2">
                <div class="flex items-center gap-2">
                    <i class="ph-fill ${iconClass} text-lg drop-shadow-sm" style="color: ${tag.color}"></i>
                    <span class="text-sm font-medium">${tag.name}</span>
                </div>
                <div class="flex gap-1">
                    <button data-action="open-tag-editor" data-cid="${tag.id}" class="btn-icon"><i class="ph ph-pencil-simple text-base"></i></button>
                    <button data-action="delete-tag" data-cid="${tag.id}" class="btn-icon-danger"><i class="ph ph-trash text-base"></i></button>
                </div>
            </div>`;
        }).join('');
    },

    buildCourseTagsFormHTML(selectedTagIds = []) {
        if (State.tags.length === 0) return `<span class="text-caption text-text-muted italic">No tags available. Create one!</span>`;
        return State.tags.map(tag => {
            const isChecked = selectedTagIds.includes(tag.id) ? 'checked' : '';
            const iconClass = tag.icon || 'ph-circle';
            return `
            <label class="flex items-center gap-1.5 px-2 py-1 bg-surface border border-border rounded cursor-pointer hover:bg-surface-hover">
                <input type="checkbox" value="${tag.id}" class="course-tag-checkbox accent-accent" ${isChecked}>
                <i class="ph-fill ${iconClass} text-sm drop-shadow-sm" style="color: ${tag.color}"></i>
                <span class="text-caption font-medium">${tag.name}</span>
            </label>`;
        }).join('');
    },

    buildIconPickerHTML(selectedIcon, currentColor) {
        const icons = [
            'ph-circle', 'ph-star', 'ph-book-open', 'ph-certificate', 'ph-globe', 'ph-shapes', 'ph-compass', 'ph-palette', 
            'ph-flask', 'ph-math-operations', 'ph-translate', 'ph-code', 'ph-bookmark-simple', 'ph-push-pin', 'ph-warning', 'ph-check-circle',
            'ph-lock', 'ph-lock-simple-open', 'ph-shopping-cart', 'ph-arrow-clockwise', 'ph-asterisk', 'ph-book', 'ph-brackets-angle', 'ph-calculator',
            'ph-calendar-blank', 'ph-check-circle', 'ph-diamond', 'ph-flower', 'ph-gear', 'ph-globe-hemisphere-west', 'ph-hamburger', 'ph-hand', 'ph-hands-praying',
            'ph-heart', 'ph-hexagon', 'ph-key', 'ph-music-notes', 'ph-octagon', 'ph-parallelogram', 'ph-paragraph', 'ph-password', 'ph-pi', 'ph-placeholder',
            'ph-plant', 'ph-question', 'ph-seal', 'ph-shield', 'ph-skull', 'ph-smiley', 'ph-smiley-angry', 'ph-smiley-meh', 'ph-smiley-melting', 'ph-smiley-nervous',
            'ph-smiley-sad', 'ph-smiley-x-eyes', 'ph-sparkle', 'ph-star-four', 'ph-tag', 'ph-tag-chevron', 'ph-tag-simple', 'ph-triangle', 'ph-trophy', 'ph-x'
        ];
        return icons.map(icon => {
            const isSelected = icon === selectedIcon;
            const activeClass = isSelected ? 'border-accent bg-accent-bg' : 'border-transparent text-text-muted hover:bg-surface-hover';
            const styleStr = isSelected ? `style="color: ${currentColor};"` : '';
            return `<button type="button" data-action="select-icon" data-value="${icon}" class="flex justify-center items-center p-1 border rounded cursor-pointer transition-colors ${activeClass}">
                <i class="ph-fill ${icon} text-lg drop-shadow-sm" ${styleStr}></i>
            </button>`;
        }).join('');
    }
};