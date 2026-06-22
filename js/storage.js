import { State } from './state.js';
import { UI } from './ui.js';

export const Storage = {
    save() {
        localStorage.setItem('curriculumMap', JSON.stringify({
            terms: State.terms,
            courses: State.courses,
            schedule: State.schedule,
            whitelist: State.whitelist,
            tags: State.tags
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
                State.whitelist = parsed.whitelist || [];
                State.tags = parsed.tags || [];

                // BACKWARD COMPATIBILITY: Ensure older courses have a tags array
                Object.values(State.courses).forEach(c => {
                    c.tags = c.tags || []; 
                });

                return true;
            } catch(e) { console.error("Failed to load map", e); }
        }
        return false;
    },
    exportData() {
        const data = JSON.stringify({
            terms: State.terms,
            courses: State.courses,
            schedule: State.schedule,
            whitelist: State.whitelist,
            tags: State.tags
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
                State.whitelist = parsed.whitelist || [];
                State.tags = parsed.tags || [];
                Storage.save();
                UI.renderTable();
            } catch(err) { alert("Invalid JSON file"); }
        };
        reader.readAsText(file);
    }
};