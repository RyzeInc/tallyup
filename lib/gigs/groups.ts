/**
 * Gig Platform Grouping
 * 
 * Groups similar platforms for aggregate reporting.
 * Example: Uber + Lyft → "rideshare"
 */

export type GigGroupKey = "rideshare" | "delivery" | "freelance" | "rental" | "other";

export const GIG_GROUP_LABELS: Record<GigGroupKey, string> = {
  rideshare: "Ride-share",
  delivery: "Delivery",
  freelance: "Freelance",
  rental: "Rental",
  other: "Other",
};

/**
 * Map of platform names to their group
 */
export const GIG_PLATFORM_GROUP: Record<string, GigGroupKey> = {
  // Rideshare
  "Uber": "rideshare",
  "Lyft": "rideshare",
  
  // Delivery
  "DoorDash": "delivery",
  "Instacart": "delivery",
  "UberEats": "delivery",
  "Grubhub": "delivery",
  "Amazon Flex": "delivery",
  "Shipt": "delivery",
  "Postmates": "delivery",
  
  // Freelance
  "Fiverr": "freelance",
  "Upwork": "freelance",
  "TaskRabbit": "freelance",
  "Freelance": "freelance",
  "Contract": "freelance",
  
  // Rental
  "Airbnb": "rental",
  "Turo": "rental",
  "VRBO": "rental",
};

/**
 * Get the gig group for a platform
 */
export function getGigGroup(platform?: string | null): GigGroupKey | null {
  if (!platform) return null;
  return GIG_PLATFORM_GROUP[platform] ?? "other";
}

/**
 * Get all platforms in a group
 */
export function getPlatformsInGroup(group: GigGroupKey): string[] {
  return Object.entries(GIG_PLATFORM_GROUP)
    .filter(([, g]) => g === group)
    .map(([platform]) => platform);
}

/**
 * List of all known gig platforms
 */
export const ALL_GIG_PLATFORMS = Object.keys(GIG_PLATFORM_GROUP);
