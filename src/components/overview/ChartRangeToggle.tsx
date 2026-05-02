import { PillToggle } from "../ui/PillToggle";

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
 * Compact 4-segment range toggle for time-axis charts. Reuses the shared
 * `PillToggle` so the visual treatment stays in lockstep with the
 * Transactions / Recurring filter pills.
 */
export function ChartRangeToggle({ value, onChange }: Props) {
	return <PillToggle ariaLabel="Chart range" value={value} options={OPTIONS} onChange={onChange} />;
}

export function rangeToMonthCount(range: RangeOption): number {
	if (range === "3m") return 3;
	if (range === "6m") return 6;
	if (range === "12m") return 12;
	return 36; // "all" — cap at 3 years to keep computation bounded
}
