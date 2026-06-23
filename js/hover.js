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

        this._markDuplicates(hoverCid, hoverTermIdx, highlights);
        this._tracePrerequisites(hoverCid, hoverTermIdx, highlights, status);
        this._tracePostrequisites(hoverCid, hoverTermIdx, highlights);

        return { highlights, status };
    },

    // --- HELPER FUNCTIONS ---

    _setHighlight(highlights, key, className) {
        const priority = { 'hl-err-temp': 5, 'hl-imm-pre': 4, 'hl-coreq': 3, 'hl-post': 2, 'hl-sec-pre': 1 };
        if (!highlights[key] || priority[className] > priority[highlights[key]]) {
            highlights[key] = className;
        }
    },

    _markDuplicates(hoverCid, hoverTermIdx, highlights) {
        this.getValidInstances(hoverCid).forEach(tIdx => {
            if (tIdx !== hoverTermIdx) {
                this._setHighlight(highlights, `${hoverCid}_${State.terms[tIdx].id}`, 'hl-err-temp');
            }
        });
    },

    _tracePrerequisites(hoverCid, hoverTermIdx, highlights, status) {
        let preQueue = [{ cid: hoverCid, termIdx: hoverTermIdx, depth: 1 }];
        let preVisited = new Set([hoverCid]);

        while (preQueue.length > 0) {
            let curr = preQueue.shift();
            let cData = State.courses[curr.cid];
            if (!cData) continue;

            // Standard Prerequisites
            let activePrereqs = cData.prereqs.filter(req => !State.whitelist.includes(req));
            activePrereqs.forEach(reqId => {
                let instances = this.getValidInstances(reqId);
                if (instances.length === 0) {
                    if (curr.cid === hoverCid) status.hasMissError = true;
                } else {
                    let validInstances = instances.filter(tIdx => tIdx < curr.termIdx);
                    let invalidInstances = instances.filter(tIdx => tIdx >= curr.termIdx);

                    invalidInstances.forEach(tIdx => this._setHighlight(highlights, `${reqId}_${State.terms[tIdx].id}`, 'hl-err-temp'));

                    if (validInstances.length === 0) {
                        if (curr.cid === hoverCid) status.hasTempError = true;
                    } else {
                        validInstances.forEach(tIdx => {
                            let hlClass = curr.depth === 1 ? 'hl-imm-pre' : 'hl-sec-pre';
                            this._setHighlight(highlights, `${reqId}_${State.terms[tIdx].id}`, hlClass);
                        });
                        if (!preVisited.has(reqId)) {
                            preVisited.add(reqId);
                            preQueue.push({ cid: reqId, termIdx: Math.max(...validInstances), depth: curr.depth + 1 });
                        }
                    }
                }
            });

            // Corequisites
            if (curr.cid === hoverCid) {
                let activeCoreqs = cData.coreqs.filter(req => !State.whitelist.includes(req));
                activeCoreqs.forEach(reqId => {
                    let instances = this.getValidInstances(reqId);
                    if (instances.length === 0) {
                        status.hasMissError = true;
                    } else {
                        let validCo = instances.filter(tIdx => tIdx <= curr.termIdx);
                        let invalidCo = instances.filter(tIdx => tIdx > curr.termIdx);

                        invalidCo.forEach(tIdx => this._setHighlight(highlights, `${reqId}_${State.terms[tIdx].id}`, 'hl-err-temp'));

                        if (validCo.length === 0) {
                            status.hasTempError = true;
                        } else {
                            validCo.forEach(tIdx => this._setHighlight(highlights, `${reqId}_${State.terms[tIdx].id}`, 'hl-coreq'));
                            if (!preVisited.has(reqId)) {
                                preVisited.add(reqId);
                                preQueue.push({ cid: reqId, termIdx: Math.max(...validCo), depth: curr.depth + 1 });
                            }
                        }
                    }
                });
            }
        }
    },

    _tracePostrequisites(hoverCid, hoverTermIdx, highlights) {
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
                    let invalidInstances = instances.filter(tIdx => isCoreq ? tIdx < curr.termIdx : tIdx <= curr.termIdx);
                    
                    invalidInstances.forEach(tIdx => this._setHighlight(highlights, `${potentialPost.id}_${State.terms[tIdx].id}`, 'hl-err-temp'));
                    validInstances.forEach(tIdx => this._setHighlight(highlights, `${potentialPost.id}_${State.terms[tIdx].id}`, 'hl-post'));

                    if (!postVisited.has(potentialPost.id) && validInstances.length > 0) {
                        postVisited.add(potentialPost.id);
                        postQueue.push({ cid: potentialPost.id, termIdx: Math.min(...validInstances) });
                    }
                }
            });
        }
    }
};