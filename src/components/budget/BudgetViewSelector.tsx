export type BudgetView = "table" | "comparison" | "history";

const OPTIONS: { value: BudgetView; label: string }[] = [
	{ value: "table", label: "Table" },
	{ value: "comparison", label: "Comparison" },
	{ value: "history", label: "Tag history" },
];

type Props = {
	value: BudgetView;
	onChange: (next: BudgetView) => void;
};

export function BudgetViewSelector({ value, onChange }: Props) {
	return (
		<select
			aria-label="Budget view"
			className="select select-sm select-ghost text-xs px-2 -mx-2 max-w-[10rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			value={value}
			onChange={(e) => onChange(e.target.value as BudgetView)}
		>
			{OPTIONS.map((opt) => (
				<option key={opt.value} value={opt.value}>
					{opt.label}
				</option>
			))}
		</select>
	);
}

const STORAGE_KEY = "kwartrack:budgetView";

export function loadStoredBudgetView(): BudgetView {
	const v = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
	if (v === "table" || v === "comparison" || v === "history") return v;
	return "table";
}

export function storeBudgetView(view: BudgetView): void {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(STORAGE_KEY, view);
}
