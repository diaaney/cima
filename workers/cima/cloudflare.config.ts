import { defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
  worker: {
    name: "cima-interactions",
    entrypoint,
    compatibilityDate: "2026-11-05",
    observability: {
      enabled: true,
      headSamplingRate: 0.1,
      logs: {
        invocationLogs: true,
      },
    },
  },
});
