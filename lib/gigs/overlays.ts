/**
 * Gig Overlays - Context-aware guidance for gig workers
 * 
 * Each overlay contains prompts and suggestions specific to
 * a type of gig work, helping users track relevant expenses.
 */

import { GigGroupKey } from "./groups";

export interface GigPrompt {
  id: string;
  title: string;
  body: string;
  suggestedTags?: string[];
  suggestedCategories?: string[];
}

export interface GigOverlay {
  title: string;
  description: string;
  prompts: GigPrompt[];
  /** Expense categories to surface prominently */
  relevantExpenses: string[];
}

export const GIG_OVERLAYS: Record<GigGroupKey, GigOverlay> = {
  rideshare: {
    title: "Ride-share",
    description: "Driving for Uber, Lyft, or similar services",
    relevantExpenses: ["Fuel", "Maintenance", "Insurance", "Car Payment", "Phone"],
    prompts: [
      {
        id: "fuel",
        title: "Track fuel costs",
        body: "Fuel is your biggest hidden expense. Tag gas purchases as Work to see your true hourly rate.",
        suggestedTags: ["Work"],
        suggestedCategories: ["Fuel"],
      },
      {
        id: "maintenance",
        title: "Set a maintenance buffer",
        body: "Tires, oil changes, brakes add up. Track them as Work expenses so your gig net is honest.",
        suggestedCategories: ["Maintenance"],
      },
      {
        id: "insurance",
        title: "Insurance clarity",
        body: "If you carry extra rideshare coverage, tag it as Work so your costs are visible.",
        suggestedCategories: ["Insurance"],
      },
      {
        id: "depreciation",
        title: "Consider depreciation",
        body: "Your car loses value with miles. The IRS rate (~67¢/mile) accounts for this.",
      },
    ],
  },
  
  delivery: {
    title: "Delivery",
    description: "Food delivery, packages, or shopping services",
    relevantExpenses: ["Fuel", "Maintenance", "Hot Bags", "Phone"],
    prompts: [
      {
        id: "mileage",
        title: "Mileage matters most",
        body: "Delivery apps often underreport true miles. Consider logging weekly mileage as a note.",
      },
      {
        id: "vehicle",
        title: "Vehicle wear adds up",
        body: "Delivery income looks high until wear costs are visible. Tag maintenance as Work.",
        suggestedCategories: ["Maintenance"],
      },
      {
        id: "supplies",
        title: "Track your gear",
        body: "Hot bags, phone mounts, chargers—small costs that are tax deductible.",
        suggestedCategories: ["Supplies"],
      },
    ],
  },
  
  freelance: {
    title: "Freelance",
    description: "Contract work, consulting, or creative services",
    relevantExpenses: ["Software", "Equipment", "Home Office", "Professional Development"],
    prompts: [
      {
        id: "taxes",
        title: "Set aside for taxes",
        body: "Freelance income isn't fully yours. Create a goal for taxes and fund it from each payout.",
      },
      {
        id: "tools",
        title: "Track tools & subscriptions",
        body: "Software and tools are Work expenses. Track them so your net hourly isn't inflated.",
        suggestedCategories: ["Software", "Subscriptions"],
      },
      {
        id: "irregular",
        title: "Plan for irregular income",
        body: "Build a buffer for slow months. Your average income isn't your every-month income.",
      },
    ],
  },
  
  rental: {
    title: "Rental",
    description: "Property or vehicle rentals",
    relevantExpenses: ["Cleaning", "Maintenance", "Insurance", "Utilities", "Supplies"],
    prompts: [
      {
        id: "cleaning",
        title: "Track cleaning costs",
        body: "Cleaning between guests is a direct cost of rental income. Tag it clearly.",
        suggestedCategories: ["Cleaning"],
      },
      {
        id: "maintenance",
        title: "Maintenance reserves",
        body: "Set aside a percentage for repairs. Things break—being ready helps.",
      },
      {
        id: "seasonality",
        title: "Watch for seasonality",
        body: "Rental income often varies by season. Don't mistake peak season for normal.",
      },
    ],
  },
  
  other: {
    title: "Other Gigs",
    description: "Other gig work or side income",
    relevantExpenses: ["Supplies", "Equipment", "Travel"],
    prompts: [
      {
        id: "track-hours",
        title: "Track your hours",
        body: "Knowing your true hourly rate helps you decide which gigs are worth your time.",
      },
      {
        id: "separate-expenses",
        title: "Separate gig expenses",
        body: "Use tags like Work to see what your gig actually costs you.",
        suggestedTags: ["Work"],
      },
    ],
  },
};

/**
 * Get overlay for a specific gig group
 */
export function getGigOverlay(group: GigGroupKey): GigOverlay {
  return GIG_OVERLAYS[group];
}

/**
 * Get all prompts across all overlays
 */
export function getAllGigPrompts(): Array<GigPrompt & { group: GigGroupKey }> {
  const all: Array<GigPrompt & { group: GigGroupKey }> = [];
  for (const [group, overlay] of Object.entries(GIG_OVERLAYS)) {
    for (const prompt of overlay.prompts) {
      all.push({ ...prompt, group: group as GigGroupKey });
    }
  }
  return all;
}
