import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: "https://tidy-swift-32.clerk.accounts.dev",
      applicationID: "convex"
    }
  ]
} satisfies AuthConfig;
