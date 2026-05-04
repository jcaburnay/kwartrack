import { useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/supabase";
import type { DebtRow } from "../utils/debtFilters";
import type { DebtInput } from "../utils/debtValidation";
import type { SplitRow } from "../utils/splitFilters";
import type { SplitInput } from "../utils/splitValidation";
import { createSharedStore, registerSharedStore } from "./sharedStore";
import { bumpTransactionVersion } from "./useTransactionVersion";

type DebtRaw = Database["public"]["Tables"]["debt"]["Row"];
type SplitRaw = Database["public"]["Tables"]["split_event"]["Row"];
type ParticipantRaw = Database["public"]["Tables"]["split_participant"]["Row"];

type DebtWithJoins = DebtRaw & {
	person: { name: string };
	split: { tag_id: string } | null;
};

type SplitWithJoins = SplitRaw & {
	participants: (ParticipantRaw & { person: { name: string } })[];
	debts: { settled_centavos: number; amount_centavos: number }[];
};

type DebtsAndSplits = { debts: DebtRow[]; splits: SplitRow[] };

export type ExpandedSplitParticipant = {
	participantId: string;
	debtId: string;
	personId: string;
	personName: string;
	shareCentavos: number;
	settledCentavos: number;
};

const store = createSharedStore<DebtsAndSplits>(
	async () => {
		const [debtsRes, splitsRes] = await Promise.all([
			supabase
				.from("debt")
				.select("*, person:person!person_id(name), split:split_event!split_id(tag_id)")
				.order("date", { ascending: false }),
			supabase
				.from("split_event")
				.select(
					`*,
				participants:split_participant(*, person:person!person_id(name)),
				debts:debt(settled_centavos, amount_centavos)`,
				)
				.order("date", { ascending: false }),
		]);
		const err = debtsRes.error?.message ?? splitsRes.error?.message ?? null;
		if (err) throw new Error(err);

		const debts: DebtRow[] = (debtsRes.data as unknown as DebtWithJoins[]).map((d) => ({
			id: d.id,
			personId: d.person_id,
			personName: d.person.name,
			direction: d.direction,
			amountCentavos: d.amount_centavos,
			settledCentavos: d.settled_centavos,
			tagId: d.tag_id ?? d.split?.tag_id ?? null,
			tagName: null,
			date: d.date,
			description: d.description,
			splitId: d.split_id,
		}));

		const splits: SplitRow[] = (splitsRes.data as unknown as SplitWithJoins[]).map((s) => ({
			id: s.id,
			description: s.description,
			totalCentavos: s.total_centavos,
			userShareCentavos: s.user_share_centavos,
			paidFromAccountId: s.paid_from_account_id,
			tagId: s.tag_id,
			tagName: "",
			method: s.method,
			date: s.date,
			// Count of non-payer participants (people who owe you for their share).
			// The "{N}-way" wording adds +1 at the display site to include you.
			participantCount: s.participants.length,
			settledCount: s.debts.filter((d) => d.settled_centavos >= d.amount_centavos).length,
			participantNames: s.participants.map((p) => p.person.name),
		}));

		return { debts, splits };
	},
	{ debts: [], splits: [] },
);

registerSharedStore(store.reset);

export function useDebtsAndSplits() {
	const { data, isLoading, error, refetch } = store.useStore();
	const { debts, splits } = data;

	const balance = useMemo(() => {
		let owed = 0;
		let owe = 0;
		for (const d of debts) {
			const remaining = d.amountCentavos - d.settledCentavos;
			if (remaining <= 0) continue;
			if (d.direction === "loaned") owed += remaining;
			else owe += remaining;
		}
		return { owedCentavos: owed, oweCentavos: owe };
	}, [debts]);

	const hasUnsettledLoaned = useMemo(
		() => debts.some((d) => d.direction === "loaned" && d.settledCentavos < d.amountCentavos),
		[debts],
	);

	const createSplit = useCallback(
		async (input: SplitInput): Promise<{ error: string | null }> => {
			const { error: rpcErr } = await supabase.rpc("create_split", {
				p_description: input.description.trim(),
				p_total_centavos: input.totalCentavos,
				p_date: input.date,
				p_paid_from_account_id: input.paidFromAccountId as string,
				p_tag_id: input.tagId as string,
				p_method: input.method,
				p_participants: input.participants.map((p) => ({
					person_id: p.personId,
					share_centavos: p.shareCentavos,
					share_input_value: p.shareInputValue ?? null,
				})),
			});
			if (rpcErr) return { error: rpcErr.message };
			bumpTransactionVersion();
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	const updateSplit = useCallback(
		async (id: string, input: SplitInput): Promise<{ error: string | null }> => {
			const { error: rpcErr } = await supabase.rpc("update_split", {
				p_split_id: id,
				p_description: input.description.trim(),
				p_total_centavos: input.totalCentavos,
				p_date: input.date,
				p_paid_from_account_id: input.paidFromAccountId as string,
				p_tag_id: input.tagId as string,
				p_method: input.method,
				p_participants: input.participants.map((p) => ({
					person_id: p.personId,
					share_centavos: p.shareCentavos,
					share_input_value: p.shareInputValue ?? null,
				})),
			});
			if (rpcErr) return { error: rpcErr.message };
			bumpTransactionVersion();
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	const deleteSplit = useCallback(
		async (id: string): Promise<{ error: string | null }> => {
			const { error: delErr } = await supabase.from("split_event").delete().eq("id", id);
			if (delErr) return { error: delErr.message };
			bumpTransactionVersion();
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	const createDebt = useCallback(
		async (input: DebtInput): Promise<{ error: string | null }> => {
			const { data: userData } = await supabase.auth.getUser();
			if (!userData.user) return { error: "Not signed in" };
			const { error: insErr } = await supabase.from("debt").insert({
				user_id: userData.user.id,
				person_id: input.personId as string,
				direction: input.direction,
				amount_centavos: input.amountCentavos,
				date: input.date,
				description: input.description.trim() || null,
				paid_account_id: input.paidAccountId,
				tag_id: input.tagId,
			});
			if (insErr) return { error: insErr.message };
			bumpTransactionVersion();
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	const deleteDebt = useCallback(
		async (id: string): Promise<{ error: string | null }> => {
			const { error: delErr } = await supabase.from("debt").delete().eq("id", id);
			if (delErr) return { error: delErr.message };
			bumpTransactionVersion();
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	const settleDebt = useCallback(
		async (
			debtId: string,
			amountCentavos: number,
			paidAccountId: string,
			date: string,
		): Promise<{ error: string | null }> => {
			const { error: rpcErr } = await supabase.rpc("settle_debt", {
				p_debt_id: debtId,
				p_amount_centavos: amountCentavos,
				p_paid_account_id: paidAccountId,
				p_date: date,
			});
			if (rpcErr) return { error: rpcErr.message };
			bumpTransactionVersion();
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	const splitParticipants = useCallback(
		async (splitId: string): Promise<ExpandedSplitParticipant[]> => {
			const { data: rows, error: selErr } = await supabase
				.from("split_participant")
				.select(
					`id, person_id, share_centavos, person:person!person_id(name),
				 debts:debt!participant_id(id, settled_centavos, amount_centavos)`,
				)
				.eq("split_id", splitId);
			if (selErr || !rows) return [];
			return (
				rows as unknown as Array<{
					id: string;
					person_id: string;
					share_centavos: number;
					person: { name: string };
					debts: Array<{
						id: string;
						settled_centavos: number;
						amount_centavos: number;
					}>;
				}>
			).map((p) => ({
				participantId: p.id,
				debtId: p.debts[0]?.id ?? "",
				personId: p.person_id,
				personName: p.person.name,
				shareCentavos: p.share_centavos,
				settledCentavos: p.debts[0]?.settled_centavos ?? 0,
			}));
		},
		[],
	);

	return {
		debts,
		splits,
		isLoading,
		error,
		balance,
		hasUnsettledLoaned,
		refetch,
		createSplit,
		updateSplit,
		deleteSplit,
		createDebt,
		deleteDebt,
		settleDebt,
		splitParticipants,
	};
}
