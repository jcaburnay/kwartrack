import { useState } from "react";
import type { Tag } from "../../hooks/useTags";
import { formatCentavos, pesosToCentavos } from "../../utils/currency";
import { Modal } from "../ui/Modal";
import { SubmitButton } from "../ui/SubmitButton";

type Props = {
	candidateTags: readonly Tag[];
	allocatedSumCentavos: number;
	overallCentavos: number;
	onUpsert: (tagId: string, centavos: number) => Promise<string | null>;
	onSaved: () => void;
	onCancel: () => void;
};

export function NewAllocationModal({
	candidateTags,
	allocatedSumCentavos,
	overallCentavos,
	onUpsert,
	onSaved,
	onCancel,
}: Props) {
	const [tagId, setTagId] = useState(candidateTags[0]?.id ?? "");
	const [draftPesos, setDraftPesos] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	async function handleAdd() {
		setError(null);
		if (!tagId) {
			setError("Pick a tag.");
			return;
		}
		const pesos = Number(draftPesos);
		if (!Number.isFinite(pesos) || pesos <= 0) {
			setError("Enter an amount greater than 0.");
			return;
		}
		const centavos = pesosToCentavos(pesos);
		if (allocatedSumCentavos + centavos > overallCentavos) {
			setError(
				`Tag allocations total ${formatCentavos(allocatedSumCentavos + centavos)} but Overall is ${formatCentavos(overallCentavos)}. Increase Overall or reduce a tag.`,
			);
			return;
		}
		setSaving(true);
		const err = await onUpsert(tagId, centavos);
		setSaving(false);
		if (err) {
			setError(err);
			return;
		}
		onSaved();
	}

	return (
		<Modal onClose={onCancel} size="md">
			<Modal.Header title="New allocation" />
			<Modal.Body>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<label className="floating-label">
						<span>Tag</span>
						<select
							aria-label="Tag"
							className="select select-bordered w-full"
							value={tagId}
							onChange={(e) => setTagId(e.target.value)}
						>
							{candidateTags.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
									{t.is_system ? " (system)" : ""}
								</option>
							))}
						</select>
					</label>
					<label className="floating-label">
						<span>Amount (₱)</span>
						<input
							aria-label="Amount"
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
				</div>
				{error && <div className="alert alert-error text-sm">{error}</div>}
			</Modal.Body>
			<Modal.Footer>
				<button type="button" className="btn btn-ghost" onClick={onCancel}>
					Cancel
				</button>
				<SubmitButton
					type="button"
					className="btn btn-primary"
					onClick={handleAdd}
					loading={saving}
				>
					Create
				</SubmitButton>
			</Modal.Footer>
		</Modal>
	);
}
