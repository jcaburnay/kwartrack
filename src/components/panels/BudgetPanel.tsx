import { BudgetWorkspace } from "../budget/BudgetWorkspace";

type Props = {
	onDrillToTag?: (tagId: string, month: string) => void;
};

export function BudgetPanel({ onDrillToTag }: Props = {}) {
	return <BudgetWorkspace onDrillToTag={onDrillToTag} />;
}
