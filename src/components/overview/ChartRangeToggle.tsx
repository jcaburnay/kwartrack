export type RangeOption = "3m" | "6m" | "12m" | "all";

type Props = {
	value: RangeOption;
	onChange: (next: RangeOption) => void;
};

const OPTIONS: { value: RangeOption; label: string }[] = [
	{ value: "3m", label: "3M" },
	{ value: "6m", label: "6M" },
	{ value: "12m", label: "12M" },
	{ value: "all", label: "All" },
];

/**
 * Compact 4-segment range toggle for time-axis charts. Renders as a DaisyUI
 * button group with `btn-active` on the selected value. Uses `aria-pressed`
 * on each button (toggle pattern) so screen readers announce selection
 * without requiring native radio semantics.
 */
export function ChartRangeToggle({ value, onChange }: Props) {
	return (
		<div role="toolbar" aria-label="Chart range" className="join">
			{OPTIONS.map((opt) => (
				<button
					key={opt.value}
					type="button"
					aria-pressed={value === opt.value}
					className={`btn btn-xs btn-ghost join-item focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${value === opt.value ? "btn-active" : ""}`}
					onClick={() => onChange(opt.value)}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}

export function rangeToMonthCount(range: RangeOption): number {
	if (range === "3m") return 3;
	if (range === "6m") return 6;
	if (range === "12m") return 12;
	return 36; // "all" — cap at 3 years to keep computation bounded
}
