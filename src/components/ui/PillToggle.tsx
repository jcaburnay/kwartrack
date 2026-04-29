/**
 * Compact join button strip — a row of segmented buttons where one is
 * "active" (filled with `btn-primary`) and the rest are quiet (`btn-ghost`).
 * Used for type filters (Transactions, Recurring) and similar single-select
 * toggle groups. The active button is announced via `aria-pressed`.
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
	return (
		<div role="group" aria-label={ariaLabel} className="join">
			{options.map((opt, i) => {
				const active = value === opt.value;
				return (
					<button
						key={i}
						type="button"
						aria-pressed={active}
						className={`btn btn-sm join-item rounded-none [&:first-child]:rounded-l-sm [&:last-child]:rounded-r-sm border border-base-content/40 [&:not(:first-child)]:-ml-px ${active ? "btn-primary" : "btn-ghost"}`}
						onClick={() => onChange(opt.value)}
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}
