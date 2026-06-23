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
    // The new master function triggered by the Modal's "Download" button
    executeExport() {
        const format = UI.elements.exportFormat.value;
        const config = {
            ignoreHidden: UI.elements.exportIgnoreHidden.checked,
            ignoreBank: UI.elements.exportIgnoreBank.checked,
            includeMeta: UI.elements.exportIncludeMeta.checked
        };

        UI.modals.closeAll(); // Close modal immediately to give snappy feedback

        switch (format) {
            case 'json':
                this._exportJSON();
                break;
            case 'pdf':
                this._exportPDF(config);
                break;
            case 'csv':
            case 'xlsx':
                this._exportSpreadsheet(format, config);
                break;
            default:
                console.error("Unknown export format requested.");
        }
    },

    // Your original JSON export logic, slightly renamed
    _exportJSON() {
        const data = JSON.stringify({
            terms: State.terms,
            courses: State.courses,
            schedule: State.schedule,
            whitelist: State.whitelist,
            tags: State.tags
        }, null, 2);
        
        const blob = new Blob([data], { type: "application/json" });
        this._triggerDownload(blob, "curriculum_map.json");
    },

    // Stubs for the new libraries
    // Update the switch statement in executeExport():
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

    // ------------------------------------------
    // PDF OPTION 1: Native Print Engine
    // ------------------------------------------
    _exportPDFPrint(config) {
        // Temporarily apply configuration classes to body
        if (config.ignoreHidden) document.body.classList.add('print-ignore-hidden');
        
        // Let the CSS @media print block handle everything
        window.print();

        // Cleanup
        setTimeout(() => document.body.classList.remove('print-ignore-hidden'), 1000);
    },

    // ------------------------------------------
    // PDF OPTION 2: Image Capture (html2pdf)
    // ------------------------------------------
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
                // Provide enough virtual window width for off-screen columns, but DO NOT force x/y coordinates
                windowWidth: originalTable.scrollWidth + 50,
                windowHeight: originalTable.scrollHeight + 50,
                onclone: (clonedDoc) => {
                    const clonedTable = clonedDoc.getElementById('schedule-table');
                    
                    const style = clonedDoc.createElement('style');
                    style.innerHTML = `
                        /* Erase interactive UI */
                        header, #info-footer, .card-action-menu, .btn-icon, .btn-icon-danger, button {
                            display: none !important;
                        }
                        /* Zero-out parent padding and release layout constraints to fix alignment gap and cutoff */
                        body, main, .table-container {
                            width: max-content !important;
                            height: auto !important;
                            max-width: none !important;
                            max-height: none !important;
                            overflow: visible !important;
                            padding: 0 !important;
                            margin: 0 !important;
                        }
                        .sticky-col {
                            position: static !important;
                            box-shadow: none !important;
                            border-right: 1px solid var(--border-color) !important;
                        }
                        ${config.ignoreHidden ? '.hidden-instance { display: none !important; }' : ''}
                        ${UI.compactMode ? `
                            .compact-table th:first-child,
                            .compact-table .course-bank-cell,
                            .compact-table .sticky-bottom-row td:first-child {
                                display: none !important;
                            }
                        ` : ''}
                    `;
                    clonedDoc.head.appendChild(style);

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

    // ------------------------------------------
    // SPREADSHEET EXPORTS (CSV / XLSX)
    // ------------------------------------------
    _exportSpreadsheet(format, config) {
        if (!window.XLSX) {
            return alert("Spreadsheet library is still loading. Please try again in a moment.");
        }

        let exportRows = [];

        // Helper to convert tag IDs into readable names
        const getTagNames = (tagIds) => {
            if (!tagIds || tagIds.length === 0) return "";
            return tagIds.map(tId => {
                const tag = State.tags.find(t => t.id === tId);
                return tag ? tag.name : "";
            }).filter(Boolean).join(", ");
        };

        // 1. Iterate through Terms chronologically
        State.terms.forEach(term => {
            // Sort courses alphabetically for a clean spreadsheet
            const sortedCourseIds = Object.keys(State.courses).sort();
            
            sortedCourseIds.forEach(cId => {
                const course = State.courses[cId];
                const cell = State.schedule[cId]?.[term.id];

                if (cell && cell.active) {
                    if (config.ignoreHidden && cell.hidden) return; // Apply Hidden Filter

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

        // 2. Sweep for Unscheduled Courses (if not ignored)
        if (!config.ignoreBank) {
            const sortedCourseIds = Object.keys(State.courses).sort();
            
            sortedCourseIds.forEach(cId => {
                const course = State.courses[cId];
                const sched = State.schedule[cId];
                
                // Check if it's active in ANY term
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

        // 3. Check if we have data to export
        if (exportRows.length === 0) {
            return alert("No courses match your export configuration.");
        }

        // 4. Generate the Workbook using SheetJS
        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Curriculum Map");

        // Set column widths for better readability in Excel
        if (config.includeMeta) {
            worksheet['!cols'] = [
                { wch: 20 }, // Term
                { wch: 12 }, // Course ID
                { wch: 35 }, // Title
                { wch: 8 },  // Credits
                { wch: 20 }, // Tags
                { wch: 20 }, // Prereqs
                { wch: 15 }, // Coreqs
                { wch: 15 }, // Joint
                { wch: 80 }  // Description
            ];
        } else {
            worksheet['!cols'] = [ { wch: 20 }, { wch: 12 }, { wch: 35 }, { wch: 8 } ];
        }

        // 5. Trigger the download (SheetJS handles the format difference via the file extension automatically)
        const filename = format === 'csv' ? 'Curriculum_Map.csv' : 'Curriculum_Map.xlsx';
        XLSX.writeFile(workbook, filename);
    },

    // A helper method to keep code DRY
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
                UI.renderTable();
            } catch(err) { alert("Invalid JSON file"); }
        };
        reader.readAsText(file);
    }
};