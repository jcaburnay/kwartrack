export function safeAuthNext(search: string) {
	const next = new URLSearchParams(search).get("next");
	if (!next?.startsWith("/") || next.startsWith("//")) return "/";
	return next;
}
