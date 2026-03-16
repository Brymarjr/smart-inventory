import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  // This is the block that catches network failures
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          // This ensures we only show the offline page when they try to load an HTML document
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();