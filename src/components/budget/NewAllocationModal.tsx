import { useState } from "react";
import type { Tag } from "../../hooks/useTags";
import { formatCentavos, pesosToCentavos } from "../../utils/currency";

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
		<div
			className="modal modal-open"
			role="dialog"
			aria-modal="true"
			aria-labelledby="new-allocation-title"
		>
			<div className="modal-box max-w-md">
				<h3 id="new-allocation-title" className="font-semibold text-lg mb-4">
					Add allocation
				</h3>
				<div className="flex flex-col gap-3">
					<label className="form-control">
						<div className="label py-0">
							<span className="label-text text-xs">Tag</span>
						</div>
						<select
							aria-label="Tag"
							className="select select-bordered select-sm"
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
					<div className="flex justify-end gap-2 pt-1">
						<button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
							Cancel
						</button>
						<button
							type="button"
							className="btn btn-sm btn-primary"
							onClick={handleAdd}
							disabled={saving}
						>
							{saving ? <span className="loading loading-spinner loading-xs" /> : "Add"}
						</button>
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
