import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { oauthScopes } from "./auth.js";
import type { McpConfig } from "./config.js";
import { SupabaseFinanceDataSource, validateAccessToken } from "./supabase.js";
import { createKwartrackServer } from "./tools.js";

export type WorkerEnv = {
	SUPABASE_URL: string;
	SUPABASE_PUBLISHABLE_KEY: string;
	MCP_PUBLIC_URL?: string;
};

const corsHeaders = {
	"Access-Control-Allow-Headers":
		"authorization, content-type, last-event-id, mcp-protocol-version, mcp-session-id",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Expose-Headers": "Mcp-Protocol-Version, Mcp-Session-Id, WWW-Authenticate",
};

function withCors(response: Response) {
	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function configFor(request: Request, env: WorkerEnv): McpConfig {
	if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
		throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be configured");
	}
	return {
		port: 443,
		publicUrl: new URL(env.MCP_PUBLIC_URL ?? new URL(request.url).origin),
		supabaseUrl: env.SUPABASE_URL.replace(/\/$/, ""),
		supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY,
	};
}

function metadata(config: McpConfig) {
	return {
		resource: config.publicUrl.origin,
		authorization_servers: [`${config.supabaseUrl}/auth/v1`],
		scopes_supported: [...oauthScopes],
		bearer_methods_supported: ["header"],
		resource_name: "Kwartrack",
		resource_documentation: "https://kwartrack.com/settings/about",
	};
}

function unauthorized(config: McpConfig) {
	const metadataUrl = new URL("/.well-known/oauth-protected-resource", config.publicUrl);
	return withCors(
		Response.json(
			{ error: "unauthorized", message: "Connect Kwartrack to continue." },
			{
				status: 401,
				headers: {
					"WWW-Authenticate": `Bearer resource_metadata="${metadataUrl.toString()}", scope="${oauthScopes.join(" ")}"`,
				},
			},
		),
	);
}

export async function handleWorkerRequest(request: Request, env: WorkerEnv): Promise<Response> {
	try {
		const config = configFor(request, env);
		const url = new URL(request.url);
		if (request.method === "OPTIONS")
			return new Response(null, { status: 204, headers: corsHeaders });
		if (request.method === "GET" && url.pathname === "/health") {
			return withCors(Response.json({ status: "ok", service: "kwartrack-mcp" }));
		}
		if (
			request.method === "GET" &&
			(url.pathname === "/.well-known/oauth-protected-resource" ||
				url.pathname === "/.well-known/oauth-protected-resource/mcp")
		) {
			return withCors(
				Response.json(metadata(config), { headers: { "Cache-Control": "public, max-age=300" } }),
			);
		}
		if (url.pathname !== "/mcp" || !["GET", "POST", "DELETE"].includes(request.method)) {
			return withCors(new Response("Not Found", { status: 404 }));
		}

		const authorization = request.headers.get("Authorization");
		const match = authorization ? /^Bearer\s+(.+)$/i.exec(authorization) : null;
		const accessToken = match?.[1]?.trim();
		if (!accessToken) return unauthorized(config);
		const user = await validateAccessToken(
			config.supabaseUrl,
			config.supabasePublishableKey,
			accessToken,
		);
		if (!user) return unauthorized(config);

		const dataSource = new SupabaseFinanceDataSource(
			config.supabaseUrl,
			config.supabasePublishableKey,
			accessToken,
		);
		const server = createKwartrackServer(dataSource);
		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});
		await server.connect(transport);
		return withCors(await transport.handleRequest(request));
	} catch (error) {
		// biome-ignore lint/suspicious/noConsole: Cloudflare captures worker errors in its operational logs.
		console.error("MCP worker request failed", error);
		return withCors(Response.json({ error: "internal_error" }, { status: 500 }));
	}
}

export default {
	fetch: handleWorkerRequest,
};
