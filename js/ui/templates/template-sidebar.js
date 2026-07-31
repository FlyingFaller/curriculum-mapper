/**
 * Pure functions that consume state data and return parameterized HTML strings 
 * for schedule list items, generator loading states, and solver error notices.
 */

export const TemplateSidebar = {
    buildEmptyState(message) {
        return `
            <div class="text-caption text-text-muted italic p-3 text-center border border-dashed border-border rounded bg-canvas">
                ${message}
            </div>`;
    },

    buildSavedScheduleCard(id, sched, isPinned, anyPinned) {
        let activeClass = '';
        let textClass = '';
        
        if (isPinned) {
            activeClass = 'selected-card bg-[var(--color-hover)] shadow-md';
            textClass = 'text-white';
        } else if (anyPinned) {
            activeClass = 'border-border bg-surface group-hover:bg-surface-hover group-hover:border-border-focus';
            textClass = 'text-text-main group-hover:text-text-main';
        } else {
            activeClass = 'border-border bg-surface group-hover:bg-[var(--color-hover)] group-hover:border-[var(--color-hover)]';
            textClass = 'text-text-main group-hover:text-white';
        }
        
        return `
        <div class="schedule-item py-1 w-full cursor-pointer group" data-sid="${id}" data-action="toggle-pin-schedule" data-value="${id}">
            <div class="border ${activeClass} rounded-md shadow-sm p-2 flex items-center relative transition-colors duration-200">
                <span class="text-sm font-medium ${textClass} transition-colors truncate text-left w-full" title="${sched.name}">${sched.name}</span>
                <div class="card-action-menu top-0.5 right-0.5">
                    <button data-action="switch-schedule" data-value="${id}" class="btn-icon" title="Make Active"><i class="ph ph-arrow-right text-base leading-none"></i></button>
                    <button data-action="delete-schedule" data-value="${id}" class="btn-icon-danger" title="Delete Schedule"><i class="ph ph-trash text-base leading-none"></i></button>
                </div>
            </div>
        </div>`;
    },

    buildGeneratedScheduleCard(id, sched, index, isPinned, anyPinned) {
        let activeClass = '';
        let textClass = '';
        
        if (isPinned) {
            activeClass = 'selected-card bg-[var(--color-hover)] shadow-md';
            textClass = 'text-white';
        } else if (anyPinned) {
            activeClass = 'border-border bg-surface group-hover:bg-surface-hover group-hover:border-border-focus';
            textClass = 'text-text-main group-hover:text-text-main';
        } else {
            activeClass = 'border-border bg-surface group-hover:bg-[var(--color-hover)] group-hover:border-[var(--color-hover)]';
            textClass = 'text-text-main group-hover:text-white';
        }
        
        return `
        <div class="schedule-item pt-2 pb-1 w-full cursor-pointer group" data-sid="${id}" data-action="toggle-pin-schedule" data-value="${id}">
            <div class="border ${activeClass} rounded-md shadow-sm p-2 flex items-center relative transition-colors duration-200">
                <span class="absolute -top-2 -left-1 px-1 text-micro font-bold text-text-muted bg-surface z-10 leading-none group-hover:text-text-main transition-colors">
                    ${index + 1}
                </span>
                <span class="text-sm font-medium ${textClass} transition-colors truncate text-left w-full" title="${sched.name}">${sched.name}</span>
                <div class="card-action-menu top-0.5 right-0.5">
                    <button data-action="switch-schedule" data-value="${id}" class="btn-icon" title="Save and Make Active"><i class="ph ph-floppy-disk text-base leading-none"></i></button>
                    <button data-action="delete-schedule" data-value="${id}" class="btn-icon-danger" title="Discard Result"><i class="ph ph-trash text-base leading-none"></i></button>
                </div>
            </div>
        </div>`;
    },
    
    buildGeneratorButtonContent(isLoading, elapsed = 0) {
        if (isLoading) {
            return `<i class="ph ph-spinner animate-spin text-lg"></i> <span>Calculating (${elapsed}s)</span>`;
        }
        return `<i class="ph-bold ph-play"></i> <span>Generate</span>`;
    },

    buildGeneratorError(statusCode, isFatal = false, message = '') {
        if (isFatal) {
            return `
                <div class="text-caption text-danger-main p-3 text-center border border-dashed border-danger-border bg-danger-bg rounded mt-1 break-words">
                    <strong>Error:</strong><br>${message || 'Check the console for details.'}
                </div>`;
        }
        return `
            <div class="text-caption text-danger-main p-3 text-center border border-dashed border-danger-border bg-danger-bg rounded mt-1">
                <strong>Status: ${statusCode}</strong><br>The solver could not fit the degree requirements with the current constraints.
            </div>`;
    }
};