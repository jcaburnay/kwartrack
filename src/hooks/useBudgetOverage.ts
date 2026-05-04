import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import { monthBounds } from "../utils/dateRange";
import { useBudgetActualsByMonth } from "./useBudgetActuals";
import { useTransactionVersion } from "./useTransactionVersion";

type Snapshot = {
	overallCentavos: number;
	allocations: ReadonlyArray<{ tag_id: string; amount_centavos: number }>;
};

/**
 * Tells the Header whether to render a red dot on the Budget nav link. True
 * when, for the user's current calendar month: any tag's actual exceeds its
 * allocation OR the overall actual exceeds the overall cap (spec §570).
 *
 * Reads pre-aggregated actuals from the `budget_actuals` Postgres view via
 * the shared store, so this hook + useBudget don't double-fetch transactions.
 */
export function useBudgetOverage(): boolean {
	const { profile } = useAuth();
	const tz = profile?.timezone ?? "Asia/Manila";
	const month = useMemo(() => monthBounds(tz).startISO.slice(0, 7), [tz]);

	const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
	const txVersion = useTransactionVersion();
	const { actualsByTag } = useBudgetActualsByMonth(month);

	// biome-ignore lint/correctness/useExhaustiveDependencies: txVersion is a tripwire that re-runs the fetch when transactions are mutated elsewhere.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const [cfgRes, allocRes] = await Promise.all([
				supabase.from("budget_config").select("overall_centavos").eq("month", month).maybeSingle(),
				supabase.from("budget_allocation").select("tag_id, amount_centavos").eq("month", month),
			]);
			if (cancelled) return;
			setSnapshot({
				overallCentavos: cfgRes.data?.overall_centavos ?? 0,
				allocations: allocRes.data ?? [],
			});
		})();
		return () => {
			cancelled = true;
		};
	}, [month, txVersion]);

	return useMemo(() => {
		if (!snapshot) return false;
		for (const a of snapshot.allocations) {
			const actual = actualsByTag.get(a.tag_id) ?? 0;
			if (actual > a.amount_centavos) return true;
		}
		if (snapshot.overallCentavos > 0) {
			let overallActual = 0;
			for (const cents of actualsByTag.values()) overallActual += cents;
			if (overallActual > snapshot.overallCentavos) return true;
		}
		return false;
	}, [snapshot, actualsByTag]);
}
