export const State = {
    terms: [], 
    courses: {}, 
    schedule: {}, 
    whitelist: [],
    tags: [],
    
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
    },

    hydrate(parsed) {
        this.terms = parsed.terms || [];
        this.courses = parsed.courses || {};
        this.schedule = parsed.schedule || {};
        this.whitelist = parsed.whitelist || [];
        this.tags = parsed.tags || [];

        // BACKWARD COMPATIBILITY: Ensure older courses have a tags array
        Object.values(this.courses).forEach(c => {
            c.tags = c.tags || []; 
        });
    }
};