/**
 * Pure functions that consume state data and return parameterized HTML strings 
 * for dynamic modal elements (e.g., the icon picker grid, dynamic tag checkboxes).
 */

import { State } from '../../state.js';

export const TemplateForm = {
    buildGlobalTagsHTML() {
        return State.tags.map(tag => {
            const iconClass = tag.icon || 'ph-circle';
            return `
            <div class="flex justify-between items-center bg-canvas border border-border rounded p-2">
                <div class="flex items-center gap-2">
                    <i class="ph-fill ${iconClass} text-lg drop-shadow-sm" style="color: ${tag.color}"></i>
                    <span class="text-sm font-medium">${tag.name}</span>
                </div>
                <div class="flex gap-1">
                    <button data-action="open-tag-editor" data-cid="${tag.id}" class="btn-icon"><i class="ph ph-pencil-simple text-base"></i></button>
                    <button data-action="delete-tag" data-cid="${tag.id}" class="btn-icon-danger"><i class="ph ph-trash text-base"></i></button>
                </div>
            </div>`;
        }).join('');
    },

    buildCourseTagsFormHTML(selectedTagIds = []) {
        if (State.tags.length === 0) return `<span class="text-caption text-text-muted italic">No tags available. Create one!</span>`;
        return State.tags.map(tag => {
            const isChecked = selectedTagIds.includes(tag.id) ? 'checked' : '';
            const iconClass = tag.icon || 'ph-circle';
            return `
            <label class="flex items-center gap-1.5 px-2 py-1 bg-surface border border-border rounded cursor-pointer hover:bg-surface-hover">
                <input type="checkbox" value="${tag.id}" class="course-tag-checkbox accent-accent" ${isChecked}>
                <i class="ph-fill ${iconClass} text-sm drop-shadow-sm" style="color: ${tag.color}"></i>
                <span class="text-caption font-medium">${tag.name}</span>
            </label>`;
        }).join('');
    },

    buildIconPickerHTML(selectedIcon, currentColor) {
        const icons = [
            'ph-circle', 'ph-star', 'ph-book-open', 'ph-certificate', 'ph-globe', 'ph-shapes', 'ph-compass', 'ph-palette', 
            'ph-flask', 'ph-math-operations', 'ph-translate', 'ph-code', 'ph-bookmark-simple', 'ph-push-pin', 'ph-warning', 'ph-check-circle',
            'ph-lock', 'ph-lock-simple-open', 'ph-shopping-cart', 'ph-arrow-clockwise', 'ph-asterisk', 'ph-book', 'ph-brackets-angle', 'ph-calculator',
            'ph-calendar-blank', 'ph-check-circle', 'ph-diamond', 'ph-flower', 'ph-gear', 'ph-globe-hemisphere-west', 'ph-hamburger', 'ph-hand', 'ph-hands-praying',
            'ph-heart', 'ph-hexagon', 'ph-key', 'ph-music-notes', 'ph-octagon', 'ph-parallelogram', 'ph-paragraph', 'ph-password', 'ph-pi', 'ph-placeholder',
            'ph-plant', 'ph-question', 'ph-seal', 'ph-shield', 'ph-skull', 'ph-smiley', 'ph-smiley-angry', 'ph-smiley-meh', 'ph-smiley-melting', 'ph-smiley-nervous',
            'ph-smiley-sad', 'ph-smiley-x-eyes', 'ph-sparkle', 'ph-star-four', 'ph-tag', 'ph-tag-chevron', 'ph-tag-simple', 'ph-triangle', 'ph-trophy', 'ph-x'
        ];
        return icons.map(icon => {
            const isSelected = icon === selectedIcon;
            const activeClass = isSelected ? 'border-accent bg-accent-bg' : 'border-transparent text-text-muted hover:bg-surface-hover';
            const styleStr = isSelected ? `style="color: ${currentColor};"` : '';
            return `<button type="button" data-action="select-icon" data-value="${icon}" class="flex justify-center items-center p-1 border rounded cursor-pointer transition-colors ${activeClass}">
                <i class="ph-fill ${icon} text-lg drop-shadow-sm" ${styleStr}></i>
            </button>`;
        }).join('');
    }
};