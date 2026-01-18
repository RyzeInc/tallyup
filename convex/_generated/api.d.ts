/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as analytics from "../analytics.js";
import type * as budgetEngine from "../budgetEngine.js";
import type * as budgetMatcher from "../budgetMatcher.js";
import type * as budgetWorker from "../budgetWorker.js";
import type * as budgets from "../budgets.js";
import type * as categories from "../categories.js";
import type * as categoryCatalog from "../categoryCatalog.js";
import type * as categoryResolver from "../categoryResolver.js";
import type * as coach from "../coach.js";
import type * as coachKnowledge from "../coachKnowledge.js";
import type * as coach_internal from "../coach_internal.js";
import type * as crons from "../crons.js";
import type * as detector from "../detector.js";
import type * as entries from "../entries.js";
import type * as finance_aggregates from "../finance_aggregates.js";
import type * as gigs from "../gigs.js";
import type * as goals from "../goals.js";
import type * as investments from "../investments.js";
import type * as merchant from "../merchant.js";
import type * as migrations from "../migrations.js";
import type * as plaid from "../plaid.js";
import type * as plaidActions from "../plaidActions.js";
import type * as preferences from "../preferences.js";
import type * as recurring from "../recurring.js";
import type * as rules from "../rules.js";
import type * as transfers from "../transfers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  analytics: typeof analytics;
  budgetEngine: typeof budgetEngine;
  budgetMatcher: typeof budgetMatcher;
  budgetWorker: typeof budgetWorker;
  budgets: typeof budgets;
  categories: typeof categories;
  categoryCatalog: typeof categoryCatalog;
  categoryResolver: typeof categoryResolver;
  coach: typeof coach;
  coachKnowledge: typeof coachKnowledge;
  coach_internal: typeof coach_internal;
  crons: typeof crons;
  detector: typeof detector;
  entries: typeof entries;
  finance_aggregates: typeof finance_aggregates;
  gigs: typeof gigs;
  goals: typeof goals;
  investments: typeof investments;
  merchant: typeof merchant;
  migrations: typeof migrations;
  plaid: typeof plaid;
  plaidActions: typeof plaidActions;
  preferences: typeof preferences;
  recurring: typeof recurring;
  rules: typeof rules;
  transfers: typeof transfers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
