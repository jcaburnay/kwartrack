import { useState } from "react";
import type { BudgetAllocation } from "../../hooks/useBudget";
import type { Tag } from "../../hooks/useTags";
import { type ActualsByTag, progressBucket } from "../../utils/budgetMath";
import { centavosToPesos, formatCentavos, pesosToCentavos } from "../../utils/currency";

type Props = {
	tags: readonly Tag[];
	allocations: readonly BudgetAllocation[];
	actualsByTag: ActualsByTag;
	othersCentavos: number;
	overallCentavos: number;
	onUpsert: (tagId: string, centavos: number) => Promise<string | null>;
	onDelete: (tagId: string) => Promise<string | null>;
	disabled: boolean;
};

const BUCKET_BAR_CLASS: Record<ReturnType<typeof progressBucket>, string> = {
	empty: "bg-base-300",
	green: "bg-success",
	orange: "bg-warning",
	red: "bg-error",
};

function pct(actual: number, budget: number): number {
	if (budget <= 0) return 0;
	return (actual / budget) * 100;
}

export function AllocationTable({
	tags,
	allocations,
	actualsByTag,
	othersCentavos,
	overallCentavos,
	onUpsert,
	onDelete,
	disabled,
}: Props) {
	const [editingTagId, setEditingTagId] = useState<string | null>(null);
	const [draftPesos, setDraftPesos] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [savingTagId, setSavingTagId] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const [addTagId, setAddTagId] = useState("");
	const [addPesos, setAddPesos] = useState("");

	const tagById = new Map(tags.map((t) => [t.id, t]));
	const allocatedSum = allocations.reduce((s, a) => s + a.amount_centavos, 0);
	const allocatedSet = new Set(allocations.map((a) => a.tag_id));

	// Sorted by tag name (tags already arrive alphabetical from useTags).
	const sortedAllocations = [...allocations].sort((a, b) => {
		const an = tagById.get(a.tag_id)?.name ?? "";
		const bn = tagById.get(b.tag_id)?.name ?? "";
		return an.localeCompare(bn);
	});

	// Picker candidates: expense non-system tags PLUS the system 'transfer-fees' tag.
	const candidateTags = tags
		.filter((t) => !allocatedSet.has(t.id))
		.filter((t) => {
			if (t.is_system) return t.name === "transfer-fees";
			return t.type === "expense";
		});

	function startEdit(a: BudgetAllocation) {
		if (disabled) return;
		setError(null);
		setEditingTagId(a.tag_id);
		setDraftPesos(centavosToPesos(a.amount_centavos).toString());
	}

	function cancelEdit() {
		setEditingTagId(null);
		setDraftPesos("");
		setError(null);
	}

	async function handleSave(allocation: BudgetAllocation) {
		setError(null);
		const pesos = Number(draftPesos);
		if (!Number.isFinite(pesos) || pesos < 0) {
			setError("Enter a non-negative amount.");
			return;
		}
		const centavos = pesosToCentavos(pesos);

		// Delete-on-zero.
		if (centavos === 0) {
			setSavingTagId(allocation.tag_id);
			const err = await onDelete(allocation.tag_id);
			setSavingTagId(null);
			if (err) {
				setError(err);
				return;
			}
			cancelEdit();
			return;
		}

		// Client guard: Σ(others) + new value ≤ overall.
		const others = allocatedSum - allocation.amount_centavos;
		if (others + centavos > overallCentavos) {
			setError(
				`Tag allocations total ${formatCentavos(others + centavos)} but Overall is ${formatCentavos(overallCentavos)}. Increase Overall or reduce a tag.`,
			);
			return;
		}

		setSavingTagId(allocation.tag_id);
		const err = await onUpsert(allocation.tag_id, centavos);
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
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<h3 className="text-sm font-semibold text-base-content/70">
					Per-tag allocation — Total: {formatCentavos(allocatedSum)}
				</h3>
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
				{disabled && (
					<span className="text-xs text-base-content/50 italic" title="Set monthly budget first">
						Set monthly budget first
					</span>
				)}
			</div>

			{error && <div className="alert alert-error text-sm">{error}</div>}

			<div className="overflow-x-auto">
				<table className="table table-sm">
					<thead>
						<tr>
							<th>Tag</th>
							<th className="text-right">Budget</th>
							<th className="text-right">Actual</th>
							<th className="text-right">Remaining</th>
							<th>Progress</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{sortedAllocations.map((a) => {
							const tag = tagById.get(a.tag_id);
							const actual = actualsByTag.get(a.tag_id) ?? 0;
							const remaining = a.amount_centavos - actual;
							const bucket = progressBucket(actual, a.amount_centavos);
							const barWidth = Math.min(100, pct(actual, a.amount_centavos));
							const isEditing = editingTagId === a.tag_id;
							const saving = savingTagId === a.tag_id;
							return (
								<tr key={a.tag_id}>
									<td className="font-medium">{tag?.name ?? "—"}</td>
									<td className="text-right">
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
											formatCentavos(a.amount_centavos)
										)}
									</td>
									<td className="text-right">{formatCentavos(actual)}</td>
									<td className={`text-right ${remaining < 0 ? "text-error" : ""}`}>
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
													onClick={() => handleSave(a)}
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
													onClick={() => startEdit(a)}
												>
													Edit
												</button>
											)
										)}
									</td>
								</tr>
							);
						})}
						<tr className="text-base-content/70">
							<td className="italic">Others (unbudgeted)</td>
							<td className="text-right">—</td>
							<td className="text-right">{formatCentavos(othersCentavos)}</td>
							<td className="text-right">—</td>
							<td>—</td>
							<td></td>
						</tr>
					</tbody>
				</table>
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
