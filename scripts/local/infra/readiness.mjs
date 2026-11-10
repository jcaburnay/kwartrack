import { setTimeout } from "node:timers/promises";

export async function waitForHttpReady(
	url,
	{ headers = {}, timeoutMs = 30_000, intervalMs = 500 } = {},
) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		let response;
		try {
			response = await fetch(url, {
				headers,
				signal: AbortSignal.timeout(Math.max(1, Math.min(5_000, deadline - Date.now()))),
			});
		} catch {
			// A just-started local listener can briefly refuse connections.
		}
		if (response?.status === 200) return response;
		if (response) {
			await response.body?.cancel();
			if (response.status < 500)
				throw new Error(`Local readiness returned HTTP ${response.status}.`);
		}
		const remaining = deadline - Date.now();
		if (remaining > 0) await setTimeout(Math.min(intervalMs, remaining));
	}
	throw new Error("Local HTTP readiness timed out.");
}
