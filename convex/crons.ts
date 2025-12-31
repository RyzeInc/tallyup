import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "budget_dirty_queue",
  { minutes: 1 },
  internal.budgetWorker.processBudgetDirtyQueue,
  {}
);

export default crons;
