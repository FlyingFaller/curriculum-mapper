export const State = {
    // 1. Persistent Data (Saved to LocalStorage / Exported)
    terms: [], 
    courses: {}, 
    schedule: {}, 
    whitelist: [],
    tags: [],
    savedSchedules: [],
    
    // 2. Ephemeral UI State (Reset on reload)
    ui: {
        compactMode: false,
        showBreakdown: false,
        selectedCourseId: null,
        pinnedNode: null,
        hoveredScheduleId: null,
        pinnedScheduleId: null
    },

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
        this.schedule = {};
        this.whitelist = [];
        this.tags = [];
        this.savedSchedules = [];
        
        this.ui = {
            compactMode: false,
            showBreakdown: false,
            selectedCourseId: null,
            pinnedNode: null,
            hoveredScheduleId: null,
            pinnedScheduleId: null
        };
    },

    hydrate(parsed) {
        this.terms = parsed.terms || [];
        this.courses = parsed.courses || {};
        this.schedule = parsed.schedule || {};
        this.whitelist = parsed.whitelist || [];
        this.tags = parsed.tags || [];
        this.savedSchedules = parsed.savedSchedules || [];

        Object.values(this.courses).forEach(c => {
            c.tags = c.tags || []; 
        });
    }
};