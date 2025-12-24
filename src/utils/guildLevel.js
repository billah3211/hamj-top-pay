
/**
 * Guild Level Calculation Logic
 */

// Level thresholds
const LEVEL_THRESHOLDS = {
    1: 5000,
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
    let currentLevel = 0;
    let nextLevelScore = LEVEL_THRESHOLDS[1];
    
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
    let currentLevelStart = 0;
    
    if (currentLevel > 0) {
        currentLevelStart = LEVEL_THRESHOLDS[currentLevel];
    }

    if (currentLevel < 11) {
        const totalNeeded = nextLevelScore - currentLevelStart;
        const gained = score - currentLevelStart;
        progress = Math.min(100, Math.max(0, (gained / totalNeeded) * 100));
    } else {
        progress = 100;
    }

    return {
        level: currentLevel,
        nextLevelScore,
        scoreNeeded: Math.max(0, nextLevelScore - score),
        progress: progress.toFixed(1)
    };
}

const checkLevelUpReward = async (tx, guildId, oldScore, newScore) => {
    const oldInfo = getGuildLevelInfo(oldScore);
    const newInfo = getGuildLevelInfo(newScore);

    // If level increased
    if (newInfo.level > oldInfo.level) {
        // Update guild level in DB
        await tx.guild.update({
            where: { id: guildId },
            data: { level: newInfo.level }
        });

        // Find rewards for reached levels
        // e.g. moved 0 -> 2, should get rewards for 1 and 2
        const configs = await tx.levelConfiguration.findMany({
            where: {
                level: {
                    gt: oldInfo.level,
                    lte: newInfo.level
                }
            }
        });

        for (const config of configs) {
             const guild = await tx.guild.findUnique({ where: { id: guildId } });
             if (!guild) continue;

             if (config.rewardType === 'CASH') {
                 const amount = parseFloat(config.rewardValue);
                 if (amount > 0) {
                     // Determine currency
                     let data = {};
                     if (config.currency === 'diamond') {
                         data = { diamond: { increment: amount } };
                     } else {
                         // Default to tk
                         data = { tk: { increment: amount } };
                     }

                     await tx.user.update({
                         where: { id: guild.leaderId },
                         data: data
                     });
                     
                     // Notify
                     await tx.notification.create({
                         data: {
                             userId: guild.leaderId,
                             message: `Congratulations! Your guild reached Level ${config.level} and you received ${config.rewardValue} ${config.currency || 'TK'} bonus!`,
                             type: 'credit'
                         }
                     });
                 }
             } else if (config.rewardType === 'GIFT') {
                 // Set Guild Reward
                 await tx.guild.update({
                     where: { id: guildId },
                     data: {
                         currentReward: config.rewardValue,
                         rewardType: 'GIFT',
                         rewardStatus: 'PENDING_ADDRESS'
                     }
                 });
                 
                 // Notify
                 await tx.notification.create({
                     data: {
                         userId: guild.leaderId,
                         message: `Congratulations! Your guild reached Level ${config.level}! You won a ${config.rewardValue}. Please provide your shipping address in the dashboard.`,
                         type: 'alert'
                     }
                 });
             }
        }
    }
}

module.exports = { getGuildLevelInfo, checkLevelUpReward, LEVEL_THRESHOLDS }
