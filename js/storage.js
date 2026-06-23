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
                State.hydrate(JSON.parse(data));
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
                State.hydrate(JSON.parse(e.target.result));
                Storage.save();
                UI.renderTable();
            } catch(err) { alert("Invalid JSON file"); }
        };
        reader.readAsText(file);
    }
};