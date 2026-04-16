type BrandColors = {
	primary: string;
	secondary?: string;
};

// Brand colors for Philippine banks and e-wallets.
// `secondary` triggers a left/right split dot.
const BRAND_COLORS: Array<{ keywords: string[]; colors: BrandColors }> = [
	// E-wallets & digital banks
	{ keywords: ["maya", "paymaya"], colors: { primary: "#2DF29D", secondary: "#000000" } },
	{ keywords: ["gcash", "g-cash"], colors: { primary: "#0070CD" } },
	{ keywords: ["shopeepay", "shopee pay", "shopee"], colors: { primary: "#F53D2E" } },
	{
		keywords: ["seabank", "sea bank", "maribank"],
		colors: { primary: "#EE4D2D", secondary: "#2773DD" },
	},
	{
		keywords: ["gotyme", "go tyme", "go-tyme"],
		colors: { primary: "#00BFCC", secondary: "#2D2D3A" },
	},
	{ keywords: ["tonik"], colors: { primary: "#785AFF" } },
	{
		keywords: ["coins.ph", "coins ph", "coinsph"],
		colors: { primary: "#0077B6", secondary: "#EEA022" },
	},
	// Universal banks
	{ keywords: ["bdo", "banco de oro"], colors: { primary: "#014EA8", secondary: "#FFFFFF" } },
	{
		keywords: ["bpi", "bank of the philippine"],
		colors: { primary: "#B11016", secondary: "#DDB91D" },
	},
	{
		keywords: ["metrobank", "metropolitan bank"],
		colors: { primary: "#FFFFFF", secondary: "#00166D" },
	},
	{ keywords: ["unionbank", "union bank"], colors: { primary: "#FEA30D", secondary: "#FFFFFF" } },
	{ keywords: ["rcbc", "rizal commercial"], colors: { primary: "#0361AD", secondary: "#FFFFFF" } },
	{ keywords: ["security bank"], colors: { primary: "#99C045", secondary: "#05A1D3" } },
	{ keywords: ["landbank", "land bank"], colors: { primary: "#75BC44", secondary: "#FFFFFF" } },
	{
		keywords: ["pnb", "philippine national bank"],
		colors: { primary: "#003087", secondary: "#FE0000" },
	},
	{
		keywords: ["chinabank", "china bank", "china banking"],
		colors: { primary: "#CC0000", secondary: "#FFFFFF" },
	},
	{
		keywords: ["eastwest", "east west bank"],
		colors: { primary: "#AC046D", secondary: "#522680" },
	},
	{
		keywords: ["psbank", "philippine savings bank"],
		colors: { primary: "#0056A5", secondary: "#ED3132" },
	},
	{ keywords: ["ctbc"], colors: { primary: "#FE0000", secondary: "#047165" } },
	{ keywords: ["allbank"], colors: { primary: "#ED3E43", secondary: "#62AE5B" } },
	// Subscriptions — primary color only (no split)
	// Streaming Video
	{ keywords: ["netflix"], colors: { primary: "#E50914" } },
	{ keywords: ["youtube music", "yt music"], colors: { primary: "#FF0000" } },
	{ keywords: ["youtube premium", "youtube"], colors: { primary: "#FF0000" } },
	{ keywords: ["disney+", "disney plus", "disney"], colors: { primary: "#113CCF" } },
	{ keywords: ["max", "hbo max", "hbo"], colors: { primary: "#002BE7" } },
	{ keywords: ["apple tv+", "apple tv"], colors: { primary: "#000000" } },
	{
		keywords: ["amazon prime video", "prime video", "amazon prime"],
		colors: { primary: "#00A8E0" },
	},
	{ keywords: ["viu"], colors: { primary: "#FFD200" } },
	{ keywords: ["wetv", "we tv"], colors: { primary: "#FF6100" } },
	{ keywords: ["iqiyi"], colors: { primary: "#00BE06" } },
	// Music
	{ keywords: ["spotify"], colors: { primary: "#1DB954" } },
	{ keywords: ["apple music"], colors: { primary: "#FA233B" } },
	{ keywords: ["deezer"], colors: { primary: "#EF5466" } },
	{ keywords: ["tidal"], colors: { primary: "#000000" } },
	// Cloud Storage
	{ keywords: ["google one", "google drive", "google storage"], colors: { primary: "#4285F4" } },
	{ keywords: ["icloud+", "icloud"], colors: { primary: "#3693F3" } },
	{ keywords: ["dropbox"], colors: { primary: "#0061FF" } },
	{ keywords: ["onedrive", "one drive"], colors: { primary: "#0078D4" } },
	// Productivity
	{
		keywords: ["microsoft 365", "office 365", "microsoft office", "m365"],
		colors: { primary: "#D83B01" },
	},
	{ keywords: ["google workspace", "gsuite", "g suite"], colors: { primary: "#4285F4" } },
	{ keywords: ["notion"], colors: { primary: "#000000" } },
	{ keywords: ["todoist"], colors: { primary: "#DB4035" } },
	{ keywords: ["obsidian"], colors: { primary: "#7C3AED" } },
	// Creative
	{ keywords: ["adobe creative cloud", "adobe cc", "adobe"], colors: { primary: "#FF0000" } },
	{ keywords: ["canva pro", "canva"], colors: { primary: "#00C4CC" } },
	{ keywords: ["figma"], colors: { primary: "#F24E1E" } },
	{ keywords: ["sketch"], colors: { primary: "#F7B500" } },
	// Gaming
	{ keywords: ["playstation plus", "ps plus", "psn", "ps+"], colors: { primary: "#003087" } },
	{ keywords: ["xbox game pass", "game pass", "xbox"], colors: { primary: "#107C10" } },
	{ keywords: ["nintendo switch online", "nintendo"], colors: { primary: "#E60012" } },
	// VPN
	{ keywords: ["nordvpn", "nord vpn"], colors: { primary: "#4687FF" } },
	{ keywords: ["expressvpn", "express vpn"], colors: { primary: "#DA3940" } },
	{ keywords: ["surfshark"], colors: { primary: "#1FCCCA" } },
	// Password Managers
	{ keywords: ["1password", "one password"], colors: { primary: "#1A8CFF" } },
	{ keywords: ["lastpass", "last pass"], colors: { primary: "#CC2017" } },
	{ keywords: ["bitwarden"], colors: { primary: "#175DDC" } },
	// Development
	{ keywords: ["github"], colors: { primary: "#181717" } },
	{ keywords: ["vercel"], colors: { primary: "#000000" } },
	{ keywords: ["railway"], colors: { primary: "#0B0D0E" } },
	// Fitness / Wellness
	{ keywords: ["headspace"], colors: { primary: "#FF6738" } },
	{ keywords: ["calm"], colors: { primary: "#4A90E2" } },
	// Learning
	{ keywords: ["linkedin premium", "linkedin"], colors: { primary: "#0A66C2" } },
	{ keywords: ["coursera"], colors: { primary: "#0056D2" } },
	{ keywords: ["skillshare"], colors: { primary: "#00FF84" } },
	{ keywords: ["duolingo"], colors: { primary: "#58CC02" } },
];

function lookupBrand(name: string): BrandColors | null {
	const normalized = name.toLowerCase();
	for (const entry of BRAND_COLORS) {
		if (entry.keywords.some((kw) => normalized.includes(kw))) {
			return entry.colors;
		}
	}
	return null;
}

export function deriveColor(name: string): string {
	const s = name.trim().toUpperCase();
	let hash = 5381;
	for (let i = 0; i < s.length; i++) {
		hash = (((hash << 5) + hash) ^ s.charCodeAt(i)) >>> 0;
	}
	return `oklch(var(--fallback-l, 58%) var(--fallback-c, 0.15) ${hash % 360})`;
}

/**
 * Returns a CSS `background` value for a dot representing the given name.
 * Known institutions get brand colors; dual-color brands return a split gradient.
 * Unknown names fall back to a hash-derived oklch color.
 */
export function getAccountBackground(name: string): string {
	const brand = lookupBrand(name);
	if (brand) {
		if (brand.secondary) {
			return `linear-gradient(135deg, ${brand.primary} 50%, ${brand.secondary} 50%)`;
		}
		return brand.primary;
	}
	return deriveColor(name);
}
