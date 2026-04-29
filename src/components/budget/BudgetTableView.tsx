import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import type { BudgetAllocation } from "../../hooks/useBudget";
import { useScrollAndFlash } from "../../hooks/useScrollAndFlash";
import type { Tag } from "../../hooks/useTags";
import { type ActualsByTag, projectedBucket } from "../../utils/budgetMath";
import { type SortableRow, sortByOvershootRisk } from "../../utils/budgetSorting";
import { centavosToPesos, formatCentavos, pesosToCentavos } from "../../utils/currency";

const BUCKET_BAR_CLASS = {
	empty: "bg-base-300",
	green: "bg-success",
	orange: "bg-warning",
	red: "bg-error",
} as const;

type Props = {
	tags: readonly Tag[];
	allocations: readonly BudgetAllocation[];
	actualsByTag: ActualsByTag;
	othersCentavos: number;
	overallCentavos: number;
	month: string;
	today: Date;
	timezone: string;
	onUpsert: (tagId: string, centavos: number) => Promise<string | null>;
	onDelete: (tagId: string) => Promise<string | null>;
	disabled: boolean;
	focusTagId: string | null;
};

export function BudgetTableView({
	tags,
	allocations,
	actualsByTag,
	othersCentavos,
	overallCentavos,
	month,
	today,
	timezone,
	onUpsert,
	onDelete,
	disabled,
	focusTagId,
}: Props) {
	const [editingTagId, setEditingTagId] = useState<string | null>(null);
	const [draftPesos, setDraftPesos] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [savingTagId, setSavingTagId] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const [addTagId, setAddTagId] = useState("");
	const [addPesos, setAddPesos] = useState("");

	useScrollAndFlash(focusTagId, allocations.length > 0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: month is the intentional trigger; state setters are stable
	useEffect(() => {
		// Reset edit state when month changes.
		setEditingTagId(null);
		setError(null);
	}, [month]);

	const tagById = new Map(tags.map((t) => [t.id, t]));
	const allocatedSum = allocations.reduce((s, a) => s + a.amount_centavos, 0);
	const allocatedSet = new Set(allocations.map((a) => a.tag_id));

	const candidateTags = tags
		.filter((t) => !allocatedSet.has(t.id))
		.filter((t) => {
			if (t.is_system) return t.name === "transfer-fees";
			return t.type === "expense";
		});

	const sortableRows: SortableRow[] = allocations.map((a) => ({
		tagId: a.tag_id,
		tagName: tagById.get(a.tag_id)?.name ?? a.tag_id,
		allocated: a.amount_centavos,
		actual: actualsByTag.get(a.tag_id) ?? 0,
	}));
	const sorted = sortByOvershootRisk(sortableRows, today, timezone, month);

	function startEdit(tagId: string, current: number) {
		if (disabled) return;
		setError(null);
		setEditingTagId(tagId);
		setDraftPesos(centavosToPesos(current).toString());
	}

	function cancelEdit() {
		setEditingTagId(null);
		setDraftPesos("");
		setError(null);
	}

	async function handleSave(tagId: string, currentCentavos: number) {
		setError(null);
		const pesos = Number(draftPesos);
		if (!Number.isFinite(pesos) || pesos < 0) {
			setError("Enter a non-negative amount.");
			return;
		}
		const centavos = pesosToCentavos(pesos);
		if (centavos === 0) {
			setSavingTagId(tagId);
			const err = await onDelete(tagId);
			setSavingTagId(null);
			if (err) {
				setError(err);
				return;
			}
			cancelEdit();
			return;
		}
		const others = allocatedSum - currentCentavos;
		if (others + centavos > overallCentavos) {
			setError(
				`Tag allocations total ${formatCentavos(others + centavos)} but Overall is ${formatCentavos(overallCentavos)}. Increase Overall or reduce a tag.`,
			);
			return;
		}
		setSavingTagId(tagId);
		const err = await onUpsert(tagId, centavos);
		setSavingTagId(null);
		if (err) {
			setError(err);
			return;
		}
		cancelEdit();
	}

	async function handleAdd() {
		setError(null);
		if (!addTagId) {
			setError("Pick a tag.");
			return;
		}
		const pesos = Number(addPesos);
		if (!Number.isFinite(pesos) || pesos <= 0) {
			setError("Enter an amount greater than 0.");
			return;
		}
		const centavos = pesosToCentavos(pesos);
		if (allocatedSum + centavos > overallCentavos) {
			setError(
				`Tag allocations total ${formatCentavos(allocatedSum + centavos)} but Overall is ${formatCentavos(overallCentavos)}. Increase Overall or reduce a tag.`,
			);
			return;
		}
		setSavingTagId(addTagId);
		const err = await onUpsert(addTagId, centavos);
		setSavingTagId(null);
		if (err) {
			setError(err);
			return;
		}
		setAdding(false);
		setAddTagId("");
		setAddPesos("");
	}

	return (
		<div className="flex flex-col gap-2 min-h-0 flex-1">
			{error && <div className="alert alert-error text-sm">{error}</div>}

			<div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
				<table className="table table-sm">
					<thead className="sticky top-0 bg-base-100 z-10">
						<tr>
							<th>Tag</th>
							<th className="text-right">₱actual / ₱budget</th>
							<th className="text-right">Remaining</th>
							<th>Progress</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{sorted.map((row) => {
							const allocation = allocations.find((a) => a.tag_id === row.tagId);
							if (!allocation) return null;
							const actual = row.actual;
							const remaining = row.allocated - actual;
							const bucket = projectedBucket(actual, row.allocated, today, timezone, month);
							const barWidth =
								row.allocated > 0 ? Math.min(100, (actual / row.allocated) * 100) : 0;
							const isEditing = editingTagId === row.tagId;
							const saving = savingTagId === row.tagId;
							return (
								<tr key={row.tagId} data-row-id={row.tagId}>
									<td className="font-medium">{row.tagName}</td>
									<td className="text-right tabular-nums">
										{isEditing ? (
											<input
												type="number"
												min="0"
												step="0.01"
												className="input input-bordered input-xs w-24 text-right"
												value={draftPesos}
												onChange={(e) => setDraftPesos(e.target.value)}
												autoFocus
											/>
										) : (
											<div className="flex flex-col">
												<span>{formatCentavos(actual)}</span>
												<span className="text-xs text-base-content/50">
													/ {formatCentavos(row.allocated)}
												</span>
											</div>
										)}
									</td>
									<td className={`text-right tabular-nums ${remaining < 0 ? "text-error" : ""}`}>
										{remaining < 0 ? `-${formatCentavos(-remaining)}` : formatCentavos(remaining)}
									</td>
									<td>
										<div className="w-32 h-2 bg-base-200 rounded-full overflow-hidden">
											<div
												className={`h-full ${BUCKET_BAR_CLASS[bucket]}`}
												style={{ width: `${barWidth}%` }}
											/>
										</div>
									</td>
									<td className="text-right">
										{isEditing ? (
											<div className="flex gap-1 justify-end">
												<button
													type="button"
													className="btn btn-xs btn-primary"
													onClick={() => handleSave(row.tagId, row.allocated)}
													disabled={saving}
												>
													{saving ? (
														<span className="loading loading-spinner loading-xs" />
													) : (
														"Save"
													)}
												</button>
												<button type="button" className="btn btn-xs btn-ghost" onClick={cancelEdit}>
													Cancel
												</button>
											</div>
										) : (
											!disabled && (
												<button
													type="button"
													className="btn btn-xs btn-ghost"
													aria-label={`Edit ${row.tagName}`}
													onClick={() => startEdit(row.tagId, row.allocated)}
												>
													<Pencil className="w-3.5 h-3.5" />
												</button>
											)
										)}
									</td>
								</tr>
							);
						})}
						<tr className="text-base-content/70">
							<td className="italic">Others (unbudgeted)</td>
							<td className="text-right tabular-nums">{formatCentavos(othersCentavos)}</td>
							<td className="text-right">—</td>
							<td>—</td>
							<td></td>
						</tr>
					</tbody>
				</table>
			</div>

			<div className="flex items-center justify-between gap-2 pt-1">
				<span className="text-xs text-base-content/50">
					Allocated total: {formatCentavos(allocatedSum)}
				</span>
				{!disabled && !adding && candidateTags.length > 0 && (
					<button
						type="button"
						className="btn btn-xs btn-ghost"
						onClick={() => {
							setError(null);
							setAdding(true);
							setAddTagId(candidateTags[0]?.id ?? "");
							setAddPesos("");
						}}
					>
						+ Add allocation
					</button>
				)}
			</div>

			{adding && (
				<div className="bg-base-200 rounded-box p-3 flex flex-col gap-2">
					<div className="flex items-end gap-2 flex-wrap">
						<label className="form-control">
							<div className="label py-0">
								<span className="label-text text-xs">Tag</span>
							</div>
							<select
								className="select select-bordered select-sm"
								value={addTagId}
								onChange={(e) => setAddTagId(e.target.value)}
							>
								{candidateTags.map((t) => (
									<option key={t.id} value={t.id}>
										{t.name}
										{t.is_system ? " (system)" : ""}
									</option>
								))}
							</select>
						</label>
						<label className="form-control">
							<div className="label py-0">
								<span className="label-text text-xs">Amount (₱)</span>
							</div>
							<input
								type="number"
								min="0"
								step="0.01"
								className="input input-bordered input-sm w-32"
								value={addPesos}
								onChange={(e) => setAddPesos(e.target.value)}
							/>
						</label>
						<button
							type="button"
							className="btn btn-sm btn-primary"
							onClick={handleAdd}
							disabled={savingTagId === addTagId}
						>
							{savingTagId === addTagId ? (
								<span className="loading loading-spinner loading-xs" />
							) : (
								"Add"
							)}
						</button>
						<button
							type="button"
							className="btn btn-sm btn-ghost"
							onClick={() => {
								setAdding(false);
								setError(null);
							}}
						>
							Cancel
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
