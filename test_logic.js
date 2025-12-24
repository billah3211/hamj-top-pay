const { prisma } = require('./src/db/prisma');

async function test() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No users found');
      return;
    }
    console.log('Testing profile API for username:', user.username);
    
    // I can't easily fetch via HTTP here without running the server, 
    // but I can simulate the logic of the route.
    
    const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } });
    console.log('Task Count:', taskCount);
    
    const pendingCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'PENDING' } });
    console.log('Pending Count:', pendingCount);
    
    const rejectedCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'REJECTED' } });
    console.log('Rejected Count:', rejectedCount);
    
    console.log('Logic seems fine.');
    
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
