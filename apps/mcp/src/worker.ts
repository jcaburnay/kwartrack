import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { allowedCorsOrigin, isAllowedMcpOrigin, oauthScopes, requestIsTooLarge } from "./auth.js";
import type { McpConfig } from "./config.js";
import { SupabaseFinanceDataSource, validateAccessToken } from "./supabase.js";
import { createKwartrackServer } from "./tools.js";

export type WorkerEnv = {
	SUPABASE_URL: string;
	SUPABASE_PUBLISHABLE_KEY: string;
	MCP_ALLOWED_OAUTH_CLIENT_ID: string;
	MCP_PUBLIC_URL?: string;
};

const baseCorsHeaders = {
	"Access-Control-Allow-Headers":
		"authorization, content-type, last-event-id, mcp-method, mcp-name, mcp-protocol-version, mcp-session-id",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Expose-Headers": "Mcp-Protocol-Version, Mcp-Session-Id, WWW-Authenticate",
	Vary: "Origin",
};

function corsHeaders(request: Request) {
	const headers = new Headers(baseCorsHeaders);
	const origin = allowedCorsOrigin(request.headers.get("Origin"));
	if (origin) headers.set("Access-Control-Allow-Origin", origin);
	return headers;
}

function withCors(request: Request, response: Response) {
	const headers = new Headers(response.headers);
	for (const [name, value] of corsHeaders(request)) headers.set(name, value);
	headers.set("Referrer-Policy", "no-referrer");
	headers.set("Strict-Transport-Security", "max-age=31536000");
	headers.set("X-Content-Type-Options", "nosniff");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function configFor(request: Request, env: WorkerEnv): McpConfig {
	if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.MCP_ALLOWED_OAUTH_CLIENT_ID) {
		throw new Error(
			"SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and MCP_ALLOWED_OAUTH_CLIENT_ID must be configured",
		);
	}
	return {
		port: 443,
		publicUrl: new URL(env.MCP_PUBLIC_URL ?? new URL(request.url).origin),
		supabaseUrl: env.SUPABASE_URL.replace(/\/$/, ""),
		supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY,
		allowedOAuthClientId: env.MCP_ALLOWED_OAUTH_CLIENT_ID,
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

function unauthorized(request: Request, config: McpConfig) {
	const metadataUrl = new URL("/.well-known/oauth-protected-resource", config.publicUrl);
	return withCors(
		request,
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
		if (!isAllowedMcpOrigin(request.headers.get("Origin"))) {
			return withCors(request, Response.json({ error: "invalid_origin" }, { status: 403 }));
		}
		if (request.method === "OPTIONS")
			return new Response(null, { status: 204, headers: corsHeaders(request) });
		if (request.method === "GET" && url.pathname === "/health") {
			return withCors(request, Response.json({ status: "ok", service: "kwartrack-mcp" }));
		}
		if (
			request.method === "GET" &&
			(url.pathname === "/.well-known/oauth-protected-resource" ||
				url.pathname === "/.well-known/oauth-protected-resource/mcp")
		) {
			return withCors(
				request,
				Response.json(metadata(config), { headers: { "Cache-Control": "public, max-age=300" } }),
			);
		}
		if (url.pathname !== "/mcp" || !["GET", "POST", "DELETE"].includes(request.method)) {
			return withCors(request, new Response("Not Found", { status: 404 }));
		}
		if (request.method === "POST" && requestIsTooLarge(request.headers.get("Content-Length"))) {
			return withCors(request, Response.json({ error: "request_too_large" }, { status: 413 }));
		}

		const authorization = request.headers.get("Authorization");
		const match = authorization ? /^Bearer\s+(.+)$/i.exec(authorization) : null;
		const accessToken = match?.[1]?.trim();
		if (!accessToken) return unauthorized(request, config);
		const user = await validateAccessToken(
			config.supabaseUrl,
			config.supabasePublishableKey,
			accessToken,
			config.allowedOAuthClientId,
		);
		if (!user) return unauthorized(request, config);

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
		return withCors(request, await transport.handleRequest(request));
	} catch (error) {
		// biome-ignore lint/suspicious/noConsole: Cloudflare captures worker errors in its operational logs.
		console.error("MCP worker request failed", error);
		return withCors(request, Response.json({ error: "internal_error" }, { status: 500 }));
	}
}

export default {
	fetch: handleWorkerRequest,
};
