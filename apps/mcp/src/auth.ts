import type { IncomingMessage, ServerResponse } from "node:http";
import type { McpConfig } from "./config.js";

export const oauthScopes = ["openid", "email", "profile"] as const;
export const maxMcpRequestBytes = 1_000_000;

const allowedMcpOrigins = new Set([
	"https://chatgpt.com",
	"https://chat.openai.com",
	"https://kwartrack.com",
]);

export function isAllowedMcpOrigin(origin: string | null) {
	if (!origin) return true;
	return allowedMcpOrigins.has(origin);
}

export function allowedCorsOrigin(origin: string | null) {
	return origin && allowedMcpOrigins.has(origin) ? origin : null;
}

export function requestIsTooLarge(contentLength: string | null) {
	if (!contentLength) return false;
	const bytes = Number(contentLength);
	return !Number.isFinite(bytes) || bytes < 0 || bytes > maxMcpRequestBytes;
}

export function bearerToken(request: IncomingMessage) {
	const header = request.headers.authorization;
	if (!header) return null;
	const match = /^Bearer\s+(.+)$/i.exec(header);
	return match?.[1]?.trim() || null;
}

export function protectedResourceMetadata(config: McpConfig) {
	return {
		resource: config.publicUrl.origin,
		authorization_servers: [`${config.supabaseUrl}/auth/v1`],
		scopes_supported: [...oauthScopes],
		bearer_methods_supported: ["header"],
		resource_name: "Kwartrack",
		resource_documentation: "https://kwartrack.com/settings/about",
	};
}

export function unauthorized(response: ServerResponse, config: McpConfig) {
	const metadataUrl = new URL("/.well-known/oauth-protected-resource", config.publicUrl);
	response.writeHead(401, {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Expose-Headers": "WWW-Authenticate",
		"Content-Type": "application/json",
		"WWW-Authenticate": `Bearer resource_metadata="${metadataUrl.toString()}", scope="${oauthScopes.join(" ")}"`,
	});
	response.end(
		JSON.stringify({ error: "unauthorized", message: "Connect Kwartrack to continue." }),
	);
}
