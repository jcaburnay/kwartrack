import { useMemo, useState } from "react";
import { NewAccountModal } from "../components/accounts/NewAccountModal";
import { Header } from "../components/Header";
import { BudgetProgressCondensed } from "../components/overview/BudgetProgressCondensed";
import { MonthlySpendTrend } from "../components/overview/MonthlySpendTrend";
import { OverviewHero } from "../components/overview/OverviewHero";
import { UpcomingCard } from "../components/overview/UpcomingCard";
import { WelcomeCard } from "../components/WelcomeCard";
import { useAccountGroups } from "../hooks/useAccountGroups";
import { useAccounts } from "../hooks/useAccounts";
import { useBudget } from "../hooks/useBudget";
import { useDebtsAndSplits } from "../hooks/useDebtsAndSplits";
import { useMonthlySpendTrend } from "../hooks/useMonthlySpendTrend";
import { useRecurrings } from "../hooks/useRecurrings";
import { useTags } from "../hooks/useTags";
import { useAuth } from "../providers/AuthProvider";
import { monthBounds } from "../utils/dateRange";
import { selectUpcoming } from "../utils/overviewAggregation";

export function OverviewPage() {
	const { profile } = useAuth();
	const tz = profile?.timezone ?? "Asia/Manila";
	// Stable `today` per mount so all hooks see the same instant.
	const today = useMemo(() => new Date(), []);
	const monthStr = useMemo(() => monthBounds(tz, today).startISO.slice(0, 7), [tz, today]);

	const { accounts, isLoading: aLoading, refetch: refetchAccounts } = useAccounts();
	const { recurrings, isLoading: rLoading } = useRecurrings();
	const { debts, isLoading: dLoading } = useDebtsAndSplits();
	const {
		config,
		allocations,
		actualsByTag,
		overallActualCentavos,
		isLoading: bLoading,
	} = useBudget(monthStr);
	const { trend, isLoading: tLoading } = useMonthlySpendTrend(today, tz);
	const { tags } = useTags();
	const { groups, refetch: refetchGroups } = useAccountGroups();

	const [showNewAccount, setShowNewAccount] = useState(false);

	const noAccounts = !aLoading && accounts.length === 0;

	const upcoming = useMemo(
		() => selectUpcoming(recurrings, debts, actualsByTag, allocations, tags, today, tz, 5),
		[recurrings, debts, actualsByTag, allocations, tags, today, tz],
	);

	return (
		<div className="min-h-dvh bg-base-200 flex flex-col">
			<Header />
			<main className="flex-1 p-6 grid gap-6 max-w-5xl w-full mx-auto">
				{noAccounts && <WelcomeCard onCreateAccount={() => setShowNewAccount(true)} />}
				<OverviewHero accounts={accounts} isLoading={aLoading} />
				{!noAccounts && (
					<>
						<MonthlySpendTrend data={trend} isLoading={tLoading} />
						<BudgetProgressCondensed
							actualsByTag={actualsByTag}
							overallActualCentavos={overallActualCentavos}
							overallCapCentavos={config?.overall_centavos ?? 0}
							allocations={allocations}
							tags={tags}
							isLoading={bLoading}
						/>
						<UpcomingCard items={upcoming} isLoading={rLoading || dLoading || bLoading} />
					</>
				)}
			</main>
			{showNewAccount && (
				<NewAccountModal
					groups={groups}
					onRefetchGroups={refetchGroups}
					onSaved={async () => {
						setShowNewAccount(false);
						await Promise.all([refetchAccounts(), refetchGroups()]);
					}}
					onCancel={() => setShowNewAccount(false)}
				/>
			)}
		</div>
	);
}
