import { useAuth } from "../providers/AuthProvider";
import { activeBudgetPeriod } from "../utils/budgetPeriod";
import { useBudget } from "./useBudget";
import { useBudgetPeriods, useTodayISO } from "./useBudgetPeriods";

export function useBudgetOverage(): boolean {
	const { profile } = useAuth();
	const today = useTodayISO(profile?.timezone ?? "Asia/Manila");
	const { periods } = useBudgetPeriods();
	const period = activeBudgetPeriod(periods, today);
	const budget = useBudget(period);
	if (!period || budget.error || budget.isLoading) return false;
	if (period.overall_centavos > 0 && budget.overallActualCentavos > period.overall_centavos)
		return true;
	return budget.allocations.some(
		(a) => (budget.actualsByTag.get(a.tag_id) ?? 0) > a.amount_centavos,
	);
}
