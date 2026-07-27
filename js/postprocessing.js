/**
 * Processes generated schedules into unique, descriptive names using 
 * a Minimum Hitting Set architecture, calculating Total Credits dynamically.
 */
export function processGeneratedSchedules(schedules, courseCredits = {}) {
    const total = schedules.length;
    
    console.group(`\n🚀 [Schedule Naming] Processing ${total} Schedules (Hitting Set + Dynamic Credits)`);

    if (total === 0) {
        console.groupEnd();
        return { namedSchedules: [], debug: {} }; 
    }
    if (total === 1) {
        console.groupEnd();
        return { namedSchedules: [{ schedule: schedules[0], name: "Optimal Schedule", familyId: 1 }], debug: {} }; 
    }

    const tupleFreq = {}; 
    
    // --- Phase 1: Robust Tuple Extraction & Dynamic Credit Calculation ---
    const parsedData = schedules.map((sched, idx) => {
        const tuples = new Set();
        let totalCredits = 0;
        
        Object.entries(sched).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                const tNum = parseInt(key) + 1; 
                val.forEach(c => {
                    tuples.add(`${c}_T${tNum}`);
                    // Dynamically calculate credits using the injected dictionary
                    totalCredits += (courseCredits[c] || 0); 
                });
            }
        });

        if (totalCredits > 0) {
            tuples.add(`Credits_${totalCredits}`);
        }
        
        const tupleArray = Array.from(tuples);
        tupleArray.forEach(t => tupleFreq[t] = (tupleFreq[t] || 0) + 1);
        return { sched, idx, tuples: tupleArray };
    });

    const candidateTuples = new Set(
        Object.keys(tupleFreq).filter(t => tupleFreq[t] > 0 && tupleFreq[t] < total)
    );

    // --- Phase 2: Rapid Symmetric Differences ---
    let unresolvedPairs = [];
    
    for (let i = 0; i < total; i++) {
        const tuplesA = new Set(parsedData[i].tuples);
        
        for (let j = i + 1; j < total; j++) {
            const diff = [];
            const tuplesB = new Set(parsedData[j].tuples);
            
            tuplesA.forEach(t => { if (!tuplesB.has(t) && candidateTuples.has(t)) diff.push(t); });
            tuplesB.forEach(t => { if (!tuplesA.has(t) && candidateTuples.has(t)) diff.push(t); });
            
            if (diff.length > 0) unresolvedPairs.push(diff);
        }
    }

    // --- Phase 3: Greedy Hitting Set Algorithm ---
    const hittingSet = [];
    
    while (unresolvedPairs.length > 0) {
        const coverage = new Map();
        
        unresolvedPairs.forEach(diff => {
            diff.forEach(t => coverage.set(t, (coverage.get(t) || 0) + 1));
        });

        let bestTuple = null;
        let maxCover = 0;
        
        for (const [t, count] of coverage.entries()) {
            if (count > maxCover) {
                maxCover = count;
                bestTuple = t;
            }
        }

        if (!bestTuple) break; 

        hittingSet.push(bestTuple);
        unresolvedPairs = unresolvedPairs.filter(diff => !diff.includes(bestTuple));
    }

    console.log(`🎯 Minimal Hitting Set (Master Pool):`, hittingSet);
    console.log(`📏 Length of Hitting Set: ${hittingSet.length}`);

    // --- Phase 4: Output Generation ---
    const namedSchedules = [];
    const debugFamilies = {};

    parsedData.forEach(member => {
        const identityTuples = member.tuples
            .filter(t => hittingSet.includes(t))
            .sort((a, b) => {
                if (a.startsWith('Credits_')) return 1;
                if (b.startsWith('Credits_')) return -1;
                return a.localeCompare(b);
            });
            
        const formattedTuples = identityTuples.map(t => 
            t.startsWith('Credits_') ? `${t.split('_')[1]}cr` : t
        );

        let finalName = formattedTuples.length > 0 ? formattedTuples.join(" + ") : "Core Schedule";
        const fId = member.idx + 1;
        
        namedSchedules.push({ schedule: member.sched, name: finalName, familyId: fId });
        debugFamilies[`Sched ${fId}`] = finalName;
    });

    console.groupEnd();

    return { 
        namedSchedules, 
        debug: { 
            tupleFreq, 
            families: debugFamilies 
        } 
    }; 
}