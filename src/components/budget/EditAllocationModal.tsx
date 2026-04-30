import { useState } from "react";
import type { BudgetAllocation } from "../../hooks/useBudget";
import { centavosToPesos, formatCentavos, pesosToCentavos } from "../../utils/currency";
import { Modal } from "../ui/Modal";

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
	const [draftPesos, setDraftPesos] = useState(
		centavosToPesos(allocation.amount_centavos).toString(),
	);
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
		<Modal onClose={onCancel} size="md">
			<Modal.Header title="Edit allocation" subtitle={tagName} />
			<Modal.Body>
				<label className="form-control">
					<div className="label">
						<span className="label-text">Amount (₱)</span>
					</div>
					<input
						aria-label="Amount"
						type="number"
						min="0"
						step="0.01"
						className="input input-bordered"
						value={draftPesos}
						onChange={(e) => setDraftPesos(e.target.value)}
						autoFocus
					/>
				</label>
				{error && <div className="alert alert-error text-sm">{error}</div>}
			</Modal.Body>
			<Modal.Footer>
				<button
					type="button"
					className="btn btn-ghost text-error mr-auto"
					onClick={runDelete}
					disabled={deleting || saving}
				>
					{deleting ? <span className="loading loading-spinner loading-sm" /> : "Delete"}
				</button>
				<button type="button" className="btn btn-ghost" onClick={onCancel}>
					Cancel
				</button>
				<button
					type="button"
					className="btn btn-primary"
					onClick={handleSave}
					disabled={saving || deleting}
				>
					{saving ? <span className="loading loading-spinner loading-sm" /> : "Save"}
				</button>
			</Modal.Footer>
		</Modal>
	);
}
