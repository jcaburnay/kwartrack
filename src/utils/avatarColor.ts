/**
 * Returns a deterministic bg/text color pair for an avatar based on the entity name.
 * Uses warm tints that match the design system palette.
 */
const AVATAR_PALETTE = [
	{ bg: "bg-primary/15", text: "text-primary" },
	{ bg: "bg-secondary/15", text: "text-secondary" },
	{ bg: "bg-accent/15", text: "text-accent" },
	{ bg: "bg-success/15", text: "text-success" },
	{ bg: "bg-info/15", text: "text-info" },
	{ bg: "bg-warning/15", text: "text-warning" },
] as const;

export function getAvatarColor(name: string): { bg: string; text: string } {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
