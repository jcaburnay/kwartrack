import { DropdownSelect } from "../ui/DropdownSelect";

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
		<DropdownSelect ariaLabel="Budget view" value={value} options={OPTIONS} onChange={onChange} />
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
