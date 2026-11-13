import type { BudgetDateRange } from "../../utils/budgetPeriod";
import { BudgetWorkspace } from "../budget/BudgetWorkspace";

type Props = {
	onDrillToTag?: (tagId: string, range: BudgetDateRange) => void;
};

export function BudgetPanel({ onDrillToTag }: Props = {}) {
	return <BudgetWorkspace onDrillToTag={onDrillToTag} />;
}
