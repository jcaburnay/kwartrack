import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type SB = SupabaseClient<Database>;

export const ENTITY_KEYS = [
	"account",
	"account_group",
	"tag",
	"person",
	"transaction",
	"recurring",
	"debt",
	"split_event",
	"split_participant",
	"budget_config",
	"budget_allocation",
] as const;

export type EntityKey = (typeof ENTITY_KEYS)[number];

export const ENTITY_LABELS: Record<EntityKey, string> = {
	account: "Accounts",
	account_group: "Account groups",
	tag: "Tags",
	person: "Contacts",
	transaction: "Transactions",
	recurring: "Recurrings",
	debt: "Debts",
	split_event: "Splits",
	split_participant: "Split participants",
	budget_config: "Budget configs",
	budget_allocation: "Budget allocations",
};

type AnyRow = Record<string, unknown>;

async function fetchUserOwned(sb: SB, table: EntityKey, userId: string): Promise<AnyRow[]> {
	if (table === "split_participant") {
		const { data: splits, error: splitErr } = await sb
			.from("split_event")
			.select("id")
			.eq("user_id", userId);
		if (splitErr) throw splitErr;
		const ids = (splits ?? []).map((s) => s.id);
		if (ids.length === 0) return [];
		const { data, error } = await sb.from("split_participant").select("*").in("split_id", ids);
		if (error) throw error;
		return (data ?? []) as AnyRow[];
	}

	const { data, error } = await sb.from(table).select("*").eq("user_id", userId);
	if (error) throw error;
	return (data ?? []) as AnyRow[];
}

function downloadFile(filename: string, mime: string, content: string) {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

function dateStamp(d: Date = new Date()): string {
	const yyyy = d.getFullYear();
	const mm = `${d.getMonth() + 1}`.padStart(2, "0");
	const dd = `${d.getDate()}`.padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

export async function exportFullJson(sb: SB, userId: string): Promise<void> {
	const { data: profile, error: profileErr } = await sb
		.from("user_profile")
		.select("*")
		.eq("id", userId)
		.maybeSingle();
	if (profileErr) throw profileErr;

	const tables: Partial<Record<EntityKey, AnyRow[]>> = {};
	for (const key of ENTITY_KEYS) {
		tables[key] = await fetchUserOwned(sb, key, userId);
	}

	const payload = {
		exportedAt: new Date().toISOString(),
		user: profile,
		accounts: tables.account ?? [],
		groups: tables.account_group ?? [],
		tags: tables.tag ?? [],
		persons: tables.person ?? [],
		transactions: tables.transaction ?? [],
		recurrings: tables.recurring ?? [],
		budgets: {
			configs: tables.budget_config ?? [],
			allocations: tables.budget_allocation ?? [],
		},
		debts: tables.debt ?? [],
		splitEvents: tables.split_event ?? [],
		splitParticipants: tables.split_participant ?? [],
	};

	downloadFile(
		`kwartrack-backup-${dateStamp()}.json`,
		"application/json",
		JSON.stringify(payload, null, 2),
	);
}

function csvCell(v: unknown): string {
	if (v == null) return "";
	if (typeof v === "object") return quote(JSON.stringify(v));
	const s = String(v);
	return /[",\n\r]/.test(s) ? quote(s) : s;
}

function quote(s: string): string {
	return `"${s.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows: AnyRow[]): string {
	if (rows.length === 0) return "";
	// Stable column order: union of keys, in first-seen order across all rows.
	const cols: string[] = [];
	const seen = new Set<string>();
	for (const r of rows) {
		for (const k of Object.keys(r)) {
			if (!seen.has(k)) {
				seen.add(k);
				cols.push(k);
			}
		}
	}
	const lines = [cols.join(",")];
	for (const r of rows) {
		lines.push(cols.map((c) => csvCell(r[c])).join(","));
	}
	return lines.join("\n");
}

export async function exportEntityCsv(sb: SB, userId: string, entity: EntityKey): Promise<void> {
	const rows = await fetchUserOwned(sb, entity, userId);
	const csv = rowsToCsv(rows);
	downloadFile(
		`kwartrack-${entity}-${dateStamp()}.csv`,
		"text/csv;charset=utf-8",
		csv || `# No ${entity} rows.\n`,
	);
}
