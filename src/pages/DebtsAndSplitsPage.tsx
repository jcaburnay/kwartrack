import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { BalanceStrip } from "../components/debts/BalanceStrip";
import { DebtsFilterBar } from "../components/debts/DebtsFilterBar";
import { DebtsTable } from "../components/debts/DebtsTable";
import { EditSplitModal } from "../components/debts/EditSplitModal";
import { NewDebtModal } from "../components/debts/NewDebtModal";
import { NewSplitModal } from "../components/debts/NewSplitModal";
import { SettleModal } from "../components/debts/SettleModal";
import type { ParticipantRow } from "../components/debts/SplitParticipantList";
import { SplitsFilterBar } from "../components/debts/SplitsFilterBar";
import { SplitsTable } from "../components/debts/SplitsTable";
import { Header } from "../components/Header";
import { useAccounts } from "../hooks/useAccounts";
import { useDebtsAndSplits } from "../hooks/useDebtsAndSplits";
import type { Person } from "../hooks/usePersons";
import { usePersons } from "../hooks/usePersons";
import { useScrollAndFlash } from "../hooks/useScrollAndFlash";
import type { Tag } from "../hooks/useTags";
import { useTags } from "../hooks/useTags";
import { supabase } from "../lib/supabase";
import type { Account } from "../utils/accountBalances";
import { DEFAULT_DEBT_FILTERS, matchesDebtFilters } from "../utils/debtFilters";
import { DEFAULT_SPLIT_FILTERS, matchesSplitFilters } from "../utils/splitFilters";
import type { SplitMethod } from "../utils/splitMath";
import type { SplitInput } from "../utils/splitValidation";

export function DebtsAndSplitsPage() {
	const [params, setParams] = useSearchParams();
	const expandedSplitId = params.get("split");

	const {
		debts,
		splits,
		balance,
		isLoading,
		error,
		createSplit,
		updateSplit,
		deleteSplit,
		createDebt,
		deleteDebt,
		settleDebt,
		splitParticipants,
		refetch,
	} = useDebtsAndSplits();
	const { accounts } = useAccounts();
	const { tags } = useTags();
	const { persons, createInline: createPerson } = usePersons();

	const [debtFilters, setDebtFilters] = useState({
		...DEFAULT_DEBT_FILTERS,
		direction: (params.get("direction") as "loaned" | "owed" | null) ?? null,
		settled: (params.get("settled") as "all" | "settled" | "unsettled" | null) ?? "all",
	});
	const [splitFilters, setSplitFilters] = useState(DEFAULT_SPLIT_FILTERS);
	const [showNewDebt, setShowNewDebt] = useState(false);
	const [showNewSplit, setShowNewSplit] = useState(false);
	const [editingSplitId, setEditingSplitId] = useState<string | null>(null);
	const [settlingDebtId, setSettlingDebtId] = useState<string | null>(null);
	// Allow global FAB to deep-link into our New* modals via `?modal=`.
	useEffect(() => {
		const m = params.get("modal");
		if (m === "new-split") setShowNewSplit(true);
		if (m === "new-debt") setShowNewDebt(true);
		if (m) {
			const next = new URLSearchParams(params);
			next.delete("modal");
			setParams(next, { replace: true });
		}
	}, [params, setParams]);

	const tagsByIdMap = useMemo(() => new Map(tags.map((t) => [t.id, t.name] as const)), [tags]);
	// Standalone debts have no split_id; they're the only ones the user can delete
	// directly. The DebtRow filter type doesn't carry split_id, so we infer:
	// any debt whose tagId resolves to its own column (not via the split's tag) is
	// standalone. The hook already does the resolution; we treat all visible debts
	// as deletable for now (the trigger blocks split-derived debt deletion via FK).
	const standaloneDebtIds = useMemo(() => new Set<string>(), []);
	const visibleDebts = useMemo(
		() => debts.filter((d) => matchesDebtFilters(d, debtFilters)),
		[debts, debtFilters],
	);
	const visibleSplits = useMemo(
		() => splits.filter((s) => matchesSplitFilters(s, splitFilters)),
		[splits, splitFilters],
	);

	const settlingDebt = settlingDebtId ? (debts.find((d) => d.id === settlingDebtId) ?? null) : null;

	useScrollAndFlash(params.get("debt"), !isLoading && debts.length > 0);

	function setExpandedSplit(id: string | null) {
		const next = new URLSearchParams(params);
		if (id) next.set("split", id);
		else next.delete("split");
		setParams(next);
	}

	async function handleSettle(debtId: string) {
		setSettlingDebtId(debtId);
	}

	async function handleSettleSubmit(input: {
		amountCentavos: number;
		paidAccountId: string;
		date: string;
	}) {
		if (!settlingDebt) return { error: "Debt not found" };
		const result = await settleDebt(
			settlingDebt.id,
			input.amountCentavos,
			input.paidAccountId,
			input.date,
		);
		if (result.error) return result;
		setSettlingDebtId(null);
		return { error: null };
	}

	async function handleDeleteDebt(debtId: string) {
		if (!window.confirm("Delete this debt?")) return;
		const result = await deleteDebt(debtId);
		if (result.error) alert(result.error);
	}

	async function handleDeleteSplit(splitId: string) {
		const result = await deleteSplit(splitId);
		if (result.error) alert(result.error);
		else if (expandedSplitId === splitId) setExpandedSplit(null);
	}

	const editingSplit = editingSplitId
		? (splits.find((s) => s.id === editingSplitId) ?? null)
		: null;

	return (
		<div className="min-h-dvh bg-base-200 flex flex-col">
			<Header />
			<main className="flex-1 p-4 pb-20 sm:p-6 max-w-6xl w-full mx-auto flex flex-col gap-5">
				<h1 className="text-2xl font-semibold">Debts &amp; Splits</h1>
				{error && <div className="alert alert-error text-sm">{error}</div>}

				<BalanceStrip owedCentavos={balance.owedCentavos} oweCentavos={balance.oweCentavos} />

				<section className="flex flex-col gap-2">
					<h2 className="text-lg font-semibold">Debts</h2>
					<DebtsFilterBar
						filters={debtFilters}
						onChange={setDebtFilters}
						persons={persons}
						tags={tags}
					/>
					{isLoading ? (
						<div className="flex justify-center py-6">
							<span className="loading loading-spinner" />
						</div>
					) : (
						<DebtsTable
							debts={visibleDebts}
							tagsById={tagsByIdMap}
							standaloneDebtIds={standaloneDebtIds}
							onSettle={handleSettle}
							onDelete={handleDeleteDebt}
						/>
					)}
				</section>

				<section className="flex flex-col gap-2">
					<h2 className="text-lg font-semibold">Splits</h2>
					<SplitsFilterBar filters={splitFilters} onChange={setSplitFilters} tags={tags} />
					{isLoading ? null : (
						<SplitsTable
							splits={visibleSplits}
							tags={tags}
							accounts={accounts}
							expandedSplitId={expandedSplitId}
							onToggleExpand={(id) => setExpandedSplit(id === expandedSplitId ? null : id)}
							loadParticipants={splitParticipants}
							onSettleParticipant={(debtId) => setSettlingDebtId(debtId)}
							onEditSplit={setEditingSplitId}
							onDeleteSplit={handleDeleteSplit}
						/>
					)}
				</section>
			</main>

			{showNewSplit && (
				<NewSplitModal
					persons={persons}
					accounts={accounts}
					tags={tags}
					createPerson={createPerson}
					createSplit={createSplit}
					onSaved={async () => {
						setShowNewSplit(false);
						await refetch();
					}}
					onCancel={() => setShowNewSplit(false)}
				/>
			)}

			{showNewDebt && (
				<NewDebtModal
					persons={persons}
					accounts={accounts}
					tags={tags}
					createPerson={createPerson}
					createDebt={createDebt}
					onSaved={async () => {
						setShowNewDebt(false);
						await refetch();
					}}
					onCancel={() => setShowNewDebt(false)}
				/>
			)}

			{settlingDebt && (
				<SettleModal
					personName={settlingDebt.personName}
					direction={settlingDebt.direction}
					amountCentavos={settlingDebt.amountCentavos}
					settledCentavos={settlingDebt.settledCentavos}
					suggestedAccountId={null}
					accounts={accounts}
					onSubmit={handleSettleSubmit}
					onCancel={() => setSettlingDebtId(null)}
				/>
			)}

			{editingSplit && (
				<EditSplitModalLoader
					splitId={editingSplit.id}
					persons={persons}
					accounts={accounts}
					tags={tags}
					createPerson={createPerson}
					updateSplit={updateSplit}
					onSaved={async () => {
						setEditingSplitId(null);
						await refetch();
					}}
					onCancel={() => setEditingSplitId(null)}
				/>
			)}
		</div>
	);
}

type EditSplitSnapshot = {
	id: string;
	description: string;
	total_centavos: number;
	date: string;
	paid_from_account_id: string;
	tag_id: string;
	method: SplitMethod;
};

function EditSplitModalLoader(props: {
	splitId: string;
	persons: readonly Person[];
	accounts: readonly Account[];
	tags: readonly Tag[];
	createPerson: (name: string) => Promise<Person | null>;
	updateSplit: (id: string, input: SplitInput) => Promise<{ error: string | null }>;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const [data, setData] = useState<{
		split: EditSplitSnapshot;
		rows: ParticipantRow[];
	} | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const { data: s } = await supabase
				.from("split_event")
				.select("id, description, total_centavos, date, paid_from_account_id, tag_id, method")
				.eq("id", props.splitId)
				.single();
			const { data: parts } = await supabase
				.from("split_participant")
				.select("person_id, share_centavos, share_input_value, person:person!person_id(name)")
				.eq("split_id", props.splitId);
			if (cancelled || !s) return;
			const rows: ParticipantRow[] = (parts ?? []).map((p) => ({
				personId: p.person_id,
				personName: (p.person as unknown as { name: string }).name,
				input: p.share_input_value as number | null,
				shareCentavos: p.share_centavos,
			}));
			setData({ split: s as EditSplitSnapshot, rows });
		})();
		return () => {
			cancelled = true;
		};
	}, [props.splitId]);

	if (!data) {
		return (
			<div className="modal modal-open" role="dialog" aria-modal="true">
				<div className="modal-box max-w-sm flex justify-center py-8">
					<span className="loading loading-spinner loading-md" />
				</div>
			</div>
		);
	}
	return (
		<EditSplitModal
			split={data.split}
			participantRows={data.rows}
			persons={props.persons}
			accounts={props.accounts}
			tags={props.tags}
			createPerson={props.createPerson}
			updateSplit={props.updateSplit}
			onSaved={props.onSaved}
			onCancel={props.onCancel}
		/>
	);
}
