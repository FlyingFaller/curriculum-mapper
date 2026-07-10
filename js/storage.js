import { State } from './state.js';
import { UI } from './ui.js';

export const Storage = {
    save() {
        localStorage.setItem('curriculumMap', JSON.stringify({
            terms: State.terms,
            courses: State.courses,
            schedules: State.schedules,
            activeScheduleId: State.activeScheduleId,
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
    
    executeExport() {
        const format = UI.elements.exportFormat.value;
        const config = {
            ignoreHidden: UI.elements.exportIgnoreHidden.checked,
            ignoreBank: UI.elements.exportIgnoreBank.checked,
            includeMeta: UI.elements.exportIncludeMeta.checked
        };

        UI.modals.closeAll(); 

        switch (format) {
            case 'json':
                this._exportJSON();
                break;
            case 'pdf-print':
                this._exportPDFPrint(config);
                break;
            case 'pdf-image':
                this._exportPDFImage(config);
                break;
            case 'csv':
            case 'xlsx':
                this._exportSpreadsheet(format, config);
                break;
            default:
                console.error("Unknown export format.");
        }
    },

    _exportJSON() {
        const data = JSON.stringify({
            terms: State.terms,
            courses: State.courses,
            schedules: State.schedules,
            activeScheduleId: State.activeScheduleId,
            whitelist: State.whitelist,
            tags: State.tags
        }, null, 2);
        
        const blob = new Blob([data], { type: "application/json" });
        this._triggerDownload(blob, "curriculum_map.json");
    },

    _exportPDFPrint(config) {
        if (config.ignoreHidden) document.body.classList.add('print-ignore-hidden');
        window.print();
        setTimeout(() => document.body.classList.remove('print-ignore-hidden'), 1000);
    },

    _exportPDFImage(config) {
        const originalTable = document.getElementById('schedule-table');
        if (!originalTable) return;

        const currentBgColor = getComputedStyle(document.body).getPropertyValue('--bg-canvas').trim() || '#f8f7fa';

        const container = originalTable.closest('.table-container');
        let prevScrollX = 0, prevScrollY = 0;
        if (container) {
            prevScrollX = container.scrollLeft;
            prevScrollY = container.scrollTop;
            container.scrollLeft = 0;
            container.scrollTop = 0;
        }

        const opt = {
            margin:       0,
            filename:     'Curriculum_Map.pdf',
            image:        { type: 'jpeg', quality: 1.0 },
            pagebreak:    { mode: 'avoid-all', avoid: 'tr' }, 
            html2canvas:  { 
                scale: 2, 
                useCORS: true,
                backgroundColor: currentBgColor,
                scrollX: 0,
                scrollY: 0,
                windowWidth: originalTable.scrollWidth + 50,
                windowHeight: originalTable.scrollHeight + 50,
                onclone: (clonedDoc) => {
                    const clonedTable = clonedDoc.getElementById('schedule-table');
                    
                    // Attach PDF rendering classes (styles mapped in styles.css)
                    clonedDoc.body.classList.add('pdf-export-mode');
                    if (config.ignoreHidden) clonedDoc.body.classList.add('pdf-ignore-hidden');
                    if (State.compactMode) clonedDoc.body.classList.add('pdf-compact-mode');

                    // Scrub dynamic interactive states
                    clonedTable.querySelectorAll('.card-node').forEach(node => {
                        node.className = node.className.replace(/\bhl-[^\s]+\b/g, '').trim();
                        node.classList.remove('selected-card');
                    });
                }
            },
            jsPDF: { unit: 'in', format: 'a3', orientation: 'landscape' } 
        };

        html2pdf().set(opt).from(originalTable).save().then(() => {
            if (container) {
                container.scrollLeft = prevScrollX;
                container.scrollTop = prevScrollY;
            }
        }).catch(err => {
            console.error("PDF generation failed:", err);
            alert("There was an error generating the PDF.");
            if (container) {
                container.scrollLeft = prevScrollX;
                container.scrollTop = prevScrollY;
            }
        });
    },

    _exportSpreadsheet(format, config) {
        if (!window.XLSX) {
            return alert("Spreadsheet library is still loading. Please try again in a moment.");
        }

        const activeGrid = State.schedules[State.activeScheduleId]?.grid || {};

        let exportRows = [];

        const getTagNames = (tagIds) => {
            if (!tagIds || tagIds.length === 0) return "";
            return tagIds.map(tId => {
                const tag = State.tags.find(t => t.id === tId);
                return tag ? tag.name : "";
            }).filter(Boolean).join(", ");
        };

        State.terms.forEach(term => {
            const sortedCourseIds = Object.keys(State.courses).sort();
            
            sortedCourseIds.forEach(cId => {
                const course = State.courses[cId];
                const cell = activeGrid[cId]?.[term.id];

                if (cell && cell.active) {
                    if (config.ignoreHidden && cell.hidden) return; 

                    let row = {
                        "Term": term.name,
                        "Course ID": course.id,
                        "Title": course.title,
                        "Credits": course.credits
                    };

                    if (config.includeMeta) {
                        row["Tags"] = getTagNames(course.tags);
                        row["Prerequisites"] = course.prereqs.join(", ");
                        row["Corequisites"] = course.coreqs.join(", ");
                        row["Jointly Offered"] = course.joint ? course.joint.join(", ") : "";
                        row["Description"] = course.desc;
                    }

                    exportRows.push(row);
                }
            });
        });

        if (!config.ignoreBank) {
            const sortedCourseIds = Object.keys(State.courses).sort();
            
            sortedCourseIds.forEach(cId => {
                const course = State.courses[cId];
                const sched = activeGrid[cId];
                
                let isScheduled = false;
                if (sched) {
                    isScheduled = Object.values(sched).some(cell => cell.active);
                }

                if (!isScheduled) {
                    let row = {
                        "Term": "Unscheduled (Bank)",
                        "Course ID": course.id,
                        "Title": course.title,
                        "Credits": course.credits
                    };

                    if (config.includeMeta) {
                        row["Tags"] = getTagNames(course.tags);
                        row["Prerequisites"] = course.prereqs.join(", ");
                        row["Corequisites"] = course.coreqs.join(", ");
                        row["Jointly Offered"] = course.joint ? course.joint.join(", ") : "";
                        row["Description"] = course.desc;
                    }

                    exportRows.push(row);
                }
            });
        }

        if (exportRows.length === 0) {
            return alert("No courses match your export configuration.");
        }

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Curriculum Map");

        if (config.includeMeta) {
            worksheet['!cols'] = [
                { wch: 20 }, { wch: 12 }, { wch: 35 }, { wch: 8 },
                { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 80 }
            ];
        } else {
            worksheet['!cols'] = [ { wch: 20 }, { wch: 12 }, { wch: 35 }, { wch: 8 } ];
        }

        const filename = format === 'csv' ? 'Curriculum_Map.csv' : 'Curriculum_Map.xlsx';
        XLSX.writeFile(workbook, filename);
    },

    _triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
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
                UI.renderSidebarSchedules();
                UI.renderTable();
            } catch(err) { alert("Invalid JSON file"); }
        };
        reader.readAsText(file);
    }
};