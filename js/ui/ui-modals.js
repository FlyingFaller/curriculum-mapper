/**
 * Exclusively owns the DOM nodes for all modal dialogs. Handles opening, closing,
 * and extracting sanitized data from modal forms.
 */

import { State }        from '../state.js';
import { Utils }        from '../utils.js';
import { TemplateForm } from './templates/template-form.js';

export const UIModals = {
    elements: {},
    
    init() {
        const ids = [
            'term-modal', 'term-name', 'term-color', 
            'course-modal', 'course-modal-title', 'course-form', 'course-id', 'course-title', 
            'course-credits', 'course-color', 'course-prereqs', 'course-coreqs', 'course-joint', 
            'course-desc', 'course-tags-container',
            'tag-manager-modal', 'global-tags-list', 'tag-editor-modal', 'tag-editor-title',
            'tag-edit-id', 'tag-edit-name', 'tag-edit-color', 'tag-edit-icon-val', 'tag-edit-icons',
            'tag-edit-enable-constraints', 'tag-constraints-container', 'tag-edit-req-type',
            'tag-edit-metric', 'tag-edit-min', 'tag-edit-max', 'tag-edit-weight', 
            'tag-weight-container', 'tag-weight-val', 'tag-metric-container', 'tag-minmax-container',
            'whitelist-modal', 'whitelist-input',
            'confirm-modal', 'confirm-title', 'confirm-message', 'confirm-btn',
            'export-modal', 'export-format', 'export-options-container', 'export-ignore-hidden', 
            'export-ignore-bank', 'export-include-meta', 'export-meta-label'
        ];
        this.elements = ids.reduce((acc, id) => {
            const camelKey = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            acc[camelKey] = document.getElementById(id);
            return acc;
        }, {});
    },

    open(modalEl, focusEl = null) {
        if(modalEl) modalEl.classList.remove('hidden');
        if(focusEl) setTimeout(() => focusEl.focus(), 50);
    },
    
    closeAll() {
        [
            this.elements.termModal, this.elements.courseModal, 
            this.elements.whitelistModal, this.elements.tagManagerModal, 
            this.elements.tagEditorModal, this.elements.confirmModal,
            this.elements.exportModal
        ].forEach(el => { if (el) el.classList.add('hidden'); });
    },

    // --- Term Modal ---
    openTermModal() {
        this.elements.termName.dataset.id = '';
        this.elements.termName.value = '';
        Utils.setColoris(this.elements.termColor, '');
        this.open(this.elements.termModal, this.elements.termName);
    },
    editTerm(tId) {
        const term = State.terms.find(t => t.id === tId);
        if(!term) return;
        this.elements.termName.dataset.id = tId;
        this.elements.termName.value = term.name;
        Utils.setColoris(this.elements.termColor, term.color || '');
        this.open(this.elements.termModal);
    },
    getTermFormData() {
        return {
            id: this.elements.termName.dataset.id,
            name: this.elements.termName.value.trim(),
            color: this.elements.termColor.value
        };
    },

    // --- Course Modal ---
    openCourseModal() {
        this.elements.courseTagsContainer.innerHTML = TemplateForm.buildCourseTagsFormHTML([]);
        this.elements.courseForm.reset();
        this.elements.courseForm.dataset.originalId = '';
        this.elements.courseId.readOnly = false;
        Utils.setColoris(this.elements.courseColor, '');
        this.elements.courseModalTitle.innerText = "Add Course";
        this.open(this.elements.courseModal, this.elements.courseId);
    },
    editCourse(cId) {
        const c = State.courses[cId];
        if(!c) return;
        this.elements.courseTagsContainer.innerHTML = TemplateForm.buildCourseTagsFormHTML(c.tags || []);
        this.elements.courseForm.dataset.originalId = c.id;
        this.elements.courseId.value = c.id;
        this.elements.courseId.readOnly = false;
        this.elements.courseTitle.value = c.title;
        this.elements.courseCredits.value = c.credits;
        Utils.setColoris(this.elements.courseColor, c.color || '');
        this.elements.coursePrereqs.value = c.prereqs.join(', ');
        this.elements.courseCoreqs.value = c.coreqs.join(', ');
        this.elements.courseJoint.value = c.joint.join(', ');
        this.elements.courseDesc.value = c.desc;
        
        this.elements.courseModalTitle.innerText = "Edit Course";
        this.open(this.elements.courseModal);
    },
    getCourseFormData() {
        return {
            originalId: this.elements.courseForm.dataset.originalId,
            id: this.elements.courseId.value,
            title: this.elements.courseTitle.value.trim(),
            credits: parseInt(this.elements.courseCredits.value) || 0,
            prereqs: this.elements.coursePrereqs.value,
            coreqs: this.elements.courseCoreqs.value,
            joint: this.elements.courseJoint.value,
            desc: this.elements.courseDesc.value.trim(),
            color: this.elements.courseColor.value,
            tags: Array.from(document.querySelectorAll('.course-tag-checkbox:checked')).map(cb => cb.value)
        };
    },
    updateCourseTags(selectedTagIds = []) {
        this.elements.courseTagsContainer.innerHTML = TemplateForm.buildCourseTagsFormHTML(selectedTagIds);
    },

    // --- Tag Modals ---
    openTagManager() {
        this.elements.globalTagsList.innerHTML = TemplateForm.buildGlobalTagsHTML();
        this.open(this.elements.tagManagerModal);
    },
    updateGlobalTagsList() {
        this.elements.globalTagsList.innerHTML = TemplateForm.buildGlobalTagsHTML();
    },
    openTagEditor(tagId = null) {
        const tag = tagId ? State.tags.find(t => t.id === tagId) : {};
        const constraints = tag.constraints || {};
        
        this.elements.tagEditId.value = tagId || '';
        this.elements.tagEditorTitle.innerText = tagId ? 'Edit Tag' : 'Create Tag';
        this.elements.tagEditName.value = tag.name || '';
        Utils.setColoris(this.elements.tagEditColor, tag.color || '#3b82f6');
        
        const hasConstraints = !!tag.constraints;
        this.elements.tagEditEnableConstraints.checked = hasConstraints;
        this.elements.tagEditReqType.value = constraints.type || 'mandatory-all';
        this.elements.tagEditMetric.value = constraints.metric || 'courses';
        this.elements.tagEditMin.value = constraints.min !== undefined ? constraints.min : 1;
        this.elements.tagEditMax.value = constraints.max !== undefined ? constraints.max : '';
        
        const weight = constraints.weight || 5;
        this.elements.tagEditWeight.value = weight;
        this.elements.tagWeightVal.innerText = weight;
        
        this.toggleTagConstraints();
        this.renderIconPicker(tag.icon || 'ph-circle');
        this.open(this.elements.tagEditorModal, this.elements.tagEditName);
    },
    closeTagEditor() {
        this.elements.tagEditorModal.classList.add('hidden');
    },
    toggleTagConstraints() {
        const isEnabled = this.elements.tagEditEnableConstraints.checked;
        const reqType = this.elements.tagEditReqType.value;
        
        this.elements.tagConstraintsContainer.classList.toggle('opacity-60', !isEnabled);
        this.elements.tagEditReqType.disabled = !isEnabled;
        
        const enableMetric = isEnabled && reqType === 'mandatory-custom';
        const enableMinMax = isEnabled && reqType === 'mandatory-custom';
        const enableWeight = isEnabled && reqType === 'optional';
        
        this.elements.tagMetricContainer?.classList.toggle('opacity-40', !enableMetric);
        if (this.elements.tagEditMetric) this.elements.tagEditMetric.disabled = !enableMetric;
        
        this.elements.tagMinmaxContainer?.classList.toggle('opacity-40', !enableMinMax);
        if (this.elements.tagEditMin) this.elements.tagEditMin.disabled = !enableMinMax;
        if (this.elements.tagEditMax) this.elements.tagEditMax.disabled = !enableMinMax;
        
        this.elements.tagWeightContainer?.classList.toggle('opacity-40', !enableWeight);
        if (this.elements.tagEditWeight) this.elements.tagEditWeight.disabled = !enableWeight;
    },
    renderIconPicker(selectedIcon = null) {
        const currentColor = this.elements.tagEditColor.value || '#3b82f6';
        if (!selectedIcon) selectedIcon = this.elements.tagEditIconVal.value || 'ph-circle';
        this.elements.tagEditIcons.innerHTML = TemplateForm.buildIconPickerHTML(selectedIcon, currentColor);
        this.elements.tagEditIconVal.value = selectedIcon;
    },
    selectIcon(icon) {
        this.renderIconPicker(icon);
    },
    updateTagWeightDisplay(val) {
        this.elements.tagWeightVal.innerText = val;
    },
    getTagFormData() {
        return {
            idInput: this.elements.tagEditId.value,
            name: this.elements.tagEditName.value.trim(),
            color: this.elements.tagEditColor.value,
            icon: this.elements.tagEditIconVal.value || 'ph-circle',
            enableConstraints: this.elements.tagEditEnableConstraints.checked,
            reqType: this.elements.tagEditReqType.value,
            metric: this.elements.tagEditMetric.value,
            min: this.elements.tagEditMin.value,
            max: this.elements.tagEditMax.value,
            weight: this.elements.tagEditWeight.value
        };
    },

    // --- Export Modal ---
    openExportModal() {
        this.elements.exportFormat.value = 'json';
        this.toggleExportOptions();
        this.open(this.elements.exportModal, this.elements.exportFormat);
    },
    toggleExportOptions() {
        const format = this.elements.exportFormat.value;
        const isJson = format === 'json';
        this.elements.exportOptionsContainer.classList.toggle('hidden', isJson);
        this.elements.exportMetaLabel.classList.toggle('hidden', isJson || format.startsWith('pdf'));
    },
    getExportConfig() {
        return {
            format: this.elements.exportFormat.value,
            ignoreHidden: this.elements.exportIgnoreHidden.checked,
            ignoreBank: this.elements.exportIgnoreBank.checked,
            includeMeta: this.elements.exportIncludeMeta.checked
        };
    },

    // --- Whitelist & Confirm ---
    openWhitelistModal() {
        this.elements.whitelistInput.value = State.whitelist.join(', ');
        this.open(this.elements.whitelistModal, this.elements.whitelistInput);
    },
    getWhitelistData() {
        return this.elements.whitelistInput.value;
    },
    showConfirm(title, msg, onConfirmCallback) {
        this.elements.confirmTitle.innerText = title;
        this.elements.confirmMessage.innerText = msg;
        this.open(this.elements.confirmModal);
        
        this.elements.confirmBtn.onclick = () => {
            this.closeConfirm();
            onConfirmCallback();
        };
    },
    closeConfirm() {
        this.elements.confirmModal.classList.add('hidden');
    }
};