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
import type * as budgetWorker from "../budgetWorker.js";
import type * as budgets from "../budgets.js";
import type * as categories from "../categories.js";
import type * as crons from "../crons.js";
import type * as detector from "../detector.js";
import type * as entries from "../entries.js";
import type * as gigs from "../gigs.js";
import type * as goals from "../goals.js";
import type * as investments from "../investments.js";
import type * as merchant from "../merchant.js";
import type * as migrations from "../migrations.js";
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
  budgetWorker: typeof budgetWorker;
  budgets: typeof budgets;
  categories: typeof categories;
  crons: typeof crons;
  detector: typeof detector;
  entries: typeof entries;
  gigs: typeof gigs;
  goals: typeof goals;
  investments: typeof investments;
  merchant: typeof merchant;
  migrations: typeof migrations;
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
