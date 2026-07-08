import { DropdownSelect } from "../ui/DropdownSelect";

export type BudgetView = "table" | "history";

const OPTIONS: { value: BudgetView; label: string }[] = [
	{ value: "table", label: "Table" },
	{ value: "history", label: "History" },
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
