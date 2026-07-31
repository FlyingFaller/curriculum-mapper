/**
 * Handles all  logic and CRUD operations for the core curriculum data structures
 * (Courses, Terms, Tags, and the Global Whitelist).
 */

import { State } from '../state.js';
import { Storage } from '../storage.js';
import { UIModals } from '../ui/ui-modals.js';
import { UIRenderer } from '../ui/ui-renderer.js';
import { Utils } from '../utils.js';
import { GridController } from './grid-controller.js';

export const EntityController = {
    saveWhitelist() {
        const rawInput = UIModals.getWhitelistData();
        State.whitelist = Utils.parseList(rawInput);
        Storage.save();
        UIModals.closeAll();
        UIRenderer.renderTable();
    },

    saveCourse() {
        const formData = UIModals.getCourseFormData();
        const id = Utils.sanitizeId(formData.id);
        if(!id) return alert("Course ID is required.");
        
        if (formData.originalId && formData.originalId !== id) {
            if (State.courses[id]) return alert("A course with this new ID already exists!");
            State.updateCourseId(formData.originalId, id);
        }
        
        State.courses[id] = {
            id: id,
            title: formData.title,
            credits: formData.credits,
            prereqs: Utils.parseList(formData.prereqs),
            coreqs: Utils.parseList(formData.coreqs),
            joint: Utils.parseList(formData.joint),
            tags: formData.tags,
            desc: formData.desc,
            color: formData.color
        };
        
        Storage.save();
        UIModals.closeAll();
        UIRenderer.renderTable();
    },

    deleteCourse(courseId, bypass = false) {
        const execute = () => {
            if (State.pinnedNode && State.pinnedNode.cId === courseId) GridController.clearPin();
            if (State.selectedCourseId === courseId) State.selectedCourseId = null;
            State.deleteCourse(courseId);
            Storage.save();
            UIRenderer.renderTable();
        };
        if (bypass) execute();
        else UIModals.showConfirm("Delete Course", `Delete course ${courseId} completely?`, execute);
    },

    saveTerm() {
        const formData = UIModals.getTermFormData();
        if (!formData.name) return;
        
        if (formData.id) {
            const term = State.terms.find(t => t.id === formData.id);
            if (term) {
                term.name = formData.name;
                term.color = formData.color;
            }
        } else {
            const newId = 't-' + Date.now();
            State.terms.push({ id: newId, name: formData.name, color: formData.color });
        }
        
        Storage.save();
        UIModals.closeAll();
        UIRenderer.renderTable();
    },

    deleteTerm(termId, bypass = false) {
        const execute = () => {
            State.terms = State.terms.filter(t => t.id !== termId);
            Object.values(State.schedules).forEach(sched => {
                Object.keys(sched.grid).forEach(cId => {
                    if (sched.grid[cId][termId]) delete sched.grid[cId][termId];
                });
            });
            Storage.save();
            UIRenderer.renderTable();
        };
        if (bypass) execute();
        else UIModals.showConfirm("Delete Term", "Delete this term and all course assignments in it?", execute);
    },

    saveTag() {
        const formData = UIModals.getTagFormData();
        if (!formData.name) return alert("Tag name is required");
        
        let constraints = null;
        if (formData.enableConstraints) {
            const maxVal = formData.max;
            constraints = {
                type: formData.reqType,
                metric: formData.metric,
                min: parseInt(formData.min) || 0,
                max: maxVal ? parseInt(maxVal) : null,
                weight: parseInt(formData.weight) || 5
            };
        }
        
        let newTagId = null;
        if (formData.idInput) {
            const tag = State.tags.find(t => t.id === formData.idInput);
            if (tag) {
                tag.name = formData.name; 
                tag.color = formData.color; 
                tag.icon = formData.icon; 
                tag.constraints = constraints;
            }
        } else {
            newTagId = 'tag-' + Date.now();
            State.tags.push({ id: newTagId, name: formData.name, color: formData.color, icon: formData.icon, constraints });
        }
        
        Storage.save();
        UIModals.closeTagEditor();
        UIModals.updateGlobalTagsList();
        
        const courseData = UIModals.getCourseFormData();
        const checkedBoxes = courseData.tags;
        if (newTagId) checkedBoxes.push(newTagId);
        UIModals.updateCourseTags(checkedBoxes);
        UIRenderer.renderBody(); 
    },

    deleteTag(tagId, bypass = false) {
        const execute = () => {
            State.tags = State.tags.filter(t => t.id !== tagId);
            Object.values(State.courses).forEach(c => c.tags = (c.tags || []).filter(t => t !== tagId));
            Storage.save();
            UIModals.updateGlobalTagsList();
            UIModals.updateCourseTags();
            UIRenderer.renderTable();
        };
        if (bypass) execute();
        else UIModals.showConfirm("Delete Tag", "Are you sure? This will remove the tag from all courses.", execute);
    }
};