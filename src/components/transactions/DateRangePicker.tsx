import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { DATE_RANGE_PRESETS, type DateRangePreset } from "../../utils/transactionDateRange";

export type DateRangeValue = {
	preset: DateRangePreset;
	customFrom: string | null;
	customTo: string | null;
};

type Props = DateRangeValue & {
	onChange: (next: DateRangeValue) => void;
};

export function DateRangePicker({ preset, customFrom, customTo, onChange }: Props) {
	const [open, setOpen] = useState(false);
	const activeLabel = DATE_RANGE_PRESETS.find((p) => p.value === preset)?.label ?? "Date range";

	function pick(next: DateRangePreset) {
		setOpen(false);
		if (next === "custom") {
			onChange({ preset: "custom", customFrom, customTo });
		} else {
			onChange({ preset: next, customFrom: null, customTo: null });
		}
	}

	return (
		<div className="flex items-center gap-2">
			<div className="dropdown dropdown-end">
				<button
					type="button"
					className="btn btn-sm btn-ghost gap-1 normal-case"
					onClick={() => setOpen((v) => !v)}
				>
					{activeLabel}
					<ChevronDown className="size-3.5" />
				</button>
				{open && (
					<ul className="dropdown-content menu bg-base-100 rounded-box z-10 w-44 p-1 shadow border border-base-300">
						{DATE_RANGE_PRESETS.map((p) => (
							<li key={p.value}>
								<button
									type="button"
									className={preset === p.value ? "active" : ""}
									onClick={() => pick(p.value)}
								>
									{p.label}
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
			{preset === "custom" && (
				<div className="flex items-center gap-1.5">
					<label className="text-xs text-base-content/60">
						<span className="sr-only">From</span>
						<input
							aria-label="From"
							type="date"
							className="input input-bordered input-xs"
							value={customFrom ?? ""}
							onChange={(e) =>
								onChange({ preset: "custom", customFrom: e.target.value || null, customTo })
							}
						/>
					</label>
					<span className="text-xs text-base-content/40">to</span>
					<label className="text-xs text-base-content/60">
						<span className="sr-only">To</span>
						<input
							aria-label="To"
							type="date"
							className="input input-bordered input-xs"
							value={customTo ?? ""}
							onChange={(e) =>
								onChange({ preset: "custom", customFrom, customTo: e.target.value || null })
							}
						/>
					</label>
				</div>
			)}
		</div>
	);
}
