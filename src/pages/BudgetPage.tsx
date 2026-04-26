import { useMemo, useState } from "react";
import { AllocationTable } from "../components/budget/AllocationTable";
import { MonthPicker } from "../components/budget/MonthPicker";
import { OverallHero } from "../components/budget/OverallHero";
import { Header } from "../components/Header";
import { useBudget } from "../hooks/useBudget";
import { useTags } from "../hooks/useTags";
import { useAuth } from "../providers/AuthProvider";
import { monthBounds } from "../utils/dateRange";

export function BudgetPage() {
	const { profile } = useAuth();
	const tz = profile?.timezone ?? "Asia/Manila";
	const initialMonth = useMemo(() => monthBounds(tz).startISO.slice(0, 7), [tz]);
	const [month, setMonth] = useState(initialMonth);
	const [copyError, setCopyError] = useState<string | null>(null);
	const [copying, setCopying] = useState(false);

	const { tags } = useTags();
	const {
		config,
		allocations,
		actualsByTag,
		othersCentavos,
		overallActualCentavos,
		isLoading,
		error,
		setOverall,
		upsertAllocation,
		deleteAllocation,
		copyFromPrevious,
	} = useBudget(month);

	const allocatedSum = allocations.reduce((s, a) => s + a.amount_centavos, 0);
	const overall = config?.overall_centavos ?? 0;

	async function handleCopy() {
		setCopyError(null);
		setCopying(true);
		const err = await copyFromPrevious();
		setCopying(false);
		if (err) setCopyError(err);
	}

	return (
		<div className="min-h-dvh bg-base-200 flex flex-col">
			<Header />
			<main className="flex-1 p-4 sm:p-6 max-w-4xl w-full mx-auto flex flex-col gap-5">
				<div className="flex items-end justify-between gap-4 flex-wrap">
					<h1 className="text-2xl font-semibold">Budget</h1>
					<MonthPicker month={month} onChange={setMonth} />
				</div>

				{(error || copyError) && (
					<div className="alert alert-error text-sm">{error ?? copyError}</div>
				)}

				{config == null && !isLoading && (
					<div className="flex justify-end">
						<button
							type="button"
							className="btn btn-sm btn-ghost"
							onClick={handleCopy}
							disabled={copying}
						>
							{copying ? (
								<span className="loading loading-spinner loading-xs" />
							) : (
								"Copy from previous month"
							)}
						</button>
					</div>
				)}

				<OverallHero
					overallCentavos={config ? overall : null}
					actualCentavos={overallActualCentavos}
					allocatedSumCentavos={allocatedSum}
					onSetOverall={setOverall}
				/>

				<AllocationTable
					tags={tags}
					allocations={allocations}
					actualsByTag={actualsByTag}
					othersCentavos={othersCentavos}
					overallCentavos={overall}
					onUpsert={upsertAllocation}
					onDelete={deleteAllocation}
					disabled={config == null}
				/>
			</main>
		</div>
	);
}
