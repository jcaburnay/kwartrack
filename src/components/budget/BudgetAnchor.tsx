import { Pencil } from "lucide-react";
import { useState } from "react";
import { projectedBucket } from "../../utils/budgetMath";
import { formatCentavos } from "../../utils/currency";
import { daysRemaining, projectedEndOfMonth } from "../../utils/pacingMath";
import { SubmitButton } from "../ui/SubmitButton";
import { EditOverallModal } from "./EditOverallModal";

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
	const [copyError, setCopyError] = useState<string | null>(null);
	const [copying, setCopying] = useState(false);

	const isUnset = overallCentavos == null || overallCentavos === 0;
	const left = daysRemaining(today, timezone, month);
	const leftLabel = `${left} day${left === 1 ? "" : "s"} left`;

	async function handleCopy() {
		setCopying(true);
		setCopyError(null);
		const err = await onCopyFromPrevious();
		setCopying(false);
		if (err) setCopyError(err);
	}

	const modal = editing ? (
		<EditOverallModal
			overallCentavos={overallCentavos}
			allocatedSumCentavos={allocatedSumCentavos}
			onSetOverall={onSetOverall}
			onSaved={() => setEditing(false)}
			onCancel={() => setEditing(false)}
		/>
	) : null;

	if (isUnset && allocatedSumCentavos === 0) {
		return (
			<>
				<div className="flex flex-col gap-2">
					<p className="text-sm text-base-content/60">
						Set a monthly budget to track spending against limits across tags.
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<button type="button" className="btn btn-cta btn-sm" onClick={() => setEditing(true)}>
							+ Set Budget
						</button>
						{canCopy && (
							<SubmitButton
								type="button"
								className="btn btn-sm btn-ghost"
								onClick={handleCopy}
								loading={copying}
								spinnerSize="xs"
							>
								Copy from previous month
							</SubmitButton>
						)}
					</div>
					{copyError && <div className="alert alert-error text-sm">{copyError}</div>}
				</div>
				{modal}
			</>
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
		<>
			<div className="flex flex-col gap-2">
				<div className="flex items-baseline justify-between gap-2 flex-wrap">
					<div className="flex items-baseline gap-2 tabular-nums text-sm">
						<span className="text-base-content/80 font-medium">
							{formatCentavos(actualCentavos)}
						</span>
						<span className="text-base-content/50">of {formatCentavos(overall)}</span>
						<span className="text-base-content/40">·</span>
						<span className="text-base-content/60">{leftLabel}</span>
					</div>
					<button
						type="button"
						className="btn btn-xs btn-ghost"
						onClick={() => setEditing(true)}
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
			{modal}
		</>
	);
}
