export function deriveColor(name: string): string {
	const s = name.trim().toUpperCase();
	let hash = 5381;
	for (let i = 0; i < s.length; i++) {
		hash = (((hash << 5) + hash) ^ s.charCodeAt(i)) >>> 0;
	}
	return `oklch(58% 0.15 ${hash % 360})`;
}
