import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
	month: string;
	onChange: (next: string) => void;
};

export function shiftMonth(month: string, delta: 1 | -1): string {
	const [yStr, mStr] = month.split("-");
	let y = Number(yStr);
	let m = Number(mStr) + delta;
	if (m === 0) {
		m = 12;
		y -= 1;
	}
	if (m === 13) {
		m = 1;
		y += 1;
	}
	return `${y}-${String(m).padStart(2, "0")}`;
}

export function MonthPicker({ month, onChange }: Props) {
	return (
		<div className="flex items-center gap-2">
			<button
				type="button"
				className="btn btn-sm btn-ghost rounded-sm"
				aria-label="Previous month"
				onClick={() => onChange(shiftMonth(month, -1))}
			>
				<ChevronLeft className="w-4 h-4" />
			</button>
			<input
				type="month"
				className="input input-bordered input-sm rounded-sm border-base-content/40 w-36"
				value={month}
				onChange={(e) => e.target.value && onChange(e.target.value)}
			/>
			<button
				type="button"
				className="btn btn-sm btn-ghost rounded-sm"
				aria-label="Next month"
				onClick={() => onChange(shiftMonth(month, 1))}
			>
				<ChevronRight className="w-4 h-4" />
			</button>
		</div>
	);
}
