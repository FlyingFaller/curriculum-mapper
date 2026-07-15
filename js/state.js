export const State = {
    terms: [], 
    courses: {}, 
    whitelist: [],
    tags: [],
    
    schedules: {},
    activeScheduleId: null,
    
    // The grid strictly tied to editing
    get activeGrid() {
        if (!this.activeScheduleId || !this.schedules[this.activeScheduleId]) return {};
        return this.schedules[this.activeScheduleId].grid;
    },
    
    // The schedule ID we should visually render
    get displayedScheduleId() {
        return this.pinnedScheduleId || this.hoveredScheduleId || this.activeScheduleId;
    },
    
    // The grid we should visually render
    get displayedGrid() {
        const id = this.displayedScheduleId;
        if (!id || !this.schedules[id]) return {};
        return this.schedules[id].grid;
    },
    
    // Boolean check to disable editing interfaces
    get isPreviewMode() {
        return this.displayedScheduleId !== this.activeScheduleId;
    },

    // Derived memo-getter to prevent O(N) looping through entire courses list for column rendering
    get termAssignments() {
        const assignments = {};
        this.terms.forEach(t => assignments[t.id] = []);
        const grid = this.displayedGrid;
        
        for (const cId in grid) {
            for (const tId in grid[cId]) {
                if (grid[cId][tId] === true) {
                    if (!assignments[tId]) assignments[tId] = [];
                    assignments[tId].push(cId);
                }
            }
        }
        return assignments;
    },
    
    // Ephemeral UI State
    compactMode: true,
    showBreakdown: false,
    selectedCourseId: null,
    pinnedNode: null,
    hoveredScheduleId: null,
    pinnedScheduleId: null,

    initDefault() {
        this.terms = [
            { id: 't-1', name: 'AUT 26', color: '' },
            { id: 't-2', name: 'WIN 27', color: '' },
            { id: 't-3', name: 'SPR 27', color: '' },
            { id: 't-4', name: 'AUT 27', color: '' },
            { id: 't-5', name: 'WIN 28', color: '' },
            { id: 't-6', name: 'SPR 28', color: '' }
        ];
        this.courses = {};
        this.whitelist = [];
        this.tags = [];
        
        // Initialize Default Schedule
        this.activeScheduleId = 'sched-' + Date.now();
        this.schedules = {
            [this.activeScheduleId]: {
                name: 'Draft Schedule',
                lastModified: Date.now(),
                grid: {}
            }
        };
        
        this.compactMode = true;
        this.showBreakdown = false;
        this.selectedCourseId = null;
        this.pinnedNode = null;
    },

    updateCourseId(oldId, newId) {
        if (!this.courses[oldId]) return;
        
        // 1. Update course object key
        this.courses[newId] = this.courses[oldId];
        this.courses[newId].id = newId;
        delete this.courses[oldId];
        
        // 2. Update schedules
        Object.values(this.schedules).forEach(sched => {
            if (sched.grid[oldId]) {
                sched.grid[newId] = sched.grid[oldId];
                delete sched.grid[oldId];
            }
        });
        
        // 3. Update prereqs, coreqs, joint for other courses
        Object.values(this.courses).forEach(c => {
            c.prereqs = c.prereqs.map(req => req === oldId ? newId : req);
            c.coreqs = c.coreqs.map(req => req === oldId ? newId : req);
            c.joint = c.joint.map(req => req === oldId ? newId : req);
        });
        
        // 4. Update whitelist references
        this.whitelist = this.whitelist.map(req => req === oldId ? newId : req);
    },

    deleteCourse(courseId) {
        delete this.courses[courseId];
        
        Object.values(this.schedules).forEach(sched => {
            delete sched.grid[courseId];
        });
        
        Object.values(this.courses).forEach(c => {
            c.prereqs = c.prereqs.filter(req => req !== courseId);
            c.coreqs = c.coreqs.filter(req => req !== courseId);
            c.joint = c.joint.filter(req => req !== courseId);
        });
        
        this.whitelist = this.whitelist.filter(req => req !== courseId);
    },

    hydrate(parsed) {
        this.terms = parsed.terms || [];
        this.courses = parsed.courses || {};
        this.whitelist = parsed.whitelist || [];
        this.tags = parsed.tags || [];

        if (parsed.schedules && parsed.activeScheduleId) {
            this.schedules = parsed.schedules;
            this.activeScheduleId = parsed.activeScheduleId;
        } else if (parsed.schedule) {
            this.activeScheduleId = 'sched-' + Date.now();
            this.schedules = {
                [this.activeScheduleId]: {
                    name: 'Imported Schedule',
                    lastModified: Date.now(),
                    grid: parsed.schedule
                }
            };
        }

        // Legacy Grid Migration
        Object.values(this.schedules).forEach(sched => {
            for (const cId in sched.grid) {
                for (const tId in sched.grid[cId]) {
                    const cell = sched.grid[cId][tId];
                    if (typeof cell === 'object') {
                        if (cell.active) {
                            sched.grid[cId][tId] = !cell.hidden;
                        } else {
                            delete sched.grid[cId][tId];
                        }
                    }
                }
            }
        });
    }
};