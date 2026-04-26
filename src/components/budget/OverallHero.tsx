import { Pencil } from "lucide-react";
import { useState } from "react";
import { progressBucket } from "../../utils/budgetMath";
import { centavosToPesos, formatCentavos, pesosToCentavos } from "../../utils/currency";

type Props = {
	overallCentavos: number | null;
	actualCentavos: number;
	allocatedSumCentavos: number;
	onSetOverall: (centavos: number) => Promise<string | null>;
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

export function OverallHero({
	overallCentavos,
	actualCentavos,
	allocatedSumCentavos,
	onSetOverall,
}: Props) {
	const [editing, setEditing] = useState(false);
	const [draftPesos, setDraftPesos] = useState("");
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	function startEdit() {
		setDraftPesos(overallCentavos == null ? "" : centavosToPesos(overallCentavos).toString());
		setSubmitError(null);
		setEditing(true);
	}

	async function handleSave() {
		setSubmitError(null);
		const pesos = Number(draftPesos);
		if (!Number.isFinite(pesos) || pesos < 0) {
			setSubmitError("Enter a non-negative amount.");
			return;
		}
		const centavos = pesosToCentavos(pesos);
		if (centavos < allocatedSumCentavos) {
			setSubmitError(
				`Overall ${formatCentavos(centavos)} is below current allocations ${formatCentavos(allocatedSumCentavos)}. Increase Overall or reduce a tag.`,
			);
			return;
		}
		setSaving(true);
		const err = await onSetOverall(centavos);
		setSaving(false);
		if (err) {
			setSubmitError(err);
			return;
		}
		setEditing(false);
	}

	if (overallCentavos == null && !editing) {
		return (
			<div className="bg-base-100 rounded-box border border-base-300 p-5 flex items-center justify-between gap-4 flex-wrap">
				<div>
					<h2 className="text-base font-semibold">Overall</h2>
					<p className="text-sm text-base-content/60">No budget set for this month.</p>
				</div>
				<button type="button" className="btn btn-primary btn-sm" onClick={startEdit}>
					Set monthly budget
				</button>
			</div>
		);
	}

	if (editing) {
		return (
			<div className="bg-base-100 rounded-box border border-base-300 p-5 flex flex-col gap-3">
				<h2 className="text-base font-semibold">Overall</h2>
				<label className="form-control">
					<div className="label">
						<span className="label-text">Monthly cap (₱)</span>
					</div>
					<input
						type="number"
						min="0"
						step="0.01"
						className="input input-bordered input-sm w-48"
						value={draftPesos}
						onChange={(e) => setDraftPesos(e.target.value)}
						autoFocus
					/>
				</label>
				{submitError && <div className="alert alert-error text-sm">{submitError}</div>}
				<div className="flex gap-2">
					<button
						type="button"
						className="btn btn-sm btn-primary"
						onClick={handleSave}
						disabled={saving}
					>
						{saving ? <span className="loading loading-spinner loading-sm" /> : "Save"}
					</button>
					<button
						type="button"
						className="btn btn-sm btn-ghost"
						onClick={() => {
							setEditing(false);
							setSubmitError(null);
						}}
					>
						Cancel
					</button>
				</div>
			</div>
		);
	}

	const overall = overallCentavos ?? 0;
	const remaining = overall - actualCentavos;
	const bucket = progressBucket(actualCentavos, overall);
	const percent = pct(actualCentavos, overall);
	const barWidth = Math.min(100, percent);

	return (
		<div className="bg-base-100 rounded-box border border-base-300 p-5 flex flex-col gap-3">
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-base font-semibold">Overall</h2>
				<button
					type="button"
					className="btn btn-xs btn-ghost"
					onClick={startEdit}
					aria-label="Edit overall cap"
				>
					<Pencil className="w-3.5 h-3.5" />
				</button>
			</div>
			<div className="flex items-baseline gap-3 flex-wrap">
				<span className="text-2xl font-semibold">{formatCentavos(actualCentavos)}</span>
				<span className="text-sm text-base-content/60">of {formatCentavos(overall)}</span>
				<span className={`text-sm ${remaining < 0 ? "text-error" : "text-base-content/60"}`}>
					·{" "}
					{remaining < 0
						? `${formatCentavos(-remaining)} over`
						: `${formatCentavos(remaining)} remaining`}
				</span>
			</div>
			<div className="w-full h-3 bg-base-200 rounded-full overflow-hidden">
				<div
					className={`h-full ${BUCKET_BAR_CLASS[bucket]} transition-all`}
					style={{ width: `${barWidth}%` }}
				/>
			</div>
			<div className="text-xs text-base-content/60">{Math.round(percent)}%</div>
		</div>
	);
}
