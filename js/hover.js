import { State } from './state.js';

export const HoverEngine = {
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

        // --- NEW: HIGHLIGHT PRIORITY SYSTEM ---
        // Prevents indirect relationships from overwriting direct ones in complex webs
        const priority = {
            'hl-imm-pre': 4,
            'hl-coreq': 3,
            'hl-post': 2,
            'hl-sec-pre': 1
        };

        const setHighlight = (key, className) => {
            // Only assign the highlight if the cell is currently empty, 
            // OR if the new highlight has a higher priority than the existing one.
            if (!highlights[key] || priority[className] > priority[highlights[key]]) {
                highlights[key] = className;
            }
        };

        // --- 1. PREREQUISITE & COREQUISITE TRAVERSAL ---
        let preQueue = [{ cid: hoverCid, termIdx: hoverTermIdx, depth: 1 }];
        let preVisited = new Set([hoverCid]);

        while (preQueue.length > 0) {
            let curr = preQueue.shift();
            let cData = State.courses[curr.cid];
            if (!cData) continue;

            // Check standard prerequisites
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
                            let hlClass = curr.depth === 1 ? 'hl-imm-pre' : 'hl-sec-pre';
                            // Safely assign highlight based on priority
                            setHighlight(`${reqId}_${termId}`, hlClass);
                        });
                        if (!preVisited.has(reqId)) {
                            preVisited.add(reqId);
                            preQueue.push({ cid: reqId, termIdx: Math.max(...validInstances), depth: curr.depth + 1 });
                        }
                    }
                }
            });

            // Check corequisites (Concurrent/Credit required)
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
                                // Safely assign highlight based on priority
                                setHighlight(`${reqId}_${State.terms[tIdx].id}`, 'hl-coreq');
                            });
                            
                            // Push the concurrent requirement into the queue so the engine
                            // continues to trace backwards and highlight ITS prerequisite chain!
                            if (!preVisited.has(reqId)) {
                                preVisited.add(reqId);
                                preQueue.push({ cid: reqId, termIdx: Math.max(...validCo), depth: curr.depth + 1 });
                            }
                        }
                    }
                });
            }
        }

        // --- 2. POSTREQUISITE TRAVERSAL ---
        let postQueue = [{ cid: hoverCid, termIdx: hoverTermIdx }];
        let postVisited = new Set([hoverCid]);

        while (postQueue.length > 0) {
            let curr = postQueue.shift();

            Object.values(State.courses).forEach(potentialPost => {
                
                const isPrereq = potentialPost.prereqs.includes(curr.cid);
                const isCoreq = potentialPost.coreqs.includes(curr.cid);

                if (isPrereq || isCoreq) {
                    let instances = this.getValidInstances(potentialPost.id);
                    let validInstances = instances.filter(tIdx => isCoreq ? tIdx >= curr.termIdx : tIdx > curr.termIdx);
                    
                    validInstances.forEach(tIdx => {
                        // Safely assign highlight based on priority
                        setHighlight(`${potentialPost.id}_${State.terms[tIdx].id}`, 'hl-post');
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