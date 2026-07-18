import type { LucideIcon } from "lucide-react";
import { MoonStar, PiggyBank, Repeat, Target, Users, Wallet } from "lucide-react";

export const GITHUB_URL = "https://github.com/jcaburnay/kwartrack";
export const DOCS_URL = `${GITHUB_URL}/blob/main/specs_v2.md`;
export const SELF_HOST_URL = `${GITHUB_URL}#self-hosting`;

export const HEADLINE = "Every peso, clearly tracked.";
export const SUBHEAD =
	"A calm, ₱-first personal finance tracker — accounts, budgets, recurring bills, debts, and splits in one quiet dashboard. Use the free hosted app, or self-host your own.";
export const TRUST_LINE = "Open source (MIT) · Self-hostable · No ads, no data selling";

export type Feature = { icon: LucideIcon; title: string; body: string };

export const FEATURES: Feature[] = [
	{
		icon: Wallet,
		title: "Accounts",
		body: "E-wallets, banks, cash, cards, and time deposits — optionally grouped.",
	},
	{
		icon: Target,
		title: "Budgets",
		body: "Monthly caps plus per-tag limits, with gentle over-budget warnings.",
	},
	{
		icon: Repeat,
		title: "Recurring",
		body: "Netflix, rent, salary — transactions auto-post on their schedule.",
	},
	{
		icon: Users,
		title: "Debts & splits",
		body: "Track loans and split group expenses; balances settle automatically.",
	},
	{
		icon: PiggyBank,
		title: "Time deposits",
		body: "Set principal, rate, and maturity; interest posts on schedule.",
	},
	{
		icon: MoonStar,
		title: "₱-first & themed",
		body: "Built for pesos, with system-adaptive light and dark themes.",
	},
];
