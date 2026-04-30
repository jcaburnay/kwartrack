import { useEffect, useMemo, useState } from "react";
import { useAccounts } from "../../hooks/useAccounts";
import { useDebtsAndSplits } from "../../hooks/useDebtsAndSplits";
import type { Person } from "../../hooks/usePersons";
import { usePersons } from "../../hooks/usePersons";
import type { Tag } from "../../hooks/useTags";
import { useTags } from "../../hooks/useTags";
import { supabase } from "../../lib/supabase";
import type { Account } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";
import type { SplitMethod } from "../../utils/splitMath";
import type { SplitInput } from "../../utils/splitValidation";
import { DebtsTable } from "../debts/DebtsTable";
import { EditSplitModal } from "../debts/EditSplitModal";
import { NewDebtModal } from "../debts/NewDebtModal";
import { NewSplitModal } from "../debts/NewSplitModal";
import { SettleModal } from "../debts/SettleModal";
import type { ParticipantRow } from "../debts/SplitParticipantList";
import { SplitsTable } from "../debts/SplitsTable";

export type DebtsPending = "new-debt" | "new-split" | null;

type Props = {
	pendingModal: DebtsPending;
	onPendingModalConsumed: () => void;
	onCrossFilterSplit: (filter: { id: string; label: string }) => void;
};

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

export function DebtsPanel({ pendingModal, onPendingModalConsumed, onCrossFilterSplit }: Props) {
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

	const [showSettled, setShowSettled] = useState(false);
	const [showNewDebt, setShowNewDebt] = useState(false);
	const [showNewSplit, setShowNewSplit] = useState(false);
	const [editingSplitId, setEditingSplitId] = useState<string | null>(null);
	const [settlingDebtId, setSettlingDebtId] = useState<string | null>(null);
	const [expandedSplitId, setExpandedSplitId] = useState<string | null>(null);
	const [pendingDelete, setPendingDelete] = useState<{ kind: "debt" | "split"; id: string } | null>(
		null,
	);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	useEffect(() => {
		if (pendingModal === "new-debt") {
			setShowNewDebt(true);
			onPendingModalConsumed();
		} else if (pendingModal === "new-split") {
			setShowNewSplit(true);
			onPendingModalConsumed();
		}
	}, [pendingModal, onPendingModalConsumed]);

	const tagsByIdMap = useMemo(() => new Map(tags.map((t) => [t.id, t.name] as const)), [tags]);
	const standaloneDebtIds = useMemo(
		() => new Set(debts.filter((d) => d.splitId == null).map((d) => d.id)),
		[debts],
	);

	const visibleDebts = useMemo(
		() => (showSettled ? debts : debts.filter((d) => d.settledCentavos < d.amountCentavos)),
		[debts, showSettled],
	);
	const visibleSplits = useMemo(
		() => (showSettled ? splits : splits.filter((s) => s.settledCount < s.participantCount)),
		[splits, showSettled],
	);

	const pendingDebtCount = useMemo(
		() => debts.filter((d) => d.settledCentavos < d.amountCentavos).length,
		[debts],
	);
	const activeSplitCount = useMemo(
		() => splits.filter((s) => s.settledCount < s.participantCount).length,
		[splits],
	);

	const summaryTokens: string[] = [];
	if (balance.owedCentavos > 0) {
		summaryTokens.push(`${formatCentavos(balance.owedCentavos)} owed`);
	}
	if (balance.oweCentavos > 0) {
		summaryTokens.push(`${formatCentavos(balance.oweCentavos)} you owe`);
	}
	if (pendingDebtCount > 0) {
		summaryTokens.push(`${pendingDebtCount} pending`);
	}
	if (activeSplitCount > 0) {
		summaryTokens.push(`${activeSplitCount} ${activeSplitCount === 1 ? "split" : "splits"}`);
	}
	if (summaryTokens.length === 0) {
		summaryTokens.push("all settled");
	}

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

	function handleDeleteDebt(debtId: string) {
		setDeleteError(null);
		setPendingDelete({ kind: "debt", id: debtId });
	}

	function handleDeleteSplit(splitId: string) {
		setDeleteError(null);
		setPendingDelete({ kind: "split", id: splitId });
	}

	async function confirmPendingDelete() {
		if (!pendingDelete) return;
		setIsDeleting(true);
		const { kind, id } = pendingDelete;
		const result = kind === "debt" ? await deleteDebt(id) : await deleteSplit(id);
		setIsDeleting(false);
		if (result.error) {
			setDeleteError(result.error);
			return;
		}
		if (kind === "split" && expandedSplitId === id) setExpandedSplitId(null);
		setPendingDelete(null);
	}

	function cancelPendingDelete() {
		if (isDeleting) return;
		setPendingDelete(null);
	}

	const isEmpty = !isLoading && visibleSplits.length === 0 && visibleDebts.length === 0;

	return (
		<div className="bg-base-100 border border-base-300 h-full flex flex-col">
			<div className="h-9 flex items-center px-4 border-b border-base-300 flex-shrink-0">
				<div className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold text-base-content/50 min-w-0">
					<span>Debts & Splits</span>
					<span className="text-base-content/40 normal-case tracking-normal truncate">
						· {summaryTokens.join(" · ")}
					</span>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto flex flex-col min-h-0">
				{error && <div className="alert alert-error text-sm mx-4 mt-3">{error}</div>}
				{deleteError && !pendingDelete && (
					<div className="alert alert-error text-sm mx-4 mt-3">
						<span>{deleteError}</span>
						<button
							type="button"
							className="btn btn-ghost btn-xs"
							onClick={() => setDeleteError(null)}
						>
							Dismiss
						</button>
					</div>
				)}

				{isLoading ? (
					<div className="flex-1 flex items-center justify-center">
						<span className="loading loading-spinner loading-sm text-primary" />
					</div>
				) : (
					<>
						<div className="px-4 py-2 border-b border-base-300 flex items-center justify-end">
							<label className="flex items-center gap-2 text-xs text-base-content/70 cursor-pointer">
								<input
									type="checkbox"
									className="checkbox checkbox-xs"
									checked={showSettled}
									onChange={(e) => setShowSettled(e.target.checked)}
								/>
								Show settled
							</label>
						</div>

						{isEmpty ? (
							<div className="m-4 border border-dashed border-base-300 p-8 text-center text-base-content/60 text-sm">
								No open debts or splits. Use the + button to add one.
							</div>
						) : (
							<>
								{visibleSplits.length > 0 && (
									<section className="flex flex-col">
										<div className="px-4 pt-3 pb-1 text-xs uppercase tracking-wide font-semibold text-base-content/50">
											Splits
										</div>
										<SplitsTable
											splits={visibleSplits}
											tags={tags}
											accounts={accounts}
											expandedSplitId={expandedSplitId}
											onToggleExpand={(id) =>
												setExpandedSplitId(id === expandedSplitId ? null : id)
											}
											loadParticipants={splitParticipants}
											onSettleParticipant={(debtId) => setSettlingDebtId(debtId)}
											onCrossFilterSplit={(splitId) => {
												const s = splits.find((x) => x.id === splitId);
												if (!s) return;
												onCrossFilterSplit({
													id: splitId,
													label: s.description?.trim() || "split",
												});
											}}
											onEditSplit={setEditingSplitId}
											onDeleteSplit={handleDeleteSplit}
										/>
									</section>
								)}

								{visibleDebts.length > 0 && (
									<section className="flex flex-col">
										<div className="px-4 pt-3 pb-1 text-xs uppercase tracking-wide font-semibold text-base-content/50">
											Debts
										</div>
										<DebtsTable
											debts={visibleDebts}
											tagsById={tagsByIdMap}
											standaloneDebtIds={standaloneDebtIds}
											onSettle={(id) => setSettlingDebtId(id)}
											onDelete={handleDeleteDebt}
										/>
									</section>
								)}
							</>
						)}
					</>
				)}
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

			{pendingDelete && (
				<div
					className="modal modal-open"
					role="dialog"
					aria-modal="true"
					aria-labelledby="confirm-delete-title"
				>
					<div className="modal-box max-w-sm">
						<h3 id="confirm-delete-title" className="text-lg font-semibold">
							{pendingDelete.kind === "debt" ? "Delete this debt?" : "Delete this split?"}
						</h3>
						<p className="mt-2 text-sm text-base-content/70">
							{pendingDelete.kind === "debt"
								? "This removes the debt and any settlement history attached to it. You can't undo this."
								: "This removes the split and all participants. You can't undo this."}
						</p>
						{deleteError && (
							<div className="alert alert-error text-sm mt-3">
								<span>{deleteError}</span>
							</div>
						)}
						<div className="modal-action">
							<button
								type="button"
								className="btn btn-ghost btn-sm"
								onClick={cancelPendingDelete}
								disabled={isDeleting}
							>
								Cancel
							</button>
							<button
								type="button"
								className="btn btn-error btn-sm"
								onClick={confirmPendingDelete}
								disabled={isDeleting}
							>
								{isDeleting ? (
									<>
										<span className="loading loading-spinner loading-xs" />
										Deleting…
									</>
								) : (
									"Delete"
								)}
							</button>
						</div>
					</div>
					<button
						type="button"
						aria-label="Close dialog"
						className="modal-backdrop"
						onClick={cancelPendingDelete}
					/>
				</div>
			)}
		</div>
	);
}
