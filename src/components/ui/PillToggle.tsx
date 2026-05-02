import { useId } from "react";

/**
 * Compact join button strip — a row of segmented options where one is
 * "active" (filled with `btn-primary`) and the rest are quiet (`btn-ghost`).
 * Used for type filters (Transactions, Recurring) and chart range pickers.
 *
 * Semantically a single-select group: rendered as native `<input type="radio">`
 * elements wrapped in styled `<label>`s, so screen readers announce the
 * one-of-N relationship and arrow-key navigation works natively.
 */

type Option<T> = {
	value: T;
	label: string;
};

type Props<T> = {
	value: T;
	options: readonly Option<T>[];
	onChange: (next: T) => void;
	ariaLabel?: string;
};

export function PillToggle<T>({ value, options, onChange, ariaLabel }: Props<T>) {
	const groupName = useId();
	return (
		<div role="radiogroup" aria-label={ariaLabel} className="join">
			{options.map((opt) => {
				const active = value === opt.value;
				return (
					<label
						key={opt.label}
						className={`btn btn-sm join-item rounded-none [&:first-child]:rounded-l-sm [&:last-child]:rounded-r-sm border border-base-content/40 [&:not(:first-child)]:-ml-px focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-base-content/60 ${active ? "btn-primary" : "btn-ghost"}`}
					>
						<input
							type="radio"
							name={groupName}
							className="sr-only"
							checked={active}
							onChange={() => onChange(opt.value)}
						/>
						{opt.label}
					</label>
				);
			})}
		</div>
	);
}
