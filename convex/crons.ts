import { cronJobs } from "convex/server";
import { internal, api } from "./_generated/api";

const crons = cronJobs();

// Budget reconciliation. The queue is also drained inline on write (see
// entries.ts), so this is a safety net for backlogs — chiefly bulk imports,
// which can enqueue hundreds of items at once. At the previous 25-per-minute
// rate a 300-transaction import took ~12 minutes to fully reflect in budgets.
crons.interval(
  "budget_dirty_queue",
  { minutes: 1 },
  internal.budgetWorker.processBudgetDirtyQueue,
  { batchSize: 200 }
);

// Purge accounts that were archived more than 14 days ago (runs daily)
crons.interval(
  "purge_archived_accounts",
  { minutes: 60 * 24 },
  internal.accounts.purgeArchivedAccounts,
  {}
);

// Clean up expired temporary chat conversations (runs hourly)
crons.interval(
  "cleanup_expired_chats",
  { minutes: 60 },
  api.chatConversations.cleanupExpiredConversations,
  {}
);

export default crons;
