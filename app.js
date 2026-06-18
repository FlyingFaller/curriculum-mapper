/* --- Modular JavaScript --- */

// Theme Management
const ThemeConfig = {
    init() {
        const saved = localStorage.getItem('themePref');
        if (saved) {
            this.set(saved);
        } else {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.set(isDark ? 'dark' : 'light');
        }
    },
    toggle() {
        const isDark = document.documentElement.classList.contains('dark');
        this.set(isDark ? 'light' : 'dark');
    },
    set(mode) {
        localStorage.setItem('themePref', mode);
        
        const icon = document.getElementById('theme-icon');
        if (mode === 'dark') {
            document.documentElement.classList.add('dark');
            if(icon) icon.className = 'ph ph-moon text-xl';
        } else {
            document.documentElement.classList.remove('dark');
            if(icon) icon.className = 'ph ph-sun text-xl';
        }
    }
};

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('themePref')) {
        ThemeConfig.set(e.matches ? 'dark' : 'light');
    }
});


// 1. DATA MODELS & STATE
const State = {
    terms: [], 
    courses: {}, 
    schedule: {}, 
    
    initDefault() {
        this.terms = [
            { id: 't-1', name: 'AUT 26', color: '' },
            { id: 't-2', name: 'WIN 27', color: '' },
            { id: 't-3', name: 'SPR 27', color: '' },
            { id: 't-4', name: 'AUT 27', color: '' },
            { id: 't-5', name: 'WIN 28', color: '' },
            { id: 't-6', name: 'SPR 28', color: '' }
            
        ];

        // this.courses = {
        //     'MATH124': { id: 'MATH124', title: 'Calculus I', credits: 5, prereqs: [], coreqs: [], joint: [], desc: 'Calculus with analytic geometry.', color: '' },
        //     'MATH125': { id: 'MATH125', title: 'Calculus II', credits: 5, prereqs: ['MATH124'], coreqs: [], joint: [], desc: 'Integration, applications, series.', color: '' },
        //     'MATH126': { id: 'MATH126', title: 'Calculus III', credits: 5, prereqs: ['MATH125'], coreqs: [], joint: [], desc: 'Multivariable calculus, vector geometry.', color: '' },
        //     'PHYS121': { id: 'PHYS121', title: 'Mechanics', credits: 5, prereqs: [], coreqs: ['MATH124'], joint: [], desc: 'Basic principles of mechanics.', color: '' },
        //     'PHYS122': { id: 'PHYS122', title: 'Electromagnetism', credits: 5, prereqs: ['PHYS121', 'MATH125'], coreqs: [], joint: [], desc: 'Electrostatics, circuits, magnetism.', color: '' },
        //     'AA210': { id: 'AA210', title: 'Engineering Statics', credits: 4, prereqs: ['PHYS121', 'MATH126'], coreqs: [], joint: [], desc: 'Statics of particles, rigid bodies.', color: '' }
        // };

        // this.schedule = {
        //     'MATH124': { 't-1': { active: true, hidden: false } },
        //     'PHYS121': { 't-1': { active: true, hidden: false } },
        //     'MATH125': { 't-2': { active: true, hidden: false } },
        //     'PHYS122': { 't-2': { active: true, hidden: false } },
        //     'MATH126': { 't-3': { active: true, hidden: false } },
        //     'AA210':   { 't-4': { active: true, hidden: false } }
        // };
        this.courses = {};
        this.schedule = {};
    }
};

// 2. STORAGE MANAGEMENT
const Storage = {
    save() {
        localStorage.setItem('curriculumMap', JSON.stringify({
            terms: State.terms,
            courses: State.courses,
            schedule: State.schedule
        }));
    },
    load() {
        const data = localStorage.getItem('curriculumMap');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                State.terms = parsed.terms || [];
                State.courses = parsed.courses || {};
                State.schedule = parsed.schedule || {};
                return true;
            } catch(e) { console.error("Failed to load map", e); }
        }
        return false;
    },
    exportData() {
        const data = JSON.stringify({
            terms: State.terms,
            courses: State.courses,
            schedule: State.schedule
        }, null, 2);
        
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "curriculum_map.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const parsed = JSON.parse(e.target.result);
                State.terms = parsed.terms || [];
                State.courses = parsed.courses || {};
                State.schedule = parsed.schedule || {};
                Storage.save();
                UI.renderTable();
            } catch(err) { alert("Invalid JSON file"); }
        };
        reader.readAsText(file);
    }
};

// 3. HOVER LOGIC ENGINE
const HoverEngine = {
    getValidInstances(courseId) {
        if(!State.schedule[courseId]) return [];
        let indices = [];
        for (const [termId, data] of Object.entries(State.schedule[courseId])) {
            if (data.active && !data.hidden) {
                const idx = State.terms.findIndex(t => t.id === termId);
                if (idx !== -1) indices.push(idx);
            }
        }
        return indices;
    },

    analyze(hoverCid, hoverTid) {
        const highlights = {}; 
        const status = { hasTempError: false, hasMissError: false };
        const hoverTermIdx = State.terms.findIndex(t => t.id === hoverTid);

        if (hoverTermIdx === -1 || !State.courses[hoverCid]) return { highlights, status };

        let preQueue = [{ cid: hoverCid, termIdx: hoverTermIdx, depth: 1 }];
        let preVisited = new Set([hoverCid]);

        while (preQueue.length > 0) {
            let curr = preQueue.shift();
            let cData = State.courses[curr.cid];
            if (!cData) continue;

            cData.prereqs.forEach(reqId => {
                let instances = this.getValidInstances(reqId);
                if (instances.length === 0) {
                    if (curr.cid === hoverCid) status.hasMissError = true;
                } else {
                    let validInstances = instances.filter(tIdx => tIdx < curr.termIdx);
                    if (validInstances.length === 0) {
                        if (curr.cid === hoverCid) status.hasTempError = true;
                    } else {
                        validInstances.forEach(tIdx => {
                            let termId = State.terms[tIdx].id;
                            highlights[`${reqId}_${termId}`] = curr.depth === 1 ? 'hl-imm-pre' : 'hl-sec-pre';
                        });
                        if (!preVisited.has(reqId)) {
                            preVisited.add(reqId);
                            preQueue.push({ cid: reqId, termIdx: Math.max(...validInstances), depth: curr.depth + 1 });
                        }
                    }
                }
            });

            if (curr.cid === hoverCid) {
                cData.coreqs.forEach(reqId => {
                    let instances = this.getValidInstances(reqId);
                    if (instances.length === 0) {
                        status.hasMissError = true;
                    } else {
                        let validCo = instances.filter(tIdx => tIdx <= curr.termIdx);
                        if (validCo.length === 0) {
                            status.hasTempError = true;
                        } else {
                            validCo.forEach(tIdx => {
                                highlights[`${reqId}_${State.terms[tIdx].id}`] = 'hl-coreq';
                            });
                        }
                    }
                });
            }
        }

        let postQueue = [{ cid: hoverCid, termIdx: hoverTermIdx }];
        let postVisited = new Set([hoverCid]);

        while (postQueue.length > 0) {
            let curr = postQueue.shift();

            Object.values(State.courses).forEach(potentialPost => {
                if (potentialPost.prereqs.includes(curr.cid)) {
                    let instances = this.getValidInstances(potentialPost.id);
                    let validInstances = instances.filter(tIdx => tIdx > curr.termIdx);
                    
                    validInstances.forEach(tIdx => {
                        highlights[`${potentialPost.id}_${State.terms[tIdx].id}`] = 'hl-post';
                    });

                    if (!postVisited.has(potentialPost.id) && validInstances.length > 0) {
                        postVisited.add(potentialPost.id);
                        postQueue.push({ cid: potentialPost.id, termIdx: Math.min(...validInstances) });
                    }
                }
            });
        }

        return { highlights, status };
    }
};

// 4. UI/DOM MANAGEMENT
const UI = {
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

    initColoris() {
        Coloris({
            theme: 'pill',
            formatToggle: true,
            alpha: false,
            swatches: [
                '#ffffff', '#fca5a5', '#fdba74', '#fde047', 
                '#86efac', '#93c5fd', '#d8b4fe', '#f9a8d4'
            ]
        });
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
        
        let headerHTML = `<tr class="bg-surface">
            <th class="sticky-col px-3 py-2 min-w-[12rem] max-w-[12rem] z-30 border-b border-border bg-surface">
                <div class="font-bold fs-header">Courses</div>
            </th>`;
        
        State.terms.forEach((term) => {
            let styleStr = term.color ? `background-color: ${term.color}; color: ${UI.utils.getContrastColor(term.color)};` : `background-color: var(--bg-surface);`;
            
            headerHTML += `<th style="${styleStr}" class="px-3 py-2 font-bold min-w-[10rem] max-w-[10rem] border-r border-border relative group text-left border-b">
                <div class="truncate w-full pr-8 fs-header">${term.name}</div>
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

        sortedCourses.forEach(course => {
            bodyHTML += `<tr class="hover:bg-surface-hover transition-colors" data-course-row="${course.id}">`;
            
            let cStyleStr = course.color ? `background-color: ${course.color}; color: ${UI.utils.getContrastColor(course.color)};` : `background-color: var(--bg-surface);`;

            bodyHTML += `
                <td style="${cStyleStr}" class="sticky-col px-3 py-2 align-top group border-b border-border">
                    <div class="flex justify-between items-start relative">
                        <span class="font-bold fs-course-id leading-tight truncate pr-8">${course.id} <span class="font-normal fs-course-credits opacity-80">(${course.credits})</span></span>
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
                const isHidden = cellData?.hidden;
                
                bodyHTML += `<td class="grid-cell relative" onclick="App.toggleCell('${course.id}', '${term.id}')">`;
                
                if (isActive) {
                    const hiddenClass = isHidden ? 'hidden-instance' : '';
                    const eyeIcon = isHidden ? 'ph-eye-slash' : 'ph-eye';
                    
                    bodyHTML += `
                        <div class="course-card ${hiddenClass} card-node flex flex-col justify-between group/card relative overflow-hidden" 
                             data-cid="${course.id}" data-tid="${term.id}"
                             onmouseenter="UI.handleMouseOver('${course.id}', '${term.id}')"
                             onmouseleave="UI.handleMouseOut()">
                             
                             <div class="flex flex-col w-full">
                                <span class="font-bold fs-course-id leading-tight truncate pr-8">${course.id} <span class="font-normal fs-course-credits">(${course.credits})</span></span>
                                <div class="fs-course-title truncate leading-tight mt-0.5">${course.title}</div>
                             </div>
                             
                             ${course.joint.length ? `<div class="fs-course-joint mt-auto font-medium opacity-80 truncate leading-tight pb-0.5 italic">Joint: ${course.joint.join(', ')}</div>` : `<div class="mt-auto"></div>`}
                             
                             <div class="absolute top-1 right-1 flex opacity-0 group-hover/card:opacity-100 transition-opacity z-50 bg-surface shadow-md border border-border rounded overflow-hidden">
                                <button class="w-7 h-7 flex items-center justify-center text-text-main hover:text-accent hover:bg-surface-hover transition-colors" onclick="App.toggleHidden(event, '${course.id}', '${term.id}')" title="Toggle active status">
                                    <i class="ph ${eyeIcon} fs-icon leading-none"></i>
                                </button>
                                <button class="w-7 h-7 flex items-center justify-center text-text-main hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" onclick="App.removeCard(event, '${course.id}', '${term.id}')" title="Remove from term">
                                    <i class="ph ph-x fs-icon leading-none"></i>
                                </button>
                             </div>
                        </div>
                    `;
                }
                bodyHTML += `</td>`;
            });
            bodyHTML += `</tr>`;
        });
        tbody.innerHTML = bodyHTML;
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

// 5. APPLICATION LOGIC
const App = {
    init() {
        ThemeConfig.init();
        if (!Storage.load()) {
            State.initDefault();
            Storage.save();
        }
        UI.initColoris();
        UI.renderTable();
        UI.initResizer();
    },

    saveTerm() {
        const name = document.getElementById('term-name').value.trim();
        if (!name) return;
        
        const colorVal = document.getElementById('term-color').value;
        const color = colorVal !== '#ffffff' ? colorVal : '';
        const id = document.getElementById('term-name').dataset.id;
        
        if (id) {
            const term = State.terms.find(t => t.id === id);
            if (term) {
                term.name = name;
                term.color = color;
            }
        } else {
            const newId = 't-' + Date.now();
            State.terms.push({ id: newId, name, color: color });
        }
        
        Storage.save();
        UI.closeModals();
        UI.renderTable();
    },

    deleteTerm(termId) {
        UI.showConfirm("Delete Term", "Delete this term and all course assignments in it?", () => {
            State.terms = State.terms.filter(t => t.id !== termId);
            Object.keys(State.schedule).forEach(cId => {
                if (State.schedule[cId][termId]) delete State.schedule[cId][termId];
            });
            Storage.save();
            UI.renderTable();
        });
    },

    saveCourse() {
        const rawId = document.getElementById('course-id').value;
        const id = UI.utils.sanitizeId(rawId);
        if(!id) return alert("Course ID is required.");
        
        const originalId = document.getElementById('course-form').dataset.originalId;
        
        const colorVal = document.getElementById('course-color').value;
        const color = colorVal !== '#ffffff' ? colorVal : '';

        if (originalId && originalId !== id) {
            if (State.courses[id]) return alert("A course with this new ID already exists!");
            
            State.courses[id] = State.courses[originalId];
            State.courses[id].id = id;
            delete State.courses[originalId];
            
            if (State.schedule[originalId]) {
                State.schedule[id] = State.schedule[originalId];
                delete State.schedule[originalId];
            }
            
            Object.values(State.courses).forEach(c => {
                c.prereqs = c.prereqs.map(req => req === originalId ? id : req);
                c.coreqs = c.coreqs.map(req => req === originalId ? id : req);
                c.joint = c.joint.map(req => req === originalId ? id : req);
            });
        }

        State.courses[id] = {
            id: id,
            title: document.getElementById('course-title').value.trim(),
            credits: parseInt(document.getElementById('course-credits').value) || 0,
            prereqs: UI.utils.parseList(document.getElementById('course-prereqs').value),
            coreqs: UI.utils.parseList(document.getElementById('course-coreqs').value),
            joint: UI.utils.parseList(document.getElementById('course-joint').value),
            desc: document.getElementById('course-desc').value.trim(),
            color: color
        };

        Storage.save();
        UI.closeModals();
        UI.renderTable();
    },

    deleteCourse(courseId) {
        UI.showConfirm("Delete Course", `Delete course ${courseId} completely?`, () => {
            delete State.courses[courseId];
            delete State.schedule[courseId];
            Object.values(State.courses).forEach(c => {
                c.prereqs = c.prereqs.filter(req => req !== courseId);
                c.coreqs = c.coreqs.filter(req => req !== courseId);
                c.joint = c.joint.filter(req => req !== courseId);
            });
            Storage.save();
            UI.renderTable();
        });
    },

    toggleCell(courseId, termId) {
        if (!State.schedule[courseId]) State.schedule[courseId] = {};
        if (!State.schedule[courseId][termId]?.active) {
            State.schedule[courseId][termId] = { active: true, hidden: false };
            Storage.save();
            UI.renderTable();
        }
    },

    removeCard(event, courseId, termId) {
        event.stopPropagation(); 
        if (State.schedule[courseId]?.[termId]) {
            State.schedule[courseId][termId].active = false;
            Storage.save();
            UI.renderTable();
            UI.handleMouseOut();
        }
    },

    toggleHidden(event, courseId, termId) {
        event.stopPropagation();
        if (State.schedule[courseId]?.[termId]) {
            State.schedule[courseId][termId].hidden = !State.schedule[courseId][termId].hidden;
            Storage.save();
            UI.renderTable();
        }
    },

    showAllHidden() {
        UI.showConfirm("Unhide All", "Are you sure you want to make all hidden course cards visible?", () => {
            Object.values(State.schedule).forEach(termMap => {
                Object.values(termMap).forEach(cell => {
                    if (cell.active) cell.hidden = false;
                });
            });
            Storage.save();
            UI.renderTable();
        });
    },

    hideErrors() {
        UI.showConfirm("Hide Errors", "This will automatically hide scheduled instances that have missing or incorrectly timed prerequisites. Proceed?", () => {
            let changed = true;
            let passLimit = 100; // infinite loop protection
            let passes = 0;
            
            while (changed && passes < passLimit) {
                changed = false;
                passes++;
                let toHide = [];

                const allCourses = Object.keys(State.schedule);
                for (const cId of allCourses) {
                    for (const tId in State.schedule[cId]) {
                        let cell = State.schedule[cId][tId];
                        if (cell.active && !cell.hidden) {
                            let { status } = HoverEngine.analyze(cId, tId);
                            if (status.hasTempError || status.hasMissError) {
                                toHide.push({ cId, tId });
                            }
                        }
                    }
                }

                if (toHide.length > 0) {
                    toHide.forEach(({ cId, tId }) => {
                        State.schedule[cId][tId].hidden = true;
                    });
                    changed = true; // another check needed because hiding might have broken down-chain courses
                }
            }
            Storage.save();
            UI.renderTable();
        });
    },

    resetMap() {
        UI.showConfirm("Reset Map", "Are you sure you want to completely reset the schedule builder?", () => {
            localStorage.removeItem('curriculumMap');
            State.initDefault();
            Storage.save();
            UI.renderTable();
        });
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());