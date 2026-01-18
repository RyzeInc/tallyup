import type { CoachProvider } from "../types";

export function createCloudflareProvider(): CoachProvider {
  return {
    id: "cloudflare",
    generate: async () => {
      throw new Error("Cloudflare Workers AI provider is not wired yet.");
    },
  };
}
