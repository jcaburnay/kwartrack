export interface BankEntry {
	id: string;
	name: string;
	abbr: string;
	color: string;
	aliases: string[];
}

export const BANKS: BankEntry[] = [
	{
		id: "bdo",
		name: "BDO Unibank",
		abbr: "BDO",
		color: "#003F87",
		aliases: ["banco de oro", "bdo unibank"],
	},
	{
		id: "bpi",
		name: "Bank of the Philippine Islands",
		abbr: "BPI",
		color: "#B22222",
		aliases: ["bpi", "bank of the philippine islands"],
	},
	{
		id: "metrobank",
		name: "Metrobank",
		abbr: "MB",
		color: "#CC0000",
		aliases: ["metropolitan bank", "metrobank"],
	},
	{
		id: "rcbc",
		name: "RCBC",
		abbr: "RCBC",
		color: "#C0392B",
		aliases: ["rizal commercial", "rcbc"],
	},
	{
		id: "security-bank",
		name: "Security Bank",
		abbr: "SB",
		color: "#1A3A6B",
		aliases: ["security bank"],
	},
	{
		id: "unionbank",
		name: "UnionBank",
		abbr: "UB",
		color: "#E87722",
		aliases: ["union bank", "unionbank of the philippines"],
	},
	{
		id: "pnb",
		name: "Philippine National Bank",
		abbr: "PNB",
		color: "#003087",
		aliases: ["pnb", "philippine national bank"],
	},
	{
		id: "chinabank",
		name: "China Banking Corporation",
		abbr: "CBC",
		color: "#B8000B",
		aliases: ["chinabank", "china bank"],
	},
	{
		id: "eastwest",
		name: "EastWest Bank",
		abbr: "EW",
		color: "#E8262C",
		aliases: ["east west bank", "eastwest"],
	},
	{
		id: "landbank",
		name: "Landbank of the Philippines",
		abbr: "LBP",
		color: "#006633",
		aliases: ["land bank", "landbank"],
	},
	{
		id: "psbank",
		name: "PSBank",
		abbr: "PSB",
		color: "#003087",
		aliases: ["philippine savings bank", "psbank"],
	},
	{ id: "gcash", name: "GCash", abbr: "G", color: "#007DFF", aliases: ["gcash", "globe cash"] },
	{ id: "maya", name: "Maya", abbr: "M", color: "#17C2A4", aliases: ["maya", "paymaya"] },
	{
		id: "shopee-pay",
		name: "ShopeePay",
		abbr: "SP",
		color: "#EE4D2D",
		aliases: ["shopee pay", "shopeepay"],
	},
	{
		id: "seabank",
		name: "SeaBank",
		abbr: "SEA",
		color: "#2E8B57",
		aliases: ["seabank", "sea bank"],
	},
	{
		id: "gotyme",
		name: "GoTyme Bank",
		abbr: "GT",
		color: "#FF6B35",
		aliases: ["gotyme", "go tyme"],
	},
	{ id: "tonik", name: "Tonik", abbr: "TK", color: "#6C2BD9", aliases: ["tonik"] },
	{ id: "coins", name: "Coins.ph", abbr: "C", color: "#2C3E8C", aliases: ["coins", "coins.ph"] },
	{
		id: "ctbc",
		name: "CTBC Bank Philippines",
		abbr: "CTBC",
		color: "#D40000",
		aliases: ["ctbc", "ctbc bank"],
	},
	{
		id: "allbank",
		name: "AllBank",
		abbr: "ALL",
		color: "#003F7F",
		aliases: ["allbank", "all bank"],
	},
];

/**
 * Returns up to 5 banks whose name or aliases contain the query (case-insensitive).
 * Returns empty array if query is fewer than 2 characters.
 */
export function filterBanks(query: string): BankEntry[] {
	const q = query.toLowerCase().trim();
	if (q.length < 2) return [];
	return BANKS.filter(
		(b) => b.name.toLowerCase().includes(q) || b.aliases.some((a) => a.toLowerCase().includes(q)),
	).slice(0, 5);
}

/**
 * Returns the BankEntry for the given id, or undefined if not found.
 */
export function findBank(id: string): BankEntry | undefined {
	return BANKS.find((b) => b.id === id);
}
