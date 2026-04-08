import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const allowedTunnelHosts = [".ngrok-free.dev"];

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		allowedHosts: allowedTunnelHosts,
	},
	preview: {
		allowedHosts: allowedTunnelHosts,
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules/recharts")) return "recharts";
				},
			},
		},
	},
});
