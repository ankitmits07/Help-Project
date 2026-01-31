const cron = require('node-cron');
const HelpRequest = require('../models/HelpRequest');

// Run cleanup every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Remove requests older than 6 months
    const result = await HelpRequest.deleteMany({
      createdAt: { $lt: sixMonthsAgo }
    });

    console.log(`Cleanup completed: Removed ${result.deletedCount} old requests`);
  } catch (error) {
    console.error('Cleanup job error:', error);
  }
});

console.log('Cleanup job scheduled: Runs daily at 2 AM');