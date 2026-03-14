import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Initialize the Serwist PWA plugin
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",      // Where your custom service worker logic lives
  swDest: "public/sw.js",      // Where Next.js should output the compiled worker
  disable: process.env.NODE_ENV === "development", // Don't cache during local dev
});

const nextConfig: NextConfig = {
  /* your existing config options here */
};

// Wrap and export the config
export default withSerwist(nextConfig);