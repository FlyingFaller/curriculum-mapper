/**
 * Analyzes raw solver arrays to generate human-readable schedule names 
 * based on course rarity matrices, tags, and constraint priorities.
 */

export function processGeneratedSchedules(schedules, parsedData) {
    const total = schedules.length;
    const MAX_COURSES_IN_NAME = 3; // Configurable: 2 or 3 courses per name
    const INCLUDE_TERMS = false; // Configurable: Append (T#) to course names

    console.group(`\n  [Schedule Naming] Processing ${total} Schedules (Priority + Rarity)`);
    if (total === 0) {
        console.groupEnd();
        return { namedSchedules: [], debug: {} };
    }

    // --- Phase 1: Extract Instances and Credits ---
    const parsedSchedules = schedules.map((sched, idx) => {
        let totalCredits = 0;
        const instances = [];
        const termCredits = {};

        Object.entries(sched).forEach(([key, val]) => {
            const tIdx = parseInt(key);
            const tNum = tIdx + 1; // 1-based indexing for UI output (e.g., T1, T2)
            let tCreds = 0;

            if (Array.isArray(val)) {
                val.forEach(cId => {
                    const credits = parsedData.courseCredits[cId] || 0;
                    totalCredits += credits;
                    tCreds += credits;
                    instances.push({ cId, tIdx, tNum, credits });
                });
            }
            termCredits[tNum] = tCreds;
        });

        return { sched, idx, totalCredits, instances, termCredits };
    });

    const formatCourse = (inst) => INCLUDE_TERMS ? `${inst.cId} (T${inst.tNum})` : inst.cId;

    if (total === 1) {
        const s = parsedSchedules[0];
        const selected = s.instances.slice(0, MAX_COURSES_IN_NAME).map(formatCourse);
        const name = `${s.totalCredits}cr: ` + (selected.length > 0 ? selected.join(' ') : 'Core Schedule');
        console.groupEnd();
        return { namedSchedules: [{ schedule: s.sched, name, familyId: 1 }], debug: {} };
    }

    // --- Phase 2: Calculate Global Frequencies for Rarity ---
    const freq = {};
    parsedSchedules.forEach(s => {
        s.instances.forEach(inst => {
            const key = `${inst.cId}_T${inst.tNum}`;
            freq[key] = (freq[key] || 0) + 1;
        });
    });

    // --- Phase 3: Tag Categorization ---
    const courseCat = {};
    parsedData.allCourses.forEach(cId => {
        let isOptional = false;
        let maxWeight = 0;
        let isRequireSome = false;

        const cTags = parsedData.courseTags[cId] || [];
        cTags.forEach(tId => {
            const tag = parsedData.tags.find(t => t.id === tId);
            if (tag && tag.constraints) {
                if (tag.constraints.type === 'optional') {
                    isOptional = true;
                    maxWeight = Math.max(maxWeight, parseInt(tag.constraints.weight) || 5);
                } else if (tag.constraints.type === 'mandatory-custom') {
                    isRequireSome = true;
                }
            }
        });
        courseCat[cId] = { isOptional, maxWeight, isRequireSome };
    });

    // --- Phase 4: Step 5 Trigger Check ---
    let needsStep5 = false;
    const allFrequencies = Object.values(freq);
    
    // Check 1: Are all courses equally rare? (Frequencies are identical)
    const isEquallyRare = allFrequencies.length > 0 && allFrequencies.every(f => f === allFrequencies[0]);
    
    if (isEquallyRare) {
        needsStep5 = true;
    } else {
        // Check 2: Does any schedule lack rare courses entirely? (e.g., subset of another schedule)
        for (const s of parsedSchedules) {
            const minFrequency = Math.min(...s.instances.map(inst => freq[`${inst.cId}_T${inst.tNum}`]));
            if (minFrequency === total) {
                needsStep5 = true;
                break;
            }
        }
    }

    // --- Phase 5: Name Generation ---
    const namedSchedules = [];
    // const debugFamilies = {};

    parsedSchedules.forEach(s => {
        let nameSuffix = '';

        if (needsStep5) {
            // Step 5: Fallback to Credits per Term
            const termStrings = [];
            const sortedTerms = Object.keys(s.termCredits).map(Number).sort((a, b) => a - b);
            
            sortedTerms.forEach(tNum => {
                if (s.termCredits[tNum] > 0) {
                    termStrings.push(`${s.termCredits[tNum]}cr (T${tNum})`);
                }
            });
            nameSuffix = termStrings.join(', ');
            
        } else {
            // Steps 2, 3, and 4: Rank courses
            const ranked = [...s.instances].sort((a, b) => {
                const keyA = `${a.cId}_T${a.tNum}`;
                const keyB = `${b.cId}_T${b.tNum}`;
                const catA = courseCat[a.cId];
                const catB = courseCat[b.cId];
                const rarityA = freq[keyA];
                const rarityB = freq[keyB];

                // Priority 1: Optional Constraint
                if (catA.isOptional !== catB.isOptional) return catB.isOptional - catA.isOptional;
                if (catA.isOptional) {
                    if (rarityA !== rarityB) return rarityA - rarityB;                 // Sub-priority A: Rarity (asc)
                    if (catA.maxWeight !== catB.maxWeight) return catB.maxWeight - catA.maxWeight; // Sub-priority B: Weight (desc)
                }

                // Priority 2: Require Some Constraint
                if (catA.isRequireSome !== catB.isRequireSome) return catB.isRequireSome - catA.isRequireSome;
                
                // Priority 3: General Rarity
                if (rarityA !== rarityB) return rarityA - rarityB;

                // Priority 4: Tie-breaker (Alphabetical ID)
                return a.cId.localeCompare(b.cId);
            });

            const selected = ranked.slice(0, MAX_COURSES_IN_NAME).map(formatCourse);
            nameSuffix = selected.join(' ');
        }

        const finalName = `${s.totalCredits}cr: ` + (nameSuffix || 'Core Schedule');
        const fId = s.idx + 1;
        
        const termValues = Object.values(s.termCredits);
        const maxTermLoad = Math.max(...termValues);
        const sortedTermLoadsDesc = [...termValues].sort((a, b) => b - a);
        const sortedTermLoadsAsc = [...termValues].sort((a, b) => a - b);

        namedSchedules.push({ 
            schedule: s.sched, 
            name: finalName, 
            totalCredits: s.totalCredits, 
            maxTermLoad,
            sortedTermLoadsDesc,
            sortedTermLoadsAsc
        });
        // debugFamilies[`Sched ${fId}`] = finalName;
    });

    console.log(needsStep5 ? `  Triggered Step 5 Fallback (Credits per Term)` : `  Generated names via Rarity Pipeline`);
    console.groupEnd();
    
    return {
        namedSchedules,
        // debug: { freq, courseCat, needsStep5, families: debugFamilies }
    };
}