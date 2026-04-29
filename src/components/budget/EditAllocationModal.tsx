import { useState } from "react";
import type { BudgetAllocation } from "../../hooks/useBudget";
import { centavosToPesos, formatCentavos, pesosToCentavos } from "../../utils/currency";

type Props = {
	allocation: BudgetAllocation;
	tagName: string;
	allocatedSumCentavos: number;
	overallCentavos: number;
	onUpsert: (tagId: string, centavos: number) => Promise<string | null>;
	onDelete: (tagId: string) => Promise<string | null>;
	onSaved: () => void;
	onCancel: () => void;
};

export function EditAllocationModal({
	allocation,
	tagName,
	allocatedSumCentavos,
	overallCentavos,
	onUpsert,
	onDelete,
	onSaved,
	onCancel,
}: Props) {
	const [draftPesos, setDraftPesos] = useState(centavosToPesos(allocation.amount_centavos).toString());
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);

	async function handleSave() {
		setError(null);
		const pesos = Number(draftPesos);
		if (!Number.isFinite(pesos) || pesos < 0) {
			setError("Enter a non-negative amount.");
			return;
		}
		const centavos = pesosToCentavos(pesos);
		if (centavos === 0) {
			await runDelete();
			return;
		}
		const otherAllocations = allocatedSumCentavos - allocation.amount_centavos;
		if (otherAllocations + centavos > overallCentavos) {
			setError(
				`Tag allocations total ${formatCentavos(otherAllocations + centavos)} but Overall is ${formatCentavos(overallCentavos)}. Increase Overall or reduce a tag.`,
			);
			return;
		}
		setSaving(true);
		const err = await onUpsert(allocation.tag_id, centavos);
		setSaving(false);
		if (err) {
			setError(err);
			return;
		}
		onSaved();
	}

	async function runDelete() {
		setError(null);
		setDeleting(true);
		const err = await onDelete(allocation.tag_id);
		setDeleting(false);
		if (err) {
			setError(err);
			return;
		}
		onSaved();
	}

	return (
		<div
			className="modal modal-open"
			role="dialog"
			aria-modal="true"
			aria-labelledby="edit-allocation-title"
		>
			<div className="modal-box max-w-md">
				<h3 id="edit-allocation-title" className="font-semibold text-lg mb-1">
					Edit allocation
				</h3>
				<p className="text-xs text-base-content/60 mb-4">{tagName}</p>
				<div className="flex flex-col gap-3">
					<label className="form-control">
						<div className="label py-0">
							<span className="label-text text-xs">Amount (₱)</span>
						</div>
						<input
							aria-label="Amount"
							type="number"
							min="0"
							step="0.01"
							className="input input-bordered input-sm"
							value={draftPesos}
							onChange={(e) => setDraftPesos(e.target.value)}
							autoFocus
						/>
					</label>
					{error && <div className="alert alert-error text-sm">{error}</div>}
					<div className="flex justify-between gap-2 pt-1">
						<button
							type="button"
							className="btn btn-sm btn-ghost text-error"
							onClick={runDelete}
							disabled={deleting || saving}
						>
							{deleting ? <span className="loading loading-spinner loading-xs" /> : "Delete"}
						</button>
						<div className="flex gap-2">
							<button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
								Cancel
							</button>
							<button
								type="button"
								className="btn btn-sm btn-primary"
								onClick={handleSave}
								disabled={saving || deleting}
							>
								{saving ? <span className="loading loading-spinner loading-xs" /> : "Save"}
							</button>
						</div>
					</div>
				</div>
			</div>
			<button
				type="button"
				className="modal-backdrop"
				onClick={onCancel}
				aria-label="Dismiss modal"
			/>
		</div>
	);
}
