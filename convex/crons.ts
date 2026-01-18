import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "budget_dirty_queue",
  { minutes: 1 },
  internal.budgetWorker.processBudgetDirtyQueue,
  {}
);

// Purge accounts that were archived more than 14 days ago (runs daily)
crons.interval(
  "purge_archived_accounts",
  { minutes: 60 * 24 },
  internal.accounts.purgeArchivedAccounts,
  {}
);

export default crons;
