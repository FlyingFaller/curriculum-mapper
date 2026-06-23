import { State } from './state.js';
import { UI } from './ui.js';

export const Components = {
    // ==========================================
    // DATA CALCULATION
    // ==========================================
    calculateBreakdowns() {
        if (!UI.showBreakdown) return [];
        let tagsBreakdown = State.tags.map(t => ({
            id: t.id, name: t.name, color: t.color,
            icon: t.icon ? t.icon.replace('-fill', '') : 'ph-circle',
            bankTotal: 0, termTotals: {}
        }));
        let untaggedBreakdown = { id: 'untagged', name: 'Untagged', color: 'var(--text-muted)', icon: 'ph-minus', bankTotal: 0, termTotals: {} };

        State.terms.forEach(term => {
            tagsBreakdown.forEach(tb => tb.termTotals[term.id] = 0);
            untaggedBreakdown.termTotals[term.id] = 0;
        });

        Object.values(State.courses).forEach(course => {
            const credits = course.credits || 0;
            const hasTags = course.tags && course.tags.length > 0;
            
            if (!hasTags) untaggedBreakdown.bankTotal += credits;
            else course.tags.forEach(tId => {
                const tagObj = tagsBreakdown.find(t => t.id === tId);
                if (tagObj) tagObj.bankTotal += credits;
            });

            State.terms.forEach(term => {
                const cell = State.schedule[course.id]?.[term.id];
                if (cell && cell.active && !cell.hidden) {
                    if (!hasTags) untaggedBreakdown.termTotals[term.id] += credits;
                    else course.tags.forEach(tId => {
                        const tagObj = tagsBreakdown.find(t => t.id === tId);
                        if (tagObj) tagObj.termTotals[term.id] += credits;
                    });
                }
            });
        });
        return [...tagsBreakdown, untaggedBreakdown];
    },

    // ==========================================
    // GRID HTML GENERATORS
    // ==========================================
    buildHeaders() {
        const breakdowns = this.calculateBreakdowns();
        let totalBankCredits = Object.values(State.courses).reduce((sum, c) => sum + (c.credits || 0), 0);
        
        let bankBreakdownHTML = '';
        if (UI.showBreakdown) {
            bankBreakdownHTML = `<div class="flex flex-col gap-1 w-full">`;
            breakdowns.forEach(tb => {
                const iconHTML = tb.id === 'untagged' ? `<i class="ph ${tb.icon} text-xs" style="color: ${tb.color}"></i>` : `<i class="ph-fill ${tb.icon} text-xs drop-shadow-sm" style="color: ${tb.color}"></i>`;
                bankBreakdownHTML += `
                    <div class="flex justify-start items-center gap-2 text-xs h-5 font-normal opacity-80">
                        <span class="flex items-center gap-1.5 truncate text-text-main">${iconHTML} ${tb.name}</span>
                        <span class="shrink-0">${tb.bankTotal} cr</span>
                    </div>`;
            });
            bankBreakdownHTML += `</div>`;
        }

        let html = `<tr class="bg-surface">
        <th class="cell-size sticky-col px-3 py-2 z-30 border-b border-border bg-surface-alt align-top">
            <div class="font-bold text-header" title="${UI.compactMode ? 'Course Bank' : 'Courses'}">${UI.compactMode ? 'Course Bank' : 'Courses'}</div>
            <div class="text-xs font-normal opacity-80 mt-0.5">${totalBankCredits} hours</div>
            ${bankBreakdownHTML}
        </th>`;
        
        State.terms.forEach(term => {
            let termCredits = Object.keys(State.schedule).reduce((sum, cId) => {
                const cell = State.schedule[cId]?.[term.id];
                return (cell && cell.active && !cell.hidden) ? sum + (State.courses[cId]?.credits || 0) : sum;
            }, 0);

            let termBreakdownHTML = '';
            if (UI.showBreakdown) {
                termBreakdownHTML = `<div class="flex flex-col gap-1 w-full">`;
                breakdowns.forEach(tb => {
                    const displayTotal = tb.termTotals[term.id] > 0 ? `${tb.termTotals[term.id]} cr` : `<span class="opacity-40">0 cr</span>`;
                    termBreakdownHTML += `<div class="flex justify-start items-center text-xs h-5 font-normal opacity-80">${displayTotal}</div>`;
                });
                termBreakdownHTML += `</div>`;
            }

            let styleStr = term.color ? `background-color: ${term.color}; color: ${UI.utils.getContrastColor(term.color)};` : `background-color: var(--bg-surface);`;
            
            html += `<th style="${styleStr}" class="cell-size px-3 py-2 font-bold border-r border-border group text-left border-b align-top">
                <div class="truncate w-full pr-8 text-header" title="${term.name}">${term.name}</div>
                <div class="text-xs font-normal opacity-80 mt-0.5">${termCredits} hours</div>
                <div class="card-action-menu">
                    <button onclick="UI.editTerm('${term.id}')" class="btn-icon"><i class="ph ph-pencil-simple text-icon leading-none"></i></button>
                    <button onclick="App.deleteTerm('${term.id}')" class="btn-icon-danger"><i class="ph ph-trash text-icon leading-none"></i></button>
                </div>
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
            html += `<td class="cell-size p-2 align-top border-r border-b border-border bg-surface">
                <div class="flex flex-col gap-2 w-full">`;
            let visibleHTML = '', hiddenHTML = '';
            sortedCourses.forEach(course => {
                if (course.id === UI.selectedCourseId) return; 
                const cellData = State.schedule[course.id]?.[term.id];
                if (cellData?.active) {
                    if (cellData.hidden) hiddenHTML += this.generateCourseCardHTML(course, term, true, false);
                    else visibleHTML += this.generateCourseCardHTML(course, term, false, false);
                }
            });
            html += visibleHTML + hiddenHTML;
            html += `</div></td>`;
        });
        html += `</tr>`;

        if (UI.selectedCourseId && State.courses[UI.selectedCourseId]) {
            const activeCourse = State.courses[UI.selectedCourseId];
            let activeCourseStyle = activeCourse.color ? `background-color: ${activeCourse.color}; color: ${UI.utils.getContrastColor(activeCourse.color)};` : ``;
            
            html += `<tr class="sticky-bottom-row">
                <td class="cell-size sticky-col align-top border-r border-border p-2">
                    <div style="${activeCourseStyle}" class="course-card compact-mode-card selected-card flex flex-col justify-between group/card relative overflow-hidden m-0" onclick="App.selectCourse(null)">
                        <div class="flex flex-col w-full">
                            <span class="font-bold text-course-id leading-tight truncate pr-8" title="${activeCourse.id}">${activeCourse.id}</span>
                            <div class="text-course-title opacity-90 truncate leading-tight mt-0.5" title="${activeCourse.title}">${activeCourse.title}</div>
                        </div>
                        <div class="card-action-menu">
                            <button class="btn-icon-danger" onclick="event.stopPropagation(); App.selectCourse(null)" title="Close Editor">
                                <i class="ph ph-x text-icon leading-none"></i>
                            </button>
                        </div>
                    </div>
                </td>`;
            
            State.terms.forEach(term => {
                const cellData = State.schedule[activeCourse.id]?.[term.id];
                html += `<td class="cell-size align-top border-r border-border p-2">`;
                if (cellData?.active) {
                    html += this.generateCourseCardHTML(activeCourse, term, cellData.hidden, false);
                } else {
                    html += `
                        <div class="edit-target-zone" onclick="App.toggleCell('${activeCourse.id}', '${term.id}')">
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

            html += `
                <td style="${cStyleStr}" class="cell-size course-cell-height sticky-col px-3 py-2 align-top group border-b border-border">
                    <div class="flex justify-between items-start relative">
                        <span class="font-bold text-course-id leading-tight truncate pr-8" title="${course.id}">${course.id} <span class="font-normal text-course-credits opacity-80">(${course.credits})</span></span>
                        <div class="card-action-menu">
                            <button onclick="UI.editCourse('${course.id}')" class="btn-icon"><i class="ph ph-pencil-simple text-icon leading-none"></i></button>
                            <button onclick="App.deleteCourse('${course.id}')" class="btn-icon-danger"><i class="ph ph-trash text-icon leading-none"></i></button>
                        </div>
                    </div>
                    <div class="text-course-title opacity-90 truncate leading-tight mt-0.5" title="${course.title}">${course.title}</div>
                </td>`;

            State.terms.forEach(term => {
                const cellData = State.schedule[course.id]?.[term.id];
                html += `<td class="cell-size course-cell-height p-0 align-top border-r border-b border-border bg-surface relative" onclick="App.toggleCell('${course.id}', '${term.id}')">`;
                if (cellData?.active) html += this.generateCourseCardHTML(course, term, cellData.hidden, false);
                html += `</td>`;
            });
            html += `</tr>`;
        });
        return html;
    },

    generateCourseCardHTML(course, term, isHidden, isBankCard = false) {
        const hiddenClass = isHidden ? 'hidden-instance' : '';
        const eyeIcon = isHidden ? 'ph-eye-slash' : 'ph-eye';
        const compactClass = UI.compactMode ? 'compact-mode-card shrink-0' : '';
        const isPinned = UI.pinnedNode && UI.pinnedNode.cId === course.id && UI.pinnedNode.tId === (term ? term.id : 'bank');
        const selectedClass = (isBankCard && course.id === UI.selectedCourseId) || isPinned ? 'selected-card' : '';
        
        let cStyleStr = (isBankCard && course.color) ? `background-color: ${course.color}; color: ${UI.utils.getContrastColor(course.color)};` : ``;
        let onClickHandler = isBankCard ? `onclick="App.selectCourse('${course.id}')"` : `onclick="App.togglePin(event, '${course.id}', '${term ? term.id : 'bank'}')"`;

        let tagDots = '';
        if (course.tags && course.tags.length > 0) {
            tagDots = `<div class="card-tag-dots">`;
            course.tags.forEach(tId => {
                const tag = State.tags.find(t => t.id === tId);
                if (tag) {
                    const iconClass = tag.icon || 'ph-circle';
                    tagDots += `<i class="ph-fill ${iconClass} text-[0.8rem] drop-shadow-sm" style="color: ${tag.color}" title="${tag.name}"></i>`;
                }
            });
            tagDots += `</div>`;
        }

        let actionButtons = isBankCard 
            ? `<button class="btn-icon" onclick="event.stopPropagation(); UI.editCourse('${course.id}')" title="Edit Course"><i class="ph ph-pencil-simple text-icon leading-none"></i></button>
               <button class="btn-icon-danger" onclick="event.stopPropagation(); App.deleteCourse('${course.id}')" title="Delete Course"><i class="ph ph-trash text-icon leading-none"></i></button>`
            : `<button class="btn-icon-danger" onclick="App.hideDeadEnds(event, '${course.id}', '${term.id}')" title="Hide Dead Ends for this sequence"><i class="ph ph-magic-wand text-icon leading-none"></i></button>
               <button class="btn-icon" onclick="App.toggleHidden(event, '${course.id}', '${term.id}')" title="Toggle active status"><i class="ph ${eyeIcon} text-icon leading-none"></i></button>
               <button class="btn-icon-danger" onclick="App.removeCard(event, '${course.id}', '${term.id}')" title="Remove from term"><i class="ph ph-x text-icon leading-none"></i></button>`;

        return `
            <div style="${cStyleStr}" class="course-card ${compactClass} ${hiddenClass} ${selectedClass} card-node flex flex-col justify-between group/card relative overflow-hidden" 
                 data-cid="${course.id}" data-tid="${term ? term.id : 'bank'}" onmouseenter="UI.handleMouseOver('${course.id}', '${term ? term.id : 'bank'}')" onmouseleave="UI.handleMouseOut()" ${onClickHandler}>
                 <div class="flex flex-col w-full">
                    <span class="font-bold text-course-id leading-tight truncate pr-8" title="${course.id}">${course.id} <span class="font-normal text-course-credits">(${course.credits})</span></span>
                    <div class="text-course-title truncate leading-tight mt-0.5" title="${course.title}">${course.title}</div>
                 </div>
                 ${course.joint && course.joint.length ? `<div class="text-course-joint mt-auto font-medium opacity-80 truncate leading-tight pb-0.5 italic" title="Joint: ${course.joint.join(', ')}">Joint: ${course.joint.join(', ')}</div>` : `<div class="mt-auto"></div>`}
                 ${tagDots}
                 <div class="card-action-menu">${actionButtons}</div>
            </div>`;
    },

    // ==========================================
    // MODAL & FORM HTML GENERATORS
    // ==========================================
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
                    <button onclick="UI.openTagEditor('${tag.id}')" class="btn-icon"><i class="ph ph-pencil-simple text-icon"></i></button>
                    <button onclick="App.deleteTag('${tag.id}')" class="btn-icon-danger"><i class="ph ph-trash text-icon"></i></button>
                </div>
            </div>`;
        }).join('');
    },

    buildCourseTagsFormHTML(selectedTagIds = []) {
        if (State.tags.length === 0) return `<span class="text-xs text-text-muted italic">No tags available. Create one!</span>`;
        return State.tags.map(tag => {
            const isChecked = selectedTagIds.includes(tag.id) ? 'checked' : '';
            const iconClass = tag.icon || 'ph-circle';
            return `
            <label class="flex items-center gap-1.5 px-2 py-1 bg-surface border border-border rounded cursor-pointer hover:bg-surface-hover">
                <input type="checkbox" value="${tag.id}" class="course-tag-checkbox accent-accent" ${isChecked}>
                <i class="ph-fill ${iconClass} text-sm drop-shadow-sm" style="color: ${tag.color}"></i>
                <span class="text-xs font-medium">${tag.name}</span>
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
            return `<button type="button" onclick="UI.selectIcon('${icon}')" class="flex justify-center items-center p-1 border rounded cursor-pointer transition-colors ${activeClass}">
                <i class="ph-fill ${icon} text-lg drop-shadow-sm" ${styleStr}></i>
            </button>`;
        }).join('');
    }
};