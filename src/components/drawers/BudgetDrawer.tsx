import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useBudget } from "../../hooks/useBudget";
import { useTags } from "../../hooks/useTags";
import { useAuth } from "../../providers/AuthProvider";
import { monthBounds } from "../../utils/dateRange";
import { AllocationTable } from "../budget/AllocationTable";
import { MonthPicker } from "../budget/MonthPicker";
import { OverallHero } from "../budget/OverallHero";

type Props = {
	pendingModal: string | null;
	onClose: () => void;
};

export function BudgetDrawer({ onClose }: Props) {
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
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between p-4 border-b border-base-200">
				<h2 className="text-lg font-semibold">Budget</h2>
				<button
					type="button"
					aria-label="Close budget drawer"
					className="btn btn-ghost btn-sm btn-circle"
					onClick={onClose}
				>
					<X className="size-4" />
				</button>
			</div>

			<div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5">
				<div className="flex items-end justify-between gap-4 flex-wrap">
					<MonthPicker month={month} onChange={setMonth} />
					{config == null && !isLoading && (
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
					)}
				</div>

				{(error || copyError) && (
					<div className="alert alert-error text-sm">{error ?? copyError}</div>
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
			</div>
		</div>
	);
}
