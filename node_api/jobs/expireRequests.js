const cron = require("node-cron");
const HelpRequest = require("../models/HelpRequest");

cron.schedule("*/1 * * * *", async () => {
  await HelpRequest.updateMany(
    { expiresAt: { $lt: new Date() }, status: "OPEN" },
    { status: "EXPIRED" }
  );
});
