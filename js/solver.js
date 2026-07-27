import { CpModel, CpSolver, CpSolverSolutionCallback, LinearExpr, setWorkerBridgeEnabled } from 'or-tools-wasm/cp-sat';

setWorkerBridgeEnabled(true);

class TopScheduleCollector extends CpSolverSolutionCallback {
    constructor(takes, courses, numTerms, limit) {
        super();
        this.takes = takes;
        this.courses = courses;
        this.numTerms = numTerms;
        this.limit = limit;
        this.solutions = [];
    }

    onSolutionCallback() {
        if (this.limit && this.solutions.length >= this.limit) return;

        const schedule = {};
        for (let t = 0; t < this.numTerms; t++) {
            const termCourses = [];
            for (const c of this.courses) {
                if (this.value(this.takes[c][t]) === 1) termCourses.push(c);
            }
            if (termCourses.length > 0) schedule[t] = termCourses;
        }
        this.solutions.push(schedule);
    }
}

export async function generateOptimalSchedule(parsedData, config) {
    const largeNumber = 100_000_000;

    const { minCredits = 1, maxCredits = 20, maxTerms = null, maxOptions = 5, maxTime = 5 } = config;
    const { allCourses: courses, availability, coursePrereqs: prereqs, whitelist, courseCredits: credits, tags, courseTags } = parsedData;
    const numTerms = maxTerms !== null ? Math.min(parsedData.numTerms, maxTerms) : parsedData.numTerms;

    function buildModelStructure() {
        const model = new CpModel();
        const takes = {};
        const isTaken = {};

        // 1. Core Variables & Hard Constraints
        for (const c of courses) {
            takes[c] = {};
            const termVars = [];
            for (let t = 0; t < numTerms; t++) {
                takes[c][t] = model.newBoolVar(`takes_${c}_t${t}`);
                termVars.push(takes[c][t]);
            }
            
            isTaken[c] = model.newBoolVar(`isTaken_${c}`);
            
            if (termVars.length > 0) {
                model.addMaxEquality(isTaken[c], termVars);
            } else {
                model.add(isTaken[c].eq(0));
            }

            // Ensures course is taken at most once
            model.addAtMostOne(termVars);

            for (let t = 0; t < numTerms; t++) {
                if (!availability[c].includes(t)) {
                    model.add(takes[c][t].eq(0));
                }
            }
        }

        // 2. Credit Limits
        for (let t = 0; t < numTerms; t++) {
            const isActiveTerm = model.newBoolVar(`active_term_${t}`);
            const termVars = courses.map(c => takes[c][t]);
            const termCoeffs = courses.map(c => credits[c]);
            
            model.addLinearConstraint(LinearExpr.weightedSum([...termVars, isActiveTerm], [...termCoeffs, -minCredits]), 0, largeNumber);
            model.addLinearConstraint(LinearExpr.weightedSum([...termVars, isActiveTerm], [...termCoeffs, -maxCredits]), -largeNumber, 0);
        }

        // 3. Prerequisite Chains
        for (const [course, reqList] of Object.entries(prereqs)) {
            if (!courses.includes(course)) continue;
            for (const req of reqList) {
                if (whitelist.has(req)) continue; 
                if (courses.includes(req)) {
                    model.addImplication(isTaken[course], isTaken[req]);
                    for (let tCourse = 0; tCourse < numTerms; tCourse++) {
                        for (let tReq = tCourse; tReq < numTerms; tReq++) {
                            model.addImplication(takes[course][tCourse], takes[req][tReq].not());
                        }
                    }
                }
            }
        }

        // 4. Dynamic Tag Constraints
        const objVars = [];
        const objCoeffs = [];

        for (const tag of tags) {
            if (!tag.constraints) continue;
            
            const { type, metric, min, max, weight } = tag.constraints;
            const taggedCourses = courses.filter(c => courseTags[c].includes(tag.id));
            if (taggedCourses.length === 0) continue;

            const vars = taggedCourses.map(c => isTaken[c]);
            const coeffMapping = taggedCourses.map(c => metric === 'credits' ? credits[c] : 1);

            if (type === 'mandatory-all') {
                taggedCourses.forEach(c => {
                    model.add(isTaken[c].eq(1));
                });
            }
            else if (type === 'mandatory-custom') {
                const lowerBound = min !== undefined && min !== '' ? parseInt(min) : 0;
                const parsedMax = parseInt(max);
                const upperBound = isNaN(parsedMax) ? largeNumber : parsedMax;
                model.addLinearConstraint(LinearExpr.weightedSum(vars, coeffMapping), lowerBound, upperBound);
            } 
            else if (type === 'optional') {
                const tagWeight = parseInt(weight) || 5;
                vars.forEach((v, idx) => {
                    objVars.push(v);
                    objCoeffs.push(coeffMapping[idx] * tagWeight);
                });
            }
        }

        const objectiveExpr = LinearExpr.weightedSum(objVars, objCoeffs);
        return { model, takes, objectiveExpr };
    }

    const pass1 = buildModelStructure();
    pass1.model.maximize(pass1.objectiveExpr);
    
    const solver1 = new CpSolver();
    solver1.parameters.maxTimeInSeconds = maxTime;
    
    const status1 = await solver1.solve(pass1.model);
    const statusString = solver1.statusName(status1);
    
    if (statusString !== 'OPTIMAL' && statusString !== 'FEASIBLE') {
        return { schedules: [], score: 0, status: statusString }; 
    }

    const bestScore = solver1.objectiveValue();
    const pass2 = buildModelStructure();
    pass2.model.addLinearConstraint(pass2.objectiveExpr, bestScore, bestScore);

    const solver2 = new CpSolver();
    solver2.parameters.maxTimeInSeconds = maxTime;
    solver2.parameters.enumerateAllSolutions = true;

    const collector = new TopScheduleCollector(pass2.takes, courses, numTerms, maxOptions);
    await solver2.solve(pass2.model, collector);

    return { schedules: collector.solutions, score: bestScore, status: statusString };
}