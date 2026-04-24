import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Load .env / .env.local so non-VITE_-prefixed vars (SUPABASE_SECRET_KEY, etc.)
// reach integration tests. Vite's browser client still only sees VITE_* because
// the bundler strips everything else — this only changes test-runtime env.
const env = loadEnv("", process.cwd(), "");

export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/__tests__/setup.ts"],
		include: ["src/__tests__/**/*.test.{ts,tsx}"],
		env,
	},
});
