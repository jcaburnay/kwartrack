import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pkg = JSON.parse(
	readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { version: string };

export default defineConfig({
	plugins: [react(), tailwindcss()],
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
	},
	build: {
		target: "es2022",
		sourcemap: false,
		cssCodeSplit: true,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes("node_modules")) return undefined;
					if (
						id.includes("/recharts/") ||
						id.includes("/d3-") ||
						id.includes("/react-smooth/") ||
						id.includes("/recharts-scale/") ||
						id.includes("/decimal.js-light/") ||
						id.includes("/fast-equals/") ||
						id.includes("/victory-vendor/") ||
						id.includes("/lodash/") ||
						id.includes("/lodash-es/")
					) {
						return "charts";
					}
					if (id.includes("/@supabase/")) return "supabase";
					if (id.includes("/react-router")) return "router";
					if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
						return "react";
					}
					return undefined;
				},
			},
		},
	},
});
