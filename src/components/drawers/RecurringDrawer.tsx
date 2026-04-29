import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAccounts } from "../../hooks/useAccounts";
import { useRecurrings } from "../../hooks/useRecurrings";
import { useTags } from "../../hooks/useTags";
import {
	DEFAULT_RECURRING_FILTERS,
	matchesRecurringFilters,
	type Recurring,
} from "../../utils/recurringFilters";
import { EditRecurringModal } from "../recurring/EditRecurringModal";
import { NewRecurringModal } from "../recurring/NewRecurringModal";
import { RecurringFilterBar } from "../recurring/RecurringFilterBar";
import { RecurringTable } from "../recurring/RecurringTable";

type Props = {
	pendingModal: string | null;
	onClose: () => void;
};

export function RecurringDrawer({ pendingModal, onClose }: Props) {
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

	useEffect(() => {
		if (pendingModal === "new-recurring") setCreating(true);
	}, [pendingModal]);

	const visible = useMemo(
		() => recurrings.filter((r) => matchesRecurringFilters(r, filters)),
		[recurrings, filters],
	);

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between p-4 border-b border-base-200">
				<h2 className="text-lg font-semibold">Recurring</h2>
				<div className="flex items-center gap-2">
					<button
						type="button"
						className="btn btn-primary btn-sm"
						onClick={() => setCreating(true)}
					>
						New Recurring
					</button>
					<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
						<X className="size-4" />
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5">
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
						onEdit={setEditing}
						onTogglePaused={togglePaused}
						onDelete={deleteRecurring}
					/>
				)}
			</div>

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
