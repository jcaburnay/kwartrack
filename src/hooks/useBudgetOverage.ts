import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import { type ActualRow, computeActualsByTag } from "../utils/budgetMath";
import { monthBounds } from "../utils/dateRange";
import { useTransactionVersion } from "./useTransactionVersion";

type Snapshot = {
	overallCentavos: number;
	allocations: ReadonlyArray<{ tag_id: string; amount_centavos: number }>;
	expenses: ActualRow[];
};

/**
 * Tells the Header whether to render a red dot on the Budget nav link. True
 * when, for the user's current calendar month: any tag's actual exceeds its
 * allocation OR the overall actual exceeds the overall cap (spec §570).
 *
 * Lighter than `useBudget` — fetches only the columns needed to compute the
 * boolean. Header runs on every page so we keep the round-trip small.
 */
export function useBudgetOverage(): boolean {
	const { profile } = useAuth();
	const tz = profile?.timezone ?? "Asia/Manila";
	const month = useMemo(() => monthBounds(tz).startISO.slice(0, 7), [tz]);

	const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
	const txVersion = useTransactionVersion();

	// biome-ignore lint/correctness/useExhaustiveDependencies: txVersion is a tripwire that re-runs the fetch when transactions are mutated elsewhere.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const { startISO, endExclusiveISO } = monthBounds(tz);
			const [cfgRes, allocRes, txRes] = await Promise.all([
				supabase.from("budget_config").select("overall_centavos").eq("month", month).maybeSingle(),
				supabase.from("budget_allocation").select("tag_id, amount_centavos").eq("month", month),
				supabase
					.from("transaction")
					.select("tag_id, amount_centavos, date, split:split_event!split_id(user_share_centavos)")
					.eq("type", "expense")
					.gte("date", startISO)
					.lt("date", endExclusiveISO),
			]);
			if (cancelled) return;
			const expenses: ActualRow[] = (txRes.data ?? []).map((t) => ({
				tagId: t.tag_id,
				effectiveCentavos:
					(t.split as unknown as { user_share_centavos: number } | null)?.user_share_centavos ??
					t.amount_centavos,
				date: t.date,
			}));
			setSnapshot({
				overallCentavos: cfgRes.data?.overall_centavos ?? 0,
				allocations: allocRes.data ?? [],
				expenses,
			});
		})();
		return () => {
			cancelled = true;
		};
	}, [month, tz, txVersion]);

	return useMemo(() => {
		if (!snapshot) return false;
		const actuals = computeActualsByTag(snapshot.expenses, month);
		for (const a of snapshot.allocations) {
			const actual = actuals.get(a.tag_id) ?? 0;
			if (actual > a.amount_centavos) return true;
		}
		if (snapshot.overallCentavos > 0) {
			let overallActual = 0;
			for (const cents of actuals.values()) overallActual += cents;
			if (overallActual > snapshot.overallCentavos) return true;
		}
		return false;
	}, [snapshot, month]);
}
