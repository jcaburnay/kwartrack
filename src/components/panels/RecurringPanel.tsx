import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAccounts } from "../../hooks/useAccounts";
import { useRecurrings } from "../../hooks/useRecurrings";
import { useTags } from "../../hooks/useTags";
import { formatCentavos } from "../../utils/currency";
import {
	DEFAULT_RECURRING_FILTERS,
	matchesRecurringFilters,
	type Recurring,
} from "../../utils/recurringFilters";
import { summariseRecurrings } from "../../utils/recurringSummary";
import { EditRecurringModal } from "../recurring/EditRecurringModal";
import { NewRecurringModal } from "../recurring/NewRecurringModal";
import { RecurringFilterRow } from "../recurring/RecurringFilterRow";
import { RecurringTable } from "../recurring/RecurringTable";

function formatNextDueDate(iso: string): string {
	const target = new Date(iso);
	const today = new Date();
	const sameYear = target.getFullYear() === today.getFullYear();
	const dayDiff = Math.round(
		(new Date(target.toDateString()).getTime() - new Date(today.toDateString()).getTime()) /
			86_400_000,
	);
	if (dayDiff === 0) return "Today";
	if (dayDiff === -1) return "Yesterday";
	const opts: Intl.DateTimeFormatOptions = sameYear
		? { month: "short", day: "numeric" }
		: { month: "short", day: "numeric", year: "numeric" };
	return new Intl.DateTimeFormat("en-US", opts).format(target);
}

export type RecurringPending = { kind: "new" } | { kind: "edit"; id: string } | null;

type Props = {
	pendingModal: RecurringPending;
	onPendingModalConsumed: () => void;
};

export function RecurringPanel({ pendingModal, onPendingModalConsumed }: Props) {
	const {
		recurrings,
		isLoading,
		error,
		refetch,
		createRecurring,
		updateRecurring,
		deleteRecurring,
		togglePaused,
	} = useRecurrings();
	const { accounts } = useAccounts();
	const { tags, createInline } = useTags();

	const [folded, setFolded] = useState(false);
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<Recurring | null>(null);
	const [filters, setFilters] = useState(DEFAULT_RECURRING_FILTERS);

	const visible = useMemo(
		() => recurrings.filter((r) => matchesRecurringFilters(r, filters)),
		[recurrings, filters],
	);

	useEffect(() => {
		if (!pendingModal) return;
		if (pendingModal.kind === "new") {
			setCreating(true);
			onPendingModalConsumed();
			return;
		}
		// edit case — wait for recurrings to populate
		if (isLoading) return;
		const target = recurrings.find((r) => r.id === pendingModal.id);
		if (target) {
			setEditing(target);
		}
		onPendingModalConsumed();
	}, [pendingModal, isLoading, recurrings, onPendingModalConsumed]);

	const summary = summariseRecurrings(recurrings);

	const summaryTokens: string[] = [`${summary.activeCount} active`];
	if (summary.activeCount > 0) {
		summaryTokens.push(`${formatCentavos(summary.monthlyOutflowCentavos)}/mo`);
	} else {
		summaryTokens.push("—");
	}
	if (summary.nextDue) {
		summaryTokens.push(
			`next: ${summary.nextDue.service} ${formatNextDueDate(summary.nextDue.date)}`,
		);
	}
	if (summary.pausedCount > 0) {
		summaryTokens.push(`${summary.pausedCount} paused`);
	}

	return (
		<div className="bg-base-100 border border-base-300 h-full flex flex-col">
			<div className="h-9 flex items-center justify-between px-3 border-b border-base-300">
				<div className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold text-base-content/50">
					<span>Recurring</span>
					<span className="text-base-content/40 normal-case tracking-normal">
						· {summaryTokens.join(" · ")}
					</span>
				</div>
				<div className="flex items-center gap-1">
					<button
						type="button"
						className="btn btn-primary btn-sm rounded-sm"
						onClick={() => setCreating(true)}
					>
						<Plus className="w-3.5 h-3.5" /> New
					</button>
					<button
						type="button"
						aria-label={folded ? "Expand recurring" : "Collapse recurring"}
						className="btn btn-ghost btn-sm rounded-sm"
						onClick={() => setFolded((f) => !f)}
					>
						{folded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
					</button>
				</div>
			</div>

			{!folded && (
				<div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
					{error && <div className="alert alert-error text-sm">{error}</div>}
					{isLoading ? (
						<div className="flex justify-center py-8">
							<span className="loading loading-spinner text-primary" />
						</div>
					) : (
						<>
							<RecurringFilterRow filters={filters} onChange={setFilters} tags={tags} />
							{visible.length === 0 && recurrings.length > 0 ? (
								<div className="border border-dashed border-base-300 p-8 text-center text-base-content/60 text-sm">
									No recurrings match these filters.
								</div>
							) : (
								<RecurringTable
									recurrings={visible}
									accounts={accounts}
									tags={tags}
									onEdit={setEditing}
									onTogglePaused={togglePaused}
									onDelete={deleteRecurring}
								/>
							)}
						</>
					)}
				</div>
			)}

			{creating && (
				<NewRecurringModal
					accounts={accounts}
					tags={tags}
					createTag={createInline}
					createRecurring={createRecurring}
					onSaved={async () => {
						setCreating(false);
						await refetch();
					}}
					onCancel={() => setCreating(false)}
				/>
			)}

			{editing && (
				<EditRecurringModal
					recurring={editing}
					accounts={accounts}
					tags={tags}
					createTag={createInline}
					updateRecurring={updateRecurring}
					onSaved={async () => {
						setEditing(null);
						await refetch();
					}}
					onCancel={() => setEditing(null)}
				/>
			)}
		</div>
	);
}
