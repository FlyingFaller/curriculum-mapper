/**
 * Processes generated schedules into unique, descriptive, short names using 
 * an auto-scaling Iterative Signature Promotion (Bitwise XOR) architecture.
 */
export function processGeneratedSchedules(schedules) {
    const total = schedules.length;
    
    console.group(`\n🚀 [Schedule Naming] Processing ${total} Schedules (Bitwise XOR Architecture)`);

    // Handle trivial cases[cite: 1]
    if (total === 0) {
        console.groupEnd();
        return { namedSchedules: [], debug: {} }; //[cite: 1]
    }
    
    if (total === 1) {
        console.groupEnd();
        return { 
            namedSchedules: [{ schedule: schedules[0], name: "Optimal Schedule", familyId: 1 }], //[cite: 1]
            debug: {} 
        };
    }

    // --- Phase 1: Vectorization & Weight Calculation ---
    
    const tupleFreq = {}; //[cite: 1]
    const courseFreq = {};
    
    // Parse courses and terms (tuples)[cite: 1]
    const parsedData = schedules.map((sched, idx) => {
        const courses = new Set();
        const tuples = new Set();
        
        Object.entries(sched).forEach(([tStr, tCourses]) => {
            const tNum = parseInt(tStr) + 1; //[cite: 1]
            tCourses.forEach(c => {
                courses.add(c);
                tuples.add(`${c}_T${tNum}`);
            });
        });
        
        return { sched, idx, courses: Array.from(courses), tuples: Array.from(tuples) };
    });

    // Populate global frequencies[cite: 1]
    parsedData.forEach(p => {
        p.courses.forEach(c => courseFreq[c] = (courseFreq[c] || 0) + 1);
        p.tuples.forEach(t => tupleFreq[t] = (tupleFreq[t] || 0) + 1);
    });

    const featureData = [];
    const COST_TEMPORAL = 2.1; // Penalty applied to favor spatial features[cite: 1]

    // Calculate Surprisal Weights (Global Information Value)
    for (let [c, count] of Object.entries(courseFreq)) {
        if (count < total) { // Ignore Universal Cores[cite: 1]
            let weight = -Math.log2(count / total);
            featureData.push({ val: c, type: 'spatial', weight });
        }
    }
    
    for (let [t, count] of Object.entries(tupleFreq)) {
        if (count < total) { // Ignore Universal Cores[cite: 1]
            // Penalize temporal markers so they are only used when highly valuable
            let weight = (-Math.log2(count / total)) / COST_TEMPORAL; 
            featureData.push({ val: t, type: 'temporal', weight });
        }
    }

    // Sort descending by weight. 
    // Index 0 is highest weight (Best feature). High indices are low weight.
    featureData.sort((a, b) => b.weight - a.weight);

    const featureToIndex = new Map();
    featureData.forEach((f, i) => featureToIndex.set(f.val, BigInt(i)));
    const M = BigInt(featureData.length);

    // Map schedules to BigInt bitsets
    parsedData.forEach(p => {
        p.fullBitset = 0n;
        p.courses.forEach(c => {
            if (featureToIndex.has(c)) p.fullBitset |= (1n << featureToIndex.get(c));
        });
        p.tuples.forEach(t => {
            if (featureToIndex.has(t)) p.fullBitset |= (1n << featureToIndex.get(t));
        });
    });

    // --- Bitwise Helper Functions ---

    const getIndex = (bitMask) => BigInt(bitMask.toString(2).length - 1);
    
    const getWorstBit = (mask) => {
        if (mask === 0n) return 0n;
        return 1n << getIndex(mask); // Highest index = lowest weight
    };

    const getTopKBits = (bitset, k) => {
        let mask = 0n;
        let count = 0;
        for (let i = 0n; i < M; i++) {
            let bit = 1n << i;
            if ((bitset & bit) !== 0n) {
                mask |= bit;
                count++;
                if (count === k) break;
            }
        }
        return mask;
    };

    // --- Phase 2: Auto-Scaling Engine ---
    
    let k = 1; 
    let uniqueness_achieved = false;
    const maxFeatures = featureData.length;

    while (!uniqueness_achieved && k <= maxFeatures) {
        // Initialize signatures to top k features
        parsedData.forEach(p => p.mask = getTopKBits(p.fullBitset, k));
        
        let changed = true;
        let needs_k_increment = false;
        
        // Iterative Signature Promotion Loop
        while (changed && !needs_k_increment) {
            changed = false;
            
            // Group schedules by their current signature mask
            let maskGroups = new Map();
            for (let p of parsedData) {
                let group = maskGroups.get(p.mask) || [];
                group.push(p);
                maskGroups.set(p.mask, group);
            }
            
            for (let group of maskGroups.values()) {
                if (group.length > 1) { // Collision detected
                    let sA = group[0];
                    let sB = group[1];
                    let diff = sA.fullBitset ^ sB.fullBitset;
                    
                    if (diff === 0n) continue; // Mathematically identical subsets
                    
                    // Isolate distinguishing features for each
                    let diffA = sA.fullBitset & diff;
                    let diffB = sB.fullBitset & diff;
                    
                    // Best distinguishing bit for each (lowest index = highest weight)
                    let fA = diffA !== 0n ? (diffA & -diffA) : null;
                    let fB = diffB !== 0n ? (diffB & -diffB) : null;
                    
                    let worstA = getWorstBit(sA.mask);
                    let worstB = getWorstBit(sB.mask);
                    
                    // Validate monotonic improvement
                    let impA = fA !== null && getIndex(fA) < getIndex(worstA);
                    let impB = fB !== null && getIndex(fB) < getIndex(worstB);
                    
                    if (impA || impB) {
                        changed = true;
                        // Promote in the schedule that yields the strongest upgrade
                        if (impA && impB) {
                            if (getIndex(fA) < getIndex(fB)) sA.mask = (sA.mask & ~worstA) | fA;
                            else sB.mask = (sB.mask & ~worstB) | fB;
                        } else if (impA) {
                            sA.mask = (sA.mask & ~worstA) | fA;
                        } else {
                            sB.mask = (sB.mask & ~worstB) | fB;
                        }
                    } else {
                        // The required distinguishing feature is worse than our worst current feature.
                        // Collision cannot be resolved without expanding the signature size.
                        needs_k_increment = true;
                        break;
                    }
                }
            }
        }
        
        if (needs_k_increment) {
            k++;
            continue;
        }
        
        // Validation Pass
        uniqueness_achieved = true;
        let finalGroups = new Map();
        parsedData.forEach(p => {
            let group = finalGroups.get(p.mask) || [];
            group.push(p);
            finalGroups.set(p.mask, group);
        });
        
        for (let group of finalGroups.values()) {
            if (group.length > 1) {
                // If they collide but have identical bitsets, we cannot resolve them via features
                for (let i = 1; i < group.length; i++) {
                    if (group[i].fullBitset !== group[0].fullBitset) {
                        uniqueness_achieved = false; // Fixable collision remains
                        break;
                    }
                }
            }
            if (!uniqueness_achieved) break;
        }
        
        if (!uniqueness_achieved) k++;
    }

    // --- Phase 3: Formatting & Cleanup ---
    
    const namedSchedules = [];
    const debugFamilies = {};

    parsedData.forEach(member => {
        let parts = [];
        for (let i = 0n; i < M; i++) {
            if ((member.mask & (1n << i)) !== 0n) {
                parts.push(featureData[Number(i)]);
            }
        }

        const finalNameParts = [];
        const tempCourses = new Set();
        
        // Extract courses used with temporal markers
        parts.forEach(f => {
            if (f.type === 'temporal') {
                const course = f.val.split('_')[0];
                tempCourses.add(course);
                finalNameParts.push(`${course}(T${f.val.split('_T')[1]})`);
            }
        });

        // Only add spatial courses if they aren't already represented temporally
        parts.forEach(f => {
            if (f.type === 'spatial' && !tempCourses.has(f.val)) {
                finalNameParts.push(f.val);
            }
        });

        finalNameParts.sort();
        let finalName = finalNameParts.length > 0 ? finalNameParts.join(" + ") : "Core Schedule";

        const fId = member.idx + 1;
        namedSchedules.push({ schedule: member.sched, name: finalName, familyId: fId });
        debugFamilies[`Sched ${fId}`] = finalName;
    });

    // Handle mathematically identical tie-breakers (e.g. Total Credits) if necessary here
    // by scanning `namedSchedules` for duplicate name strings and appending credit logic.

    console.log(`✅ Fixed-Length Bitwise Signatures successfully calculated (k=${k}).`);
    console.groupEnd();

    return { 
        namedSchedules, 
        debug: { 
            tupleFreq, //[cite: 1]
            families: debugFamilies 
        } 
    }; //[cite: 1]
}