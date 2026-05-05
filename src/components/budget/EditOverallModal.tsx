import { useState } from "react";
import { centavosToPesos, formatCentavos, pesosToCentavos } from "../../utils/currency";
import { Modal } from "../ui/Modal";
import { SubmitButton } from "../ui/SubmitButton";

type Props = {
	overallCentavos: number | null;
	allocatedSumCentavos: number;
	onSetOverall: (centavos: number) => Promise<string | null>;
	onSaved: () => void;
	onCancel: () => void;
};

export function EditOverallModal({
	overallCentavos,
	allocatedSumCentavos,
	onSetOverall,
	onSaved,
	onCancel,
}: Props) {
	const [draftPesos, setDraftPesos] = useState(
		overallCentavos == null ? "" : centavosToPesos(overallCentavos).toString(),
	);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const isUnset = overallCentavos == null;

	async function handleSave() {
		setError(null);
		const pesos = Number(draftPesos);
		if (!Number.isFinite(pesos) || pesos < 0) {
			setError("Enter a non-negative amount.");
			return;
		}
		const centavos = pesosToCentavos(pesos);
		if (centavos < allocatedSumCentavos) {
			setError(
				`Overall ${formatCentavos(centavos)} is below current allocations ${formatCentavos(allocatedSumCentavos)}. Increase Overall or reduce a tag.`,
			);
			return;
		}
		setSaving(true);
		const err = await onSetOverall(centavos);
		setSaving(false);
		if (err) {
			setError(err);
			return;
		}
		onSaved();
	}

	return (
		<Modal onClose={onCancel} size="md">
			<Modal.Header title={isUnset ? "Set monthly cap" : "Edit monthly cap"} />
			<Modal.Body>
				<label className="floating-label">
					<span>Amount (₱)</span>
					<input
						aria-label="Monthly cap amount"
						type="number"
						min="0"
						step="0.01"
						placeholder="0.00"
						className="input input-bordered w-full"
						value={draftPesos}
						onChange={(e) => setDraftPesos(e.target.value)}
						autoFocus
					/>
				</label>
				{error && <div className="alert alert-error text-sm">{error}</div>}
			</Modal.Body>
			<Modal.Footer>
				<button type="button" className="btn btn-ghost" onClick={onCancel}>
					Cancel
				</button>
				<SubmitButton type="button" className="btn btn-cta" onClick={handleSave} loading={saving}>
					Save
				</SubmitButton>
			</Modal.Footer>
		</Modal>
	);
}
