/**
 * Parses the nested UI state object into the flattened, numerical data structures 
 * required by the solver.
 */

export function parseCurriculumState(state) {
    const termIds = state.terms.map(t => t.id);
    const termNames = {};
    state.terms.forEach(t => termNames[t.id] = t.name);
    const numTerms = termIds.length;

    const whitelist = new Set(state.whitelist || []);
    const courseCredits = {};
    const coursePrereqs = {};
    const courseTags = {};

    const allCourses = Object.keys(state.courses);
    
    for (const cId of allCourses) {
        const cData = state.courses[cId];
        courseCredits[cId] = cData.credits || 0;
        coursePrereqs[cId] = cData.prereqs || [];
        courseTags[cId] = cData.tags || [];
    }

    const availability = {};
    allCourses.forEach(cId => {
        availability[cId] = [];
        const termData = state.activeGrid[cId];
        if (termData) {
            termIds.forEach((tId, tIdx) => {
                if (termData[tId] === true) {
                    availability[cId].push(tIdx);
                }
            });
        }
    });

    return {
        numTerms,
        termNames,
        termIds,
        courseCredits,
        coursePrereqs,
        availability,
        tags: state.tags,
        courseTags,
        whitelist,
        allCourses
    };
}