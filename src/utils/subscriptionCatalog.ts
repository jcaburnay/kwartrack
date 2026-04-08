export interface CatalogEntry {
	name: string;
	domain: string;
	aliases?: string[];
}

export const SUBSCRIPTION_CATALOG: CatalogEntry[] = [
	// Streaming Video
	{ name: "Netflix", domain: "netflix.com" },
	{ name: "YouTube Premium", domain: "youtube.com", aliases: ["youtube"] },
	{ name: "Disney+", domain: "disneyplus.com", aliases: ["disney plus", "disney"] },
	{ name: "Max", domain: "max.com", aliases: ["hbo max", "hbo"] },
	{ name: "Apple TV+", domain: "apple.com", aliases: ["apple tv"] },
	{ name: "Amazon Prime Video", domain: "amazon.com", aliases: ["prime video", "amazon prime"] },
	{ name: "Viu", domain: "viu.com" },
	{ name: "WeTV", domain: "wetv.vip", aliases: ["we tv"] },
	{ name: "iQIYI", domain: "iqiyi.com", aliases: ["iqiyi"] },

	// Music
	{ name: "Spotify", domain: "spotify.com" },
	{ name: "Apple Music", domain: "music.apple.com", aliases: ["apple music"] },
	{ name: "YouTube Music", domain: "music.youtube.com", aliases: ["yt music"] },
	{ name: "Deezer", domain: "deezer.com" },
	{ name: "Tidal", domain: "tidal.com" },

	// Cloud Storage
	{ name: "Google One", domain: "one.google.com", aliases: ["google storage", "google drive"] },
	{ name: "iCloud+", domain: "icloud.com", aliases: ["icloud"] },
	{ name: "Dropbox", domain: "dropbox.com" },
	{ name: "OneDrive", domain: "onedrive.live.com", aliases: ["one drive"] },

	// Productivity
	{
		name: "Microsoft 365",
		domain: "microsoft.com",
		aliases: ["office 365", "microsoft office", "m365"],
	},
	{ name: "Google Workspace", domain: "workspace.google.com", aliases: ["gsuite", "g suite"] },
	{ name: "Notion", domain: "notion.so" },
	{ name: "Todoist", domain: "todoist.com" },
	{ name: "Obsidian", domain: "obsidian.md" },

	// Creative
	{ name: "Adobe Creative Cloud", domain: "adobe.com", aliases: ["adobe cc", "adobe"] },
	{ name: "Canva Pro", domain: "canva.com", aliases: ["canva"] },
	{ name: "Figma", domain: "figma.com" },
	{ name: "Sketch", domain: "sketch.com" },

	// Gaming
	{ name: "PlayStation Plus", domain: "playstation.com", aliases: ["ps plus", "psn", "ps+"] },
	{ name: "Xbox Game Pass", domain: "xbox.com", aliases: ["game pass", "xbox"] },
	{ name: "Nintendo Switch Online", domain: "nintendo.com", aliases: ["nintendo"] },

	// VPN
	{ name: "NordVPN", domain: "nordvpn.com", aliases: ["nord vpn"] },
	{ name: "ExpressVPN", domain: "expressvpn.com", aliases: ["express vpn"] },
	{ name: "Surfshark", domain: "surfshark.com" },

	// Password Managers
	{ name: "1Password", domain: "1password.com", aliases: ["one password"] },
	{ name: "LastPass", domain: "lastpass.com", aliases: ["last pass"] },
	{ name: "Bitwarden", domain: "bitwarden.com" },

	// Development
	{ name: "GitHub", domain: "github.com" },
	{ name: "Vercel", domain: "vercel.com" },
	{ name: "Railway", domain: "railway.app" },

	// Fitness / Wellness
	{ name: "Headspace", domain: "headspace.com" },
	{ name: "Calm", domain: "calm.com" },

	// Learning
	{ name: "Coursera", domain: "coursera.org" },
	{ name: "LinkedIn Premium", domain: "linkedin.com", aliases: ["linkedin"] },
	{ name: "Skillshare", domain: "skillshare.com" },
	{ name: "Duolingo", domain: "duolingo.com" },
];

function normalize(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Filter catalog for autocomplete suggestions (requires ≥2 chars). */
export function filterCatalog(query: string): CatalogEntry[] {
	const q = query.trim();
	if (q.length < 2) return [];
	const ql = q.toLowerCase();
	return SUBSCRIPTION_CATALOG.filter((entry) => {
		if (entry.name.toLowerCase().includes(ql)) return true;
		if (entry.aliases?.some((a) => a.toLowerCase().includes(ql))) return true;
		return false;
	}).slice(0, 6);
}

/** Find the best catalog match for a stored subscription name (for showing icons). */
export function findCatalogMatch(name: string): CatalogEntry | null {
	if (!name.trim()) return null;
	const norm = normalize(name);

	// 1. Exact match
	const exact = SUBSCRIPTION_CATALOG.find((e) => normalize(e.name) === norm);
	if (exact) return exact;

	// 2. Stored name contains catalog name (e.g. "Netflix Personal" → Netflix)
	const contains = SUBSCRIPTION_CATALOG.find((e) => {
		const en = normalize(e.name);
		if (en.length < 4) return false; // avoid matching short/common words
		if (norm.includes(en)) return true;
		return e.aliases?.some((a) => {
			const an = normalize(a);
			return an.length >= 4 && norm.includes(an);
		});
	});
	if (contains) return contains;

	return null;
}

export function getLogoUrl(domain: string): string {
	return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}
