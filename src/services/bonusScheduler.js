const cron = require('node-cron');
const { prisma } = require('../db/prisma');

const initBonusScheduler = () => {
  // Run every minute to check for due bonuses
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      
      // Find pending schedules that are due
      const dueSchedules = await prisma.userBonusSchedule.findMany({
        where: {
          status: 'PENDING',
          scheduledDate: {
            lte: now
          }
        }
      });

      for (const schedule of dueSchedules) {
        console.log(`Processing bonus schedule #${schedule.id}`);
        
        // Fetch top users by TK earnings
        const winners = await prisma.user.findMany({
          take: schedule.winnerCount,
          orderBy: {
            tk: 'desc'
          }
        });

        // Distribute bonus
        for (const winner of winners) {
          await prisma.user.update({
            where: { id: winner.id },
            data: {
              tk: { increment: schedule.amount },
              notifications: {
                create: {
                  message: `Congratulations! You have received a bonus of ${schedule.amount} TK for being in the top ${schedule.winnerCount} leaderboard!`,
                  type: 'credit'
                }
              }
            }
          });
        }

        // Mark schedule as completed
        await prisma.userBonusSchedule.update({
          where: { id: schedule.id },
          data: { status: 'COMPLETED' }
        });

        console.log(`Bonus schedule #${schedule.id} completed. Distributed to ${winners.length} users.`);
      }

    } catch (error) {
      console.error('Error in bonus scheduler:', error);
    }
  });
  
  console.log('Bonus Scheduler initialized.');
};

module.exports = { initBonusScheduler };
