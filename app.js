/* --- Modular JavaScript --- */

// 1. DATA MODELS & STATE
const State = {
    terms: [], // Array of { id: string, name: string }
    courses: {}, // Map of id -> { id, title, credits, prereqs[], coreqs[], joint[], desc }
    schedule: {}, // Map of courseId -> { termId -> { active: boolean, hidden: boolean } }
    
    initDefault() {
        // this.terms = [
        //     { id: 't-1', name: 'Term 1' },
        //     { id: 't-2', name: 'Term 2' },
        //     { id: 't-3', name: 'Term 3' }
        // ];
        
        // // Demo Data
        // this.courses = {
        //     'MATH221': { id: 'MATH221', title: 'Calculus I', credits: 4, prereqs: [], coreqs: [], joint: [], desc: 'First course in calculus and analytic geometry.' },
        //     'MATH231': { id: 'MATH231', title: 'Calculus II', credits: 3, prereqs: ['MATH221'], coreqs: [], joint: [], desc: 'Second course in calculus: integration, series.' },
        //     'PHYS211': { id: 'PHYS211', title: 'Physics: Mechanics', credits: 4, prereqs: ['MATH221'], coreqs: ['MATH231'], joint: [], desc: 'Newton\'s Laws, work and energy, kinematics.' },
        //     'AE202': { id: 'AE202', title: 'Aerospace Flight Mech', credits: 3, prereqs: ['PHYS211', 'MATH231'], coreqs: [], joint: [], desc: 'Principles of aerospace flight mechanics.' }
        // };

        // this.schedule = {
        //     'MATH221': { 't-1': { active: true, hidden: false } },
        //     'MATH231': { 't-2': { active: true, hidden: false } },
        //     'PHYS211': { 't-2': { active: true, hidden: false } },
        //     'AE202': { 't-3': { active: true, hidden: false } }
        // };

        this.terms = [
            { id: 't-1', name: 'AUT 26' },
            { id: 't-2', name: 'WIN 27' },
            { id: 't-3', name: 'SPR 27' },
            { id: 't-4', name: 'AUT 27' },
            { id: 't-5', name: 'WIN 28' },
            { id: 't-6', name: 'SPR 28' },
        ];

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
    // Helper: Find active, non-hidden instances of a course and return their Term Indexes
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
        const highlights = {}; // Format: "courseId_termId": "css-class"
        const status = { hasTempError: false, hasMissError: false };
        const hoverTermIdx = State.terms.findIndex(t => t.id === hoverTid);

        if (hoverTermIdx === -1 || !State.courses[hoverCid]) return { highlights, status };

        // --- 1. PREREQUISITES (Looking backward) ---
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
                    // Valid prereqs must happen strictly BEFORE the dependent course
                    let validInstances = instances.filter(tIdx => tIdx < curr.termIdx);
                    
                    if (validInstances.length === 0) {
                        if (curr.cid === hoverCid) status.hasTempError = true;
                    } else {
                        // Mark on map
                        validInstances.forEach(tIdx => {
                            let termId = State.terms[tIdx].id;
                            highlights[`${reqId}_${termId}`] = curr.depth === 1 ? 'hl-imm-pre' : 'hl-sec-pre';
                        });
                        // Recurse
                        if (!preVisited.has(reqId)) {
                            preVisited.add(reqId);
                            // Use the latest valid instance term for temporal chain checking
                            preQueue.push({ cid: reqId, termIdx: Math.max(...validInstances), depth: curr.depth + 1 });
                        }
                    }
                }
            });

            // Corequisites (Typically must be in the same term or earlier)
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

        // --- 2. POSTREQUISITES (Looking forward) ---
        // What future courses require the hovered course?
        let postQueue = [{ cid: hoverCid, termIdx: hoverTermIdx }];
        let postVisited = new Set([hoverCid]);

        while (postQueue.length > 0) {
            let curr = postQueue.shift();

            Object.values(State.courses).forEach(potentialPost => {
                if (potentialPost.prereqs.includes(curr.cid)) {
                    let instances = this.getValidInstances(potentialPost.id);
                    // Valid postreqs must happen strictly AFTER the current course
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
        parseList: (str) => str.split(',').map(s => s.trim().toUpperCase().replace(/\s+/g, '')).filter(s => s.length > 0)
    },

    initResizer() {
        const resizer = document.getElementById('footer-resizer');
        const footer = document.getElementById('info-footer');
        let isDragging = false;

        resizer.addEventListener('mousedown', (e) => {
            isDragging = true;
            document.body.style.cursor = 'row-resize';
            document.body.classList.add('select-none'); // Prevent text selection while dragging
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            // Calculate new height, restricting bounds (min 100px, max 80% of window)
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
        
        // Render Header (Terms)
        let headerHTML = `<tr class="bg-white">
            <th class="sticky-col px-2 py-1.5 min-w-[8rem] max-w-[8rem] z-30 border-b border-gray-300">
                <div class="font-bold text-[12px] text-gray-700">Courses</div>
            </th>`;
        State.terms.forEach((term, idx) => {
            headerHTML += `<th class="px-2 py-1.5 font-bold text-[12px] text-gray-800 min-w-[7rem] max-w-[7rem] border-r relative group text-left border-b border-gray-300 truncate">
                ${term.name}
                <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-0.5 transition bg-white/90 rounded px-0.5 shadow-sm">
                    <button onclick="UI.editTerm('${term.id}')" class="text-gray-500 hover:text-indigo-600 p-0.5"><i class="ph ph-pencil-simple"></i></button>
                    <button onclick="App.deleteTerm('${term.id}')" class="text-gray-500 hover:text-red-600 p-0.5"><i class="ph ph-trash"></i></button>
                </div>
            </th>`;
        });
        headerHTML += `</tr>`;
        thead.innerHTML = headerHTML;

        // Render Body (Courses)
        let bodyHTML = '';
        const sortedCourses = Object.values(State.courses).sort((a,b) => a.id.localeCompare(b.id));

        sortedCourses.forEach(course => {
            bodyHTML += `<tr class="hover:bg-gray-50/50" data-course-row="${course.id}">`;
            
            // Course Meta Column (Sticky)
            bodyHTML += `
                <td class="sticky-col px-2 py-1.5 align-top group border-b border-gray-200">
                    <div class="flex justify-between items-start relative">
                        <span class="font-bold text-gray-900 text-[12px] leading-tight truncate pr-4">${course.id} <span class="font-normal text-[11px]">(${course.credits})</span></span>
                        <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition absolute right-0 top-0">
                            <button onclick="UI.editCourse('${course.id}')" class="text-gray-400 hover:text-indigo-600 bg-transparent"><i class="ph ph-pencil-simple"></i></button>
                            <button onclick="App.deleteCourse('${course.id}')" class="text-gray-400 hover:text-red-600 bg-transparent"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                    <div class="text-[11px] text-gray-700 truncate leading-tight mt-0" title="${course.title}">${course.title}</div>
                </td>`;

            // Term Cells
            State.terms.forEach(term => {
                const cellData = State.schedule[course.id]?.[term.id];
                const isActive = cellData?.active;
                const isHidden = cellData?.hidden;
                
                bodyHTML += `<td class="grid-cell relative" onclick="App.toggleCell('${course.id}', '${term.id}')">`;
                
                if (isActive) {
                    const hiddenClass = isHidden ? 'hidden-instance' : '';
                    const eyeIcon = isHidden ? 'ph-eye-slash' : 'ph-eye';
                    
                    // Render Course Card
                    bodyHTML += `
                        <div class="course-card ${hiddenClass} card-node flex flex-col justify-between group/card relative overflow-hidden" 
                             data-cid="${course.id}" data-tid="${term.id}"
                             onmouseenter="UI.handleMouseOver('${course.id}', '${term.id}')"
                             onmouseleave="UI.handleMouseOut()">
                             
                             <div class="flex flex-col w-full">
                                <span class="font-bold text-[11.5px] leading-tight truncate">${course.id} <span class="font-normal text-[10.5px]">(${course.credits})</span></span>
                                <div class="text-[10.5px] truncate leading-tight mt-0">${course.title}</div>
                             </div>
                             
                             ${course.joint.length ? `<div class="text-[9px] mt-auto font-medium opacity-80 truncate leading-tight pb-0.5">Joint: ${course.joint.join(', ')}</div>` : `<div class="mt-auto"></div>`}
                             
                             <!-- Floating action buttons -->
                             <div class="absolute top-0 right-0 flex gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity z-10 p-0.5">
                                <button class="p-0.5 rounded text-gray-300 hover:text-white bg-transparent transition-colors" onclick="App.toggleHidden(event, '${course.id}', '${term.id}')" title="Toggle active status for prerequisites">
                                    <i class="ph ${eyeIcon} text-[16px]"></i>
                                </button>
                                <button class="p-0.5 rounded text-gray-300 hover:text-red-400 bg-transparent transition-colors" onclick="App.removeCard(event, '${course.id}', '${term.id}')" title="Remove from term">
                                    <i class="ph ph-x text-[16px]"></i>
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

    // --- Modals ---
    openTermModal() {
        document.getElementById('term-name').dataset.id = '';
        document.getElementById('term-name').value = '';
        document.getElementById('term-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('term-name').focus(), 50);
    },
    
    editTerm(tId) {
        const term = State.terms.find(t => t.id === tId);
        if(!term) return;
        document.getElementById('term-name').dataset.id = tId;
        document.getElementById('term-name').value = term.name;
        document.getElementById('term-modal').classList.remove('hidden');
    },
    
    openCourseModal() {
        document.getElementById('course-form').reset();
        document.getElementById('course-form').dataset.originalId = '';
        document.getElementById('course-id').readOnly = false;
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
    
    showAlert(msg) {
        document.getElementById('alert-message').innerText = msg;
        document.getElementById('alert-modal').classList.remove('hidden');
    },
    
    closeAlert() {
        document.getElementById('alert-modal').classList.add('hidden');
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

    // --- Hover Effects ---
    handleMouseOver(cId, tId) {
        const cData = State.courses[cId];
        if(!cData) return;

        // 1. Update Footer Content
        document.getElementById('desc-title').innerText = `${cData.id}: ${cData.title}`;
        let tags = `<span class="bg-gray-200 px-2 py-1 rounded text-gray-700">${cData.credits} Credits</span>`;
        if(cData.prereqs.length) tags += `<span class="bg-blue-100 px-2 py-1 rounded text-blue-800 border border-blue-200">Prereqs: ${cData.prereqs.join(', ')}</span>`;
        if(cData.coreqs.length) tags += `<span class="bg-purple-100 px-2 py-1 rounded text-purple-800 border border-purple-200">Coreqs: ${cData.coreqs.join(', ')}</span>`;
        if(cData.joint.length) tags += `<span class="bg-indigo-100 px-2 py-1 rounded text-indigo-800 border border-indigo-200">Joint: ${cData.joint.join(', ')}</span>`;
        document.getElementById('desc-tags').innerHTML = tags;
        document.getElementById('desc-content').innerText = cData.desc || "No description provided.";

        // 2. Compute Dependencies
        const { highlights, status } = HoverEngine.analyze(cId, tId);

        // 3. Apply CSS Classes
        document.querySelectorAll('.card-node').forEach(node => {
            const nodeCid = node.getAttribute('data-cid');
            const nodeTid = node.getAttribute('data-tid');
            
            if (nodeCid === cId && nodeTid === tId) {
                // The hovered card itself
                if (status.hasMissError) node.classList.add('hl-err-miss');
                else if (status.hasTempError) node.classList.add('hl-err-temp');
                else node.classList.add('hl-hover');
            } else {
                // Dependent cards
                const key = `${nodeCid}_${nodeTid}`;
                if (highlights[key]) {
                    node.classList.add(highlights[key]);
                }
            }
        });
    },

    handleMouseOut() {
        // Reset Footer
        document.getElementById('desc-title').innerText = "Hover over a course";
        document.getElementById('desc-tags').innerHTML = "";
        document.getElementById('desc-content').innerText = "";

        // Remove highlights
        const classesToRemove = ['hl-hover', 'hl-imm-pre', 'hl-sec-pre', 'hl-post', 'hl-coreq', 'hl-err-temp', 'hl-err-miss'];
        document.querySelectorAll('.card-node').forEach(node => {
            node.classList.remove(...classesToRemove);
        });
    }
};

// 5. APPLICATION LOGIC
const App = {
    init() {
        if (!Storage.load()) {
            State.initDefault();
            Storage.save();
        }
        UI.renderTable();
        UI.initResizer(); // Initialize the drag-to-resize footer
    },

    saveTerm() {
        const name = document.getElementById('term-name').value.trim();
        if (!name) return;
        
        const id = document.getElementById('term-name').dataset.id;
        if (id) {
            const term = State.terms.find(t => t.id === id);
            if (term) term.name = name;
        } else {
            const newId = 't-' + Date.now();
            State.terms.push({ id: newId, name });
        }
        
        Storage.save();
        UI.closeModals();
        UI.renderTable();
    },

    deleteTerm(termId) {
        UI.showConfirm("Delete Term", "Delete this term and all course assignments in it?", () => {
            State.terms = State.terms.filter(t => t.id !== termId);
            // Clean schedule map
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
        if(!id) return UI.showAlert("Course ID is required.");
        
        const originalId = document.getElementById('course-form').dataset.originalId;

        if (originalId && originalId !== id) {
            // Changing ID
            if (State.courses[id]) {
                return UI.showAlert("A course with this new ID already exists!");
            }
            
            // Update main course record
            State.courses[id] = State.courses[originalId];
            State.courses[id].id = id;
            delete State.courses[originalId];
            
            // Transfer schedule
            if (State.schedule[originalId]) {
                State.schedule[id] = State.schedule[originalId];
                delete State.schedule[originalId];
            }
            
            // Find and replace all references in other courses' prereqs, coreqs, and joints
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
            desc: document.getElementById('course-desc').value.trim()
        };

        Storage.save();
        UI.closeModals();
        UI.renderTable();
    },

    deleteCourse(courseId) {
        UI.showConfirm("Delete Course", `Delete course ${courseId} completely?`, () => {
            delete State.courses[courseId];
            delete State.schedule[courseId];
            // Also clean up references in other courses
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
        
        // If cell is empty, clicking adds the course
        if (!State.schedule[courseId][termId]?.active) {
            State.schedule[courseId][termId] = { active: true, hidden: false };
            Storage.save();
            UI.renderTable();
        }
    },

    removeCard(event, courseId, termId) {
        event.stopPropagation(); // Prevent cell click
        if (State.schedule[courseId]?.[termId]) {
            State.schedule[courseId][termId].active = false;
            Storage.save();
            UI.renderTable();
            UI.handleMouseOut(); // Clear ghost hovers
        }
    },

    toggleHidden(event, courseId, termId) {
        event.stopPropagation(); // Prevent cell click
        if (State.schedule[courseId]?.[termId]) {
            State.schedule[courseId][termId].hidden = !State.schedule[courseId][termId].hidden;
            Storage.save();
            UI.renderTable();
        }
    },
    resetMap() {
        UI.showConfirm("Reset Map", "Are you sure you want to completely reset the schedule builder? This will erase all custom courses and terms.", () => {
            localStorage.removeItem('curriculumMap');
            State.initDefault();
            Storage.save();
            UI.renderTable();
        });
    }
};



// Bootstrap
document.addEventListener('DOMContentLoaded', () => App.init());
