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
    
    // Ephemeral UI State
    compactMode: false,
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
        
        this.compactMode = false;
        this.showBreakdown = false;
        this.selectedCourseId = null;
        this.pinnedNode = null;
    },

    hydrate(parsed) {
        this.terms = parsed.terms || [];
        this.courses = parsed.courses || {};
        this.whitelist = parsed.whitelist || [];
        this.tags = parsed.tags || [];

        // Support new schema or migrate legacy schema
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
    }
};