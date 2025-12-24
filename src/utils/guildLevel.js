
/**
 * Guild Level Calculation Logic
 */

// Level thresholds
const LEVEL_THRESHOLDS = {
    1: 0,
    2: 20000,
    3: 50000,
    4: 100000,
    5: 250000,
    6: 500000,
    7: 1000000,
    8: 2500000,
    9: 5000000,
    10: 10000000,
    11: 20000000
}

// Get Level Info
const getGuildLevelInfo = (score) => {
    let currentLevel = 1;
    let nextLevelScore = LEVEL_THRESHOLDS[2];
    
    // Find current level
    for (let level = 11; level >= 1; level--) {
        if (score >= LEVEL_THRESHOLDS[level]) {
            currentLevel = level;
            break;
        }
    }

    // Determine next level target
    if (currentLevel < 11) {
        nextLevelScore = LEVEL_THRESHOLDS[currentLevel + 1];
    } else {
        nextLevelScore = LEVEL_THRESHOLDS[11]; // Maxed out
    }

    // Calculate progress percentage
    let progress = 0;
    if (currentLevel < 11) {
        const currentLevelStart = LEVEL_THRESHOLDS[currentLevel];
        const totalNeeded = nextLevelScore - currentLevelStart;
        const gained = score - currentLevelStart;
        progress = Math.min(100, Math.max(0, (gained / totalNeeded) * 100));
    } else {
        progress = 100;
    }

    return {
        level: currentLevel,
        nextLevelScore,
        progress: progress.toFixed(1)
    };
}

module.exports = { getGuildLevelInfo, LEVEL_THRESHOLDS }
