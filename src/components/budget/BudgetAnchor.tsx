import { Pencil } from "lucide-react";
import { useState } from "react";
import { projectedBucket } from "../../utils/budgetMath";
import { centavosToPesos, formatCentavos, pesosToCentavos } from "../../utils/currency";
import { daysRemaining, projectedEndOfMonth } from "../../utils/pacingMath";

type Props = {
	month: string;
	overallCentavos: number | null;
	actualCentavos: number;
	allocatedSumCentavos: number;
	today: Date;
	timezone: string;
	onSetOverall: (centavos: number) => Promise<string | null>;
	onCopyFromPrevious: () => Promise<string | null>;
	canCopy: boolean;
};

const BUCKET_BAR_CLASS = {
	empty: "bg-base-300",
	green: "bg-success",
	orange: "bg-warning",
	red: "bg-error",
} as const;

export function BudgetAnchor({
	month,
	overallCentavos,
	actualCentavos,
	allocatedSumCentavos,
	today,
	timezone,
	onSetOverall,
	onCopyFromPrevious,
	canCopy,
}: Props) {
	const [editing, setEditing] = useState(false);
	const [draftPesos, setDraftPesos] = useState("");
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [copying, setCopying] = useState(false);

	const isUnset = overallCentavos == null || overallCentavos === 0;
	const left = daysRemaining(today, timezone, month);
	const leftLabel = `${left} day${left === 1 ? "" : "s"} left`;

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

	async function handleCopy() {
		setCopying(true);
		setSubmitError(null);
		const err = await onCopyFromPrevious();
		setCopying(false);
		if (err) setSubmitError(err);
	}

	if (editing) {
		return (
			<div className="flex flex-col gap-2">
				<label className="form-control">
					<div className="label py-0">
						<span className="label-text text-xs">Monthly cap (₱)</span>
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
						{saving ? <span className="loading loading-spinner loading-xs" /> : "Save"}
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

	if (isUnset && allocatedSumCentavos === 0) {
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm text-base-content/60">
					Set a monthly budget to track spending against limits across tags.
				</p>
				<div className="flex flex-wrap items-center gap-2">
					<button type="button" className="btn btn-primary btn-sm" onClick={startEdit}>
						+ Set Budget
					</button>
					{canCopy && (
						<button
							type="button"
							className="btn btn-sm btn-ghost"
							onClick={handleCopy}
							disabled={copying}
						>
							{copying ? (
								<span className="loading loading-spinner loading-xs" />
							) : (
								"Copy from previous month"
							)}
						</button>
					)}
				</div>
				{submitError && <div className="alert alert-error text-sm">{submitError}</div>}
			</div>
		);
	}

	const overall = overallCentavos ?? 0;
	const remaining = overall - actualCentavos;
	const bucket = projectedBucket(actualCentavos, overall, today, timezone, month);
	const projected = projectedEndOfMonth(actualCentavos, today, timezone, month);
	const barWidth = overall > 0 ? Math.min(100, (actualCentavos / overall) * 100) : 0;
	// Pacing tick: where today's expected spend lands on the bar.
	const expectedTick =
		overall > 0
			? Math.min(100, (projectedEndOfMonth(actualCentavos, today, timezone, month) / overall) * 100)
			: 0;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-baseline justify-between gap-2 flex-wrap">
				<div className="flex items-baseline gap-2 tabular-nums text-sm">
					<span className="text-base-content/80 font-medium">{formatCentavos(actualCentavos)}</span>
					<span className="text-base-content/50">of {formatCentavos(overall)}</span>
					<span className="text-base-content/40">·</span>
					<span className="text-base-content/60">{leftLabel}</span>
				</div>
				<button
					type="button"
					className="btn btn-xs btn-ghost"
					onClick={startEdit}
					aria-label="Edit overall cap"
				>
					<Pencil className="w-3.5 h-3.5" />
				</button>
			</div>
			<div className="relative w-full h-2 bg-base-200 rounded-full overflow-hidden">
				<div
					className={`h-full ${BUCKET_BAR_CLASS[bucket]} transition-all`}
					style={{ width: `${barWidth}%` }}
				/>
				{bucket === "orange" && projected > overall && expectedTick > barWidth && (
					<div
						className="absolute top-0 h-full w-px bg-warning/70"
						style={{ left: `${expectedTick}%` }}
						aria-hidden="true"
					/>
				)}
			</div>
			<div className="flex justify-between text-xs text-base-content/50 tabular-nums">
				<span>
					{remaining < 0
						? `${formatCentavos(-remaining)} over`
						: `${formatCentavos(remaining)} remaining`}
				</span>
				{bucket === "orange" && projected > overall && (
					<span className="text-warning">projected {formatCentavos(projected)}</span>
				)}
			</div>
		</div>
	);
}
