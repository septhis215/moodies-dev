import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Keep deployment free of R2 subscriptions and cache-related Durable Objects.
export default defineCloudflareConfig({});
