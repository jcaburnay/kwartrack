import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAccounts } from "../../hooks/useAccounts";
import { useDebtsAndSplits } from "../../hooks/useDebtsAndSplits";
import type { Person } from "../../hooks/usePersons";
import { usePersons } from "../../hooks/usePersons";
import type { Tag } from "../../hooks/useTags";
import { useTags } from "../../hooks/useTags";
import { supabase } from "../../lib/supabase";
import type { Account } from "../../utils/accountBalances";
import { DEFAULT_DEBT_FILTERS, matchesDebtFilters } from "../../utils/debtFilters";
import { DEFAULT_SPLIT_FILTERS, matchesSplitFilters } from "../../utils/splitFilters";
import type { SplitMethod } from "../../utils/splitMath";
import type { SplitInput } from "../../utils/splitValidation";
import { BalanceStrip } from "../debts/BalanceStrip";
import { DebtsFilterBar } from "../debts/DebtsFilterBar";
import { DebtsTable } from "../debts/DebtsTable";
import { EditSplitModal } from "../debts/EditSplitModal";
import { NewDebtModal } from "../debts/NewDebtModal";
import { NewSplitModal } from "../debts/NewSplitModal";
import { SettleModal } from "../debts/SettleModal";
import type { ParticipantRow } from "../debts/SplitParticipantList";
import { SplitsFilterBar } from "../debts/SplitsFilterBar";
import { SplitsTable } from "../debts/SplitsTable";

type Props = { pendingModal: string | null; onClose: () => void };

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
	const [data, setData] = useState<{ split: EditSplitSnapshot; rows: ParticipantRow[] } | null>(
		null,
	);

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

export function DebtsDrawer({ pendingModal, onClose }: Props) {
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

	const [debtFilters, setDebtFilters] = useState(DEFAULT_DEBT_FILTERS);
	const [splitFilters, setSplitFilters] = useState(DEFAULT_SPLIT_FILTERS);
	const [showNewDebt, setShowNewDebt] = useState(false);
	const [showNewSplit, setShowNewSplit] = useState(false);
	const [editingSplitId, setEditingSplitId] = useState<string | null>(null);
	const [settlingDebtId, setSettlingDebtId] = useState<string | null>(null);
	const [expandedSplitId, setExpandedSplitId] = useState<string | null>(null);

	useEffect(() => {
		if (pendingModal === "new-split") setShowNewSplit(true);
		else if (pendingModal === "new-debt") setShowNewDebt(true);
	}, [pendingModal]);

	const tagsByIdMap = useMemo(() => new Map(tags.map((t) => [t.id, t.name] as const)), [tags]);
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
		else if (expandedSplitId === splitId) setExpandedSplitId(null);
	}

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between p-4 border-b border-base-200">
				<h2 className="text-lg font-semibold">Debts & Splits</h2>
				<div className="flex items-center gap-2">
					<button
						type="button"
						className="btn btn-outline btn-sm"
						onClick={() => setShowNewDebt(true)}
					>
						New Debt
					</button>
					<button
						type="button"
						className="btn btn-primary btn-sm"
						onClick={() => setShowNewSplit(true)}
					>
						New Split
					</button>
					<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
						<X className="size-4" />
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5">
				{error && <div className="alert alert-error text-sm">{error}</div>}
				<BalanceStrip owedCentavos={balance.owedCentavos} oweCentavos={balance.oweCentavos} />

				<section className="flex flex-col gap-2">
					<h3 className="text-base font-semibold">Debts</h3>
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
							onSettle={(id) => setSettlingDebtId(id)}
							onDelete={handleDeleteDebt}
						/>
					)}
				</section>

				<section className="flex flex-col gap-2">
					<h3 className="text-base font-semibold">Splits</h3>
					<SplitsFilterBar filters={splitFilters} onChange={setSplitFilters} tags={tags} />
					{isLoading ? null : (
						<SplitsTable
							splits={visibleSplits}
							tags={tags}
							accounts={accounts}
							expandedSplitId={expandedSplitId}
							onToggleExpand={(id) => setExpandedSplitId(id === expandedSplitId ? null : id)}
							loadParticipants={splitParticipants}
							onSettleParticipant={(debtId) => setSettlingDebtId(debtId)}
							onEditSplit={setEditingSplitId}
							onDeleteSplit={handleDeleteSplit}
						/>
					)}
				</section>
			</div>

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

			{editingSplitId && (
				<EditSplitModalLoader
					splitId={editingSplitId}
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
