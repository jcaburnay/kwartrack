import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Load .env / .env.local so non-VITE_-prefixed vars (SUPABASE_SECRET_KEY, etc.)
// reach integration tests. Vite's browser client still only sees VITE_* because
// the bundler strips everything else — this only changes test-runtime env.
const env = loadEnv("", fileURLToPath(new URL("../..", import.meta.url)), "");

export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/__tests__/setup.ts"],
		include: ["src/__tests__/**/*.test.{ts,tsx}"],
		env,
		// Integration tests share one local Supabase database and exercise
		// global cron RPCs. Running files in parallel makes those suites race.
		fileParallelism: false,
	},
});
