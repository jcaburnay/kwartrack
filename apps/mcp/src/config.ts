export type McpConfig = {
	port: number;
	publicUrl: URL;
	supabaseUrl: string;
	supabasePublishableKey: string;
};

function requiredEnv(primary: string, fallback?: string) {
	const value = process.env[primary] ?? (fallback ? process.env[fallback] : undefined);
	if (!value) {
		throw new Error(`Missing required environment variable: ${primary}`);
	}
	return value;
}

export function loadConfig(): McpConfig {
	const port = Number(process.env.PORT ?? 8787);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error("PORT must be an integer between 1 and 65535");
	}

	const publicUrl = new URL(process.env.MCP_PUBLIC_URL ?? `http://127.0.0.1:${port}`);
	if (process.env.NODE_ENV === "production" && publicUrl.protocol !== "https:") {
		throw new Error("MCP_PUBLIC_URL must use HTTPS in production");
	}

	return {
		port,
		publicUrl,
		supabaseUrl: requiredEnv("SUPABASE_URL", "VITE_SUPABASE_URL").replace(/\/$/, ""),
		supabasePublishableKey: requiredEnv(
			"SUPABASE_PUBLISHABLE_KEY",
			"VITE_SUPABASE_PUBLISHABLE_KEY",
		),
	};
}
