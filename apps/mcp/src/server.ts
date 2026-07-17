import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { bearerToken, protectedResourceMetadata, unauthorized } from "./auth.js";
import { loadConfig } from "./config.js";
import { SupabaseFinanceDataSource, validateAccessToken } from "./supabase.js";
import { createKwartrackServer } from "./tools.js";

const config = loadConfig();
const mcpPath = "/mcp";
const protectedResourcePaths = new Set([
	"/.well-known/oauth-protected-resource",
	"/.well-known/oauth-protected-resource/mcp",
]);

function applyCors(response: import("node:http").ServerResponse) {
	response.setHeader("Access-Control-Allow-Origin", "*");
	response.setHeader(
		"Access-Control-Allow-Headers",
		"authorization, content-type, last-event-id, mcp-protocol-version, mcp-session-id",
	);
	response.setHeader(
		"Access-Control-Expose-Headers",
		"Mcp-Protocol-Version, Mcp-Session-Id, WWW-Authenticate",
	);
}

const httpServer = createServer(async (request, response) => {
	try {
		if (!request.url) {
			response.writeHead(400).end("Missing URL");
			return;
		}
		const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
		applyCors(response);

		if (request.method === "OPTIONS") {
			response.writeHead(204, { "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS" });
			response.end();
			return;
		}

		if (request.method === "GET" && url.pathname === "/health") {
			response.writeHead(200, { "Content-Type": "application/json" });
			response.end(JSON.stringify({ status: "ok", service: "kwartrack-mcp" }));
			return;
		}

		if (request.method === "GET" && protectedResourcePaths.has(url.pathname)) {
			response.writeHead(200, {
				"Cache-Control": "public, max-age=300",
				"Content-Type": "application/json",
			});
			response.end(JSON.stringify(protectedResourceMetadata(config)));
			return;
		}

		if (
			url.pathname !== mcpPath ||
			!request.method ||
			!["POST", "GET", "DELETE"].includes(request.method)
		) {
			response.writeHead(404).end("Not Found");
			return;
		}

		const accessToken = bearerToken(request);
		if (!accessToken) {
			unauthorized(response, config);
			return;
		}
		const user = await validateAccessToken(
			config.supabaseUrl,
			config.supabasePublishableKey,
			accessToken,
		);
		if (!user) {
			unauthorized(response, config);
			return;
		}

		const dataSource = new SupabaseFinanceDataSource(
			config.supabaseUrl,
			config.supabasePublishableKey,
			accessToken,
		);
		const mcpServer = createKwartrackServer(dataSource);
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});
		response.on("close", () => {
			transport.close();
			mcpServer.close();
		});
		await mcpServer.connect(transport);
		await transport.handleRequest(request, response);
	} catch (error) {
		// biome-ignore lint/suspicious/noConsole: production container logs are the MCP service's operational error channel.
		console.error("MCP request failed", error);
		if (!response.headersSent) {
			response.writeHead(500, { "Content-Type": "application/json" });
			response.end(JSON.stringify({ error: "internal_error" }));
		} else if (!response.writableEnded) {
			response.end();
		}
	}
});

httpServer.listen(config.port, "0.0.0.0", () => {
	// biome-ignore lint/suspicious/noConsole: emit one startup line for deployment health diagnostics.
	console.log(`Kwartrack MCP listening on port ${config.port}`);
});
