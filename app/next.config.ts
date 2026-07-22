import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// All binding-backed routes are dynamic, so production builds do not need to
// connect to remote bindings. Keep the bridge limited to `next dev`.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
