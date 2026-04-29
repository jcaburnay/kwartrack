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
	function pick(next: DateRangePreset) {
		if (next === "custom") {
			onChange({ preset: "custom", customFrom, customTo });
		} else {
			onChange({ preset: next, customFrom: null, customTo: null });
		}
	}

	return (
		<div className="flex items-center gap-2">
			<select
				aria-label="Date range"
				className="select select-bordered select-sm min-w-0 w-auto focus:outline-none focus-within:outline-none focus:shadow-none focus-within:shadow-none"
				value={preset}
				onChange={(e) => pick(e.target.value as DateRangePreset)}
			>
				{DATE_RANGE_PRESETS.map((p) => (
					<option key={p.value} value={p.value}>
						{p.label}
					</option>
				))}
			</select>
			{preset === "custom" && (
				<div className="flex items-center gap-1.5">
					<label className="text-xs text-base-content/60">
						<span className="sr-only">From</span>
						<input
							aria-label="From"
							type="date"
							className="input input-bordered input-sm"
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
							className="input input-bordered input-sm"
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
