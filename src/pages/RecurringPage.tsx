import { useMemo, useState } from "react";
import { Fab } from "../components/Fab";
import { Header } from "../components/Header";
import { EditRecurringModal } from "../components/recurring/EditRecurringModal";
import { NewRecurringModal } from "../components/recurring/NewRecurringModal";
import { RecurringFilterBar } from "../components/recurring/RecurringFilterBar";
import { RecurringTable } from "../components/recurring/RecurringTable";
import { useAccounts } from "../hooks/useAccounts";
import { useRecurrings } from "../hooks/useRecurrings";
import { useTags } from "../hooks/useTags";
import {
	DEFAULT_RECURRING_FILTERS,
	matchesRecurringFilters,
	type Recurring,
} from "../utils/recurringFilters";

export function RecurringPage() {
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

	const [filters, setFilters] = useState(DEFAULT_RECURRING_FILTERS);
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<Recurring | null>(null);
	const [fabOpen, setFabOpen] = useState(false);

	const visible = useMemo(
		() => recurrings.filter((r) => matchesRecurringFilters(r, filters)),
		[recurrings, filters],
	);

	return (
		<div className="min-h-dvh bg-base-200 flex flex-col">
			<Header />
			<main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto flex flex-col gap-5">
				<div className="flex items-end justify-between gap-4 flex-wrap">
					<h1 className="text-2xl font-semibold">Recurring</h1>
				</div>

				{error && <div className="alert alert-error text-sm">{error}</div>}

				<RecurringFilterBar
					filters={filters}
					onChange={setFilters}
					accounts={accounts}
					tags={tags}
				/>

				{isLoading ? (
					<div className="flex justify-center py-8">
						<span className="loading loading-spinner text-primary" />
					</div>
				) : (
					<RecurringTable
						recurrings={visible}
						accounts={accounts}
						tags={tags}
						onEdit={(r) => setEditing(r)}
						onTogglePaused={togglePaused}
						onDelete={deleteRecurring}
					/>
				)}
			</main>

			<Fab
				isOpen={fabOpen}
				onToggle={() => setFabOpen((v) => !v)}
				onDismiss={() => setFabOpen(false)}
				actions={[
					{
						label: "New Recurring",
						description: "Subscription, installment, or recurring income.",
						onClick: () => setCreating(true),
					},
				]}
			/>

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
