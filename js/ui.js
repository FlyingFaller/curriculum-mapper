import { State } from './state.js';
import { HoverEngine } from './hover.js';

export const UI = {
    compactMode: false,
    selectedCourseId: null,

    utils: {
        sanitizeId: (str) => str.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9_-]/g, ''),
        parseList: (str) => str.split(',').map(s => s.trim().toUpperCase().replace(/\s+/g, '')).filter(s => s.length > 0),
        getContrastColor(hexColor) {
            if (!hexColor) return '';
            let r = parseInt(hexColor.substr(1, 2), 16);
            let g = parseInt(hexColor.substr(3, 2), 16);
            let b = parseInt(hexColor.substr(5, 2), 16);
            let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            return (yiq >= 128) ? '#000000' : '#ffffff';
        },
        setColoris(selector, color) {
            const input = document.querySelector(selector);
            if (input) {
                input.value = color;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    },

    generateCourseCardHTML(course, term, isHidden, isBankCard = false) {
        const hiddenClass = isHidden ? 'hidden-instance' : '';
        const eyeIcon = isHidden ? 'ph-eye-slash' : 'ph-eye';
        const compactClass = UI.compactMode ? 'compact-mode-card shrink-0' : '';
        const selectedClass = (isBankCard && course.id === UI.selectedCourseId) ? 'selected-card' : '';
        let cStyleStr = (isBankCard && course.color) ? `background-color: ${course.color}; color: ${UI.utils.getContrastColor(course.color)};` : ``;

        let onClickHandler = isBankCard ? `onclick="App.selectCourse('${course.id}')"` : `onclick="event.stopPropagation()"`;
        
        let actionButtons = isBankCard 
            ? `
            <button class="w-7 h-7 flex items-center justify-center text-text-main hover:text-accent hover:bg-surface-hover transition-colors" onclick="event.stopPropagation(); UI.editCourse('${course.id}')" title="Edit Course">
                <i class="ph ph-pencil-simple fs-icon leading-none"></i>
            </button>
            <button class="w-7 h-7 flex items-center justify-center text-text-main hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" onclick="event.stopPropagation(); App.deleteCourse('${course.id}')" title="Delete Course">
                <i class="ph ph-trash fs-icon leading-none"></i>
            </button>
            `
            : `
            <button class="w-7 h-7 flex items-center justify-center text-text-main hover:text-accent hover:bg-surface-hover transition-colors" onclick="App.toggleHidden(event, '${course.id}', '${term.id}')" title="Toggle active status">
                <i class="ph ${eyeIcon} fs-icon leading-none"></i>
            </button>
            <button class="w-7 h-7 flex items-center justify-center text-text-main hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" onclick="App.removeCard(event, '${course.id}', '${term.id}')" title="Remove from term">
                <i class="ph ph-x fs-icon leading-none"></i>
            </button>
            `;

        return `
            <div style="${cStyleStr}" class="course-card ${compactClass} ${hiddenClass} ${selectedClass} card-node flex flex-col justify-between group/card relative overflow-hidden" 
                 data-cid="${course.id}" data-tid="${term ? term.id : 'bank'}"
                 onmouseenter="UI.handleMouseOver('${course.id}', '${term ? term.id : 'bank'}')"
                 onmouseleave="UI.handleMouseOut()"
                 ${onClickHandler}>
                 
                 <div class="flex flex-col w-full">
                    <span class="font-bold fs-course-id leading-tight truncate pr-8" title="${course.id}">${course.id} <span class="font-normal fs-course-credits">(${course.credits})</span></span>
                    <div class="fs-course-title truncate leading-tight mt-0.5" title="${course.title}">${course.title}</div>
                 </div>
                 
                 ${course.joint.length ? `<div class="fs-course-joint mt-auto font-medium opacity-80 truncate leading-tight pb-0.5 italic" title="Joint: ${course.joint.join(', ')}">Joint: ${course.joint.join(', ')}</div>` : `<div class="mt-auto"></div>`}
                 
                 <div class="absolute top-1 right-1 flex opacity-0 group-hover/card:opacity-100 transition-opacity z-50 bg-surface shadow-md border border-border rounded overflow-hidden">
                    ${actionButtons}
                 </div>
            </div>
        `;
    },

    initColoris() {
        if(window.Coloris) {
            Coloris({
                theme: 'pill',
                formatToggle: true,
                alpha: false,
                swatches: [ '#ffffff', '#fca5a5', '#fdba74', '#fde047', '#86efac', '#93c5fd', '#d8b4fe', '#f9a8d4' ]
            });
        }
    },

    initResizer() {
        const resizer = document.getElementById('footer-resizer');
        const footer = document.getElementById('info-footer');
        let isDragging = false;

        resizer.addEventListener('mousedown', (e) => {
            isDragging = true;
            document.body.style.cursor = 'row-resize';
            document.body.classList.add('select-none');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newHeight = window.innerHeight - e.clientY;
            const maxHeight = window.innerHeight * 0.8;
            if (newHeight < 100) newHeight = 100;
            if (newHeight > maxHeight) newHeight = maxHeight;
            footer.style.height = `${newHeight}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = '';
                document.body.classList.remove('select-none');
            }
        });
    },

    renderTable() {
        const thead = document.getElementById('table-head');
        const tbody = document.getElementById('table-body');
        const table = document.getElementById('schedule-table'); // Grab the table element

        let savedScrollPos = 0;
        const existingContainer = document.querySelector('.course-bank-container');
        if (existingContainer) {
            savedScrollPos = existingContainer.scrollTop;
        }

        // Dynamically toggle the stretch class so standard mode isn't affected
        if (UI.compactMode) {
            table.classList.add('compact-table');
        } else {
            table.classList.remove('compact-table');
        }
        
        // --- 1. HEADER RENDERING ---
        
        // Calculate total hours for the entire course bank (first column)
        let totalBankCredits = Object.values(State.courses).reduce((sum, course) => sum + (course.credits || 0), 0);

        let headerHTML = `<tr class="bg-surface">
        <th class="cell-size sticky-col px-3 py-2 z-30 border-b border-border bg-surface-alt">
            <div class="font-bold fs-header" title="${UI.compactMode ? 'Course Bank' : 'Courses'}">${UI.compactMode ? 'Course Bank' : 'Courses'}</div>
            <div class="text-xs font-normal opacity-80 mt-0.5">${totalBankCredits} hours</div>
        </th>`;
        
        State.terms.forEach((term) => {
            // Calculate active, un-hidden hours specifically for this term
            let termCredits = 0;
            Object.keys(State.schedule).forEach(cId => {
                const cell = State.schedule[cId]?.[term.id];
                if (cell && cell.active && !cell.hidden) {
                    const cData = State.courses[cId];
                    if (cData) termCredits += (cData.credits || 0);
                }
            });

            let styleStr = term.color ? `background-color: ${term.color}; color: ${UI.utils.getContrastColor(term.color)};` : `background-color: var(--bg-surface);`;
            
            headerHTML += `<th style="${styleStr}" class="cell-size px-3 py-2 font-bold border-r border-border group text-left border-b">
                <div class="truncate w-full pr-8 fs-header" title="${term.name}">${term.name}</div>
                <div class="text-xs font-normal opacity-80 mt-0.5">${termCredits} hours</div>
                <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex bg-surface shadow-md border border-border rounded overflow-hidden z-50">
                    <button onclick="UI.editTerm('${term.id}')" class="w-7 h-7 flex items-center justify-center text-text-main hover:text-accent hover:bg-surface-hover transition-colors"><i class="ph ph-pencil-simple fs-icon leading-none"></i></button>
                    <button onclick="App.deleteTerm('${term.id}')" class="w-7 h-7 flex items-center justify-center text-text-main hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><i class="ph ph-trash fs-icon leading-none"></i></button>
                </div>
            </th>`;
        });
        headerHTML += `</tr>`;
        thead.innerHTML = headerHTML;

        let bodyHTML = '';
        const sortedCourses = Object.values(State.courses).sort((a,b) => a.id.localeCompare(b.id));

        // --- 2. COMPACT MODE RENDERING ---
        if (UI.compactMode) {
            
            // Main Canvas Row
            bodyHTML += `<tr class="compact-main-row">`;
            
            // Col 1: Course Bank Sidebar (Isolated Scroll via CSS absolute inset)
            bodyHTML += `<td style="background-color: var(--bg-surface-mid);" class="cell-size course-bank-cell sticky-col align-top border-r border-b border-border">
                <div class="course-bank-container flex flex-col gap-2">`;
            sortedCourses.forEach(course => {
                bodyHTML += UI.generateCourseCardHTML(course, null, false, true);
            });
            bodyHTML += `</div></td>`;
            
            // Cols 2..N: Term Stacks
            State.terms.forEach(term => {
                bodyHTML += `<td class="cell-size p-2 align-top border-r border-b border-border bg-surface">
                    <div class="flex flex-col gap-2 w-full">`;
                
                let visibleHTML = '';
                let hiddenHTML = '';
                
                sortedCourses.forEach(course => {
                    // Hide active card from standard grid if we are currently editing it
                    if (course.id === UI.selectedCourseId) return;
                    
                    const cellData = State.schedule[course.id]?.[term.id];
                    if (cellData?.active) {
                        // Group cards into visible and hidden strings
                        if (cellData.hidden) {
                            hiddenHTML += UI.generateCourseCardHTML(course, term, true, false);
                        } else {
                            visibleHTML += UI.generateCourseCardHTML(course, term, false, false);
                        }
                    }
                });
                
                // Append visible cards first, then hidden cards
                bodyHTML += visibleHTML + hiddenHTML;
                bodyHTML += `</div></td>`;
            });
            bodyHTML += `</tr>`;

            // The Bottom Editor Row (Only renders if a course is actually selected)
            if (UI.selectedCourseId && State.courses[UI.selectedCourseId]) {
                const activeCourse = State.courses[UI.selectedCourseId];
                let activeCourseStyle = activeCourse.color ? `background-color: ${activeCourse.color}; color: ${UI.utils.getContrastColor(activeCourse.color)};` : ``;
                
                bodyHTML += `<tr class="sticky-bottom-row">`;
                
                // Editor Row Col 1: Selected Card Anchor
                bodyHTML += `
                    <td class="cell-size sticky-col align-top border-r border-border p-2">
                        <div style="${activeCourseStyle}" class="course-card compact-mode-card selected-card flex flex-col justify-between group/card relative overflow-hidden m-0" onclick="App.selectCourse(null)">
                            <div class="flex flex-col w-full">
                                <span class="font-bold fs-course-id leading-tight truncate pr-8" title="${activeCourse.id}">${activeCourse.id}</span>
                                <div class="fs-course-title opacity-90 truncate leading-tight mt-0.5" title="${activeCourse.title}">${activeCourse.title}</div>
                            </div>
                            <div class="absolute top-1 right-1 flex z-50 bg-surface shadow-md border border-border rounded overflow-hidden">
                                <button class="w-7 h-7 flex items-center justify-center text-text-main hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" onclick="event.stopPropagation(); App.selectCourse(null)" title="Close Editor">
                                    <i class="ph ph-x fs-icon leading-none"></i>
                                </button>
                            </div>
                        </div>
                    </td>`;
                
                // Editor Row Cols 2..N: Target Toggles
                State.terms.forEach(term => {
                    const cellData = State.schedule[activeCourse.id]?.[term.id];
                    const isActive = cellData?.active;
                    
                    // Changed align-middle to align-top so cards sit flush against the top
                    bodyHTML += `<td class="cell-size align-top border-r border-border p-2">`;
                    
                    if (isActive) {
                        // REVERTED: Render the actual course card instead of the checkmark
                        bodyHTML += UI.generateCourseCardHTML(activeCourse, term, cellData.hidden, false);
                    } else {
                        bodyHTML += `
                            <div class="edit-target-zone" onclick="App.toggleCell('${activeCourse.id}', '${term.id}')">
                                <i class="ph ph-plus text-2xl mb-0.5"></i>
                                <span class="text-[0.65rem] font-bold uppercase tracking-wider">Add Here</span>
                            </div>
                        `;
                    }
                    bodyHTML += `</td>`;
                });
                bodyHTML += `</tr>`;
            }
            
        } else {
            // --- 3. NORMAL MODE RENDERING ---
            sortedCourses.forEach(course => {
                bodyHTML += `<tr class="hover:bg-surface-hover transition-colors" data-course-row="${course.id}">`;
                
                // Updated the default fallback to our new mid-tone color
                let cStyleStr = course.color ? `background-color: ${course.color}; color: ${UI.utils.getContrastColor(course.color)};` : `background-color: var(--bg-surface-mid);`;

                bodyHTML += `
                    <td style="${cStyleStr}" class="cell-size h-[5.5rem] sticky-col px-3 py-2 align-top group border-b border-border">
                        <div class="flex justify-between items-start relative">
                            <span class="font-bold fs-course-id leading-tight truncate pr-8" title="${course.id}">${course.id} <span class="font-normal fs-course-credits opacity-80">(${course.credits})</span></span>
                            <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex bg-surface shadow-md border border-border rounded overflow-hidden z-50">
                                <button onclick="UI.editCourse('${course.id}')" class="w-7 h-7 flex items-center justify-center text-text-main hover:text-accent hover:bg-surface-hover transition-colors"><i class="ph ph-pencil-simple fs-icon leading-none"></i></button>
                                <button onclick="App.deleteCourse('${course.id}')" class="w-7 h-7 flex items-center justify-center text-text-main hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><i class="ph ph-trash fs-icon leading-none"></i></button>
                            </div>
                        </div>
                        <div class="fs-course-title opacity-90 truncate leading-tight mt-0.5" title="${course.title}">${course.title}</div>
                    </td>`;

                State.terms.forEach(term => {
                    const cellData = State.schedule[course.id]?.[term.id];
                    const isActive = cellData?.active;
                    
                    bodyHTML += `<td class="cell-size h-[5.5rem] p-0 align-top border-r border-b border-border bg-surface relative" onclick="App.toggleCell('${course.id}', '${term.id}')">`;
                    if (isActive) {
                        bodyHTML += UI.generateCourseCardHTML(course, term, cellData.hidden, false);
                    }
                    bodyHTML += `</td>`;
                });
                bodyHTML += `</tr>`;
            });
        }
        tbody.innerHTML = bodyHTML;

        if (UI.compactMode) {
            // We have to query for it again because the old one was destroyed
            const newContainer = document.querySelector('.course-bank-container');
            if (newContainer) {
                newContainer.scrollTop = savedScrollPos;
            }
        }
    },

    openTermModal() {
        document.getElementById('term-name').dataset.id = '';
        document.getElementById('term-name').value = '';
        UI.utils.setColoris('#term-color', '#ffffff');
        document.getElementById('term-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('term-name').focus(), 50);
    },
    
    editTerm(tId) {
        const term = State.terms.find(t => t.id === tId);
        if(!term) return;
        document.getElementById('term-name').dataset.id = tId;
        document.getElementById('term-name').value = term.name;
        UI.utils.setColoris('#term-color', term.color || '#ffffff');
        document.getElementById('term-modal').classList.remove('hidden');
    },
    
    openCourseModal() {
        document.getElementById('course-form').reset();
        document.getElementById('course-form').dataset.originalId = '';
        document.getElementById('course-id').readOnly = false;
        UI.utils.setColoris('#course-color', '#ffffff');
        document.getElementById('course-modal-title').innerText = "Add Course";
        document.getElementById('course-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('course-id').focus(), 50);
    },

    editCourse(cId) {
        const c = State.courses[cId];
        if(!c) return;
        document.getElementById('course-form').dataset.originalId = c.id;
        document.getElementById('course-id').value = c.id;
        document.getElementById('course-id').readOnly = false;
        document.getElementById('course-title').value = c.title;
        document.getElementById('course-credits').value = c.credits;
        UI.utils.setColoris('#course-color', c.color || '#ffffff');
        document.getElementById('course-prereqs').value = c.prereqs.join(', ');
        document.getElementById('course-coreqs').value = c.coreqs.join(', ');
        document.getElementById('course-joint').value = c.joint.join(', ');
        document.getElementById('course-desc').value = c.desc;
        
        document.getElementById('course-modal-title').innerText = "Edit Course";
        document.getElementById('course-modal').classList.remove('hidden');
    },

    closeModals() {
        document.getElementById('term-modal').classList.add('hidden');
        document.getElementById('course-modal').classList.add('hidden');
    },

    showConfirm(title, msg, onConfirmCallback) {
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-message').innerText = msg;
        document.getElementById('confirm-modal').classList.remove('hidden');
        document.getElementById('confirm-btn').onclick = () => {
            UI.closeConfirm();
            onConfirmCallback();
        };
    },

    closeConfirm() {
        document.getElementById('confirm-modal').classList.add('hidden');
    },

    handleMouseOver(cId, tId) {
        const cData = State.courses[cId];
        if(!cData) return;

        document.getElementById('desc-title').innerText = `${cData.id}: ${cData.title}`;
        let tags = `<span class="bg-surface-alt px-2 py-1 rounded border border-border">${cData.credits} Credits</span>`;
        if(cData.prereqs.length) tags += `<span class="px-2 py-1 rounded text-[#1e3a8a] bg-[#93c5fd] border border-[#1e3a8a]">Prereqs: ${cData.prereqs.join(', ')}</span>`;
        if(cData.coreqs.length) tags += `<span class="px-2 py-1 rounded text-[#32006e] bg-[#d8c2f5] border border-[#32006e]">Coreqs: ${cData.coreqs.join(', ')}</span>`;
        document.getElementById('desc-tags').innerHTML = tags;
        document.getElementById('desc-content').innerText = cData.desc || "No description provided.";

        const { highlights, status } = HoverEngine.analyze(cId, tId);

        document.querySelectorAll('.card-node').forEach(node => {
            const nodeCid = node.getAttribute('data-cid');
            const nodeTid = node.getAttribute('data-tid');
            
            if (nodeCid === cId && nodeTid === tId) {
                if (status.hasMissError) node.classList.add('hl-err-miss');
                else if (status.hasTempError) node.classList.add('hl-err-temp');
                else node.classList.add('hl-hover');
            } else {
                const key = `${nodeCid}_${nodeTid}`;
                if (highlights[key]) node.classList.add(highlights[key]);
            }
        });
    },

    handleMouseOut() {
        document.getElementById('desc-title').innerText = "Hover over a course";
        document.getElementById('desc-tags').innerHTML = "";
        document.getElementById('desc-content').innerText = "";
        const classesToRemove = ['hl-hover', 'hl-imm-pre', 'hl-sec-pre', 'hl-post', 'hl-coreq', 'hl-err-temp', 'hl-err-miss'];
        document.querySelectorAll('.card-node').forEach(node => node.classList.remove(...classesToRemove));
    }
};