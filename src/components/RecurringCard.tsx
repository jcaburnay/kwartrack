import { MoreVertical } from "lucide-react";
import { useState } from "react";
import { useReducer, useTable } from "spacetimedb/react";
import { reducers, tables } from "../module_bindings";
import { getAvatarColor } from "../utils/avatarColor";
import { formatPesos } from "../utils/currency";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { RecurringModal } from "./RecurringModal";

interface RecurringDefinition {
	id: bigint;
	name: string;
	type: string;
	amountCentavos: bigint;
	tag: string;
	partitionId: bigint;
	dayOfMonth: number;
	isPaused: boolean;
	remainingMonths: number;
	totalMonths: number;
}

interface RecurringCardProps {
	definition: RecurringDefinition;
}

// Format partition label as "AccountName/PartitionName" or "AccountName" for standalone
function formatPartitionLabel(
	partitionId: bigint,
	accounts: readonly { id: bigint; name: string }[],
	partitions: readonly { id: bigint; accountId: bigint; name: string; isDefault: boolean }[],
): string {
	if (partitionId === 0n) return "";
	const partition = partitions.find((p) => p.id === partitionId);
	if (!partition) return "";
	const account = accounts.find((a) => a.id === partition.accountId);
	if (!account) return "";
	if (partition.isDefault) return account.name;
	return `${account.name}/${partition.name}`;
}

export function RecurringCard({ definition }: RecurringCardProps) {
	const pauseDefinition = useReducer(reducers.pauseRecurringDefinition);
	const resumeDefinition = useReducer(reducers.resumeRecurringDefinition);
	const deleteDefinition = useReducer(reducers.deleteRecurringDefinition);
	const [accounts] = useTable(tables.my_accounts);
	const [partitions] = useTable(tables.my_partitions);

	const [showEdit, setShowEdit] = useState(false);
	const [showDelete, setShowDelete] = useState(false);

	const handlePauseResume = () => {
		if (definition.isPaused) {
			resumeDefinition({ definitionId: definition.id });
		} else {
			pauseDefinition({ definitionId: definition.id });
		}
	};

	const handleConfirmDelete = () => {
		deleteDefinition({ definitionId: definition.id });
		setShowDelete(false);
	};

	const typeBadgeClass =
		definition.type === "expense" ? "badge badge-sm badge-error" : "badge badge-sm badge-success";

	const amountClass =
		definition.type === "expense"
			? "text-error font-semibold text-sm"
			: "text-success font-semibold text-sm";

	const partitionLabel = formatPartitionLabel(definition.partitionId, accounts, partitions);
	const avatar = getAvatarColor(definition.name);

	return (
		<>
			<div
				className={`rounded-xl bg-base-100 shadow-sm border border-base-300/50 card-hover relative${definition.isPaused ? " opacity-60" : ""}`}
			>
				<div className="p-5 flex flex-col gap-2 pr-8">
					{/* Avatar + Name */}
					<div className="flex items-center gap-3">
						<div
							className={`w-10 h-10 rounded-xl ${avatar.bg} ${avatar.text} flex-shrink-0 flex items-center justify-center text-sm font-bold`}
						>
							{definition.name.charAt(0).toUpperCase()}
						</div>
						<p className="text-sm font-semibold leading-tight">{definition.name}</p>
					</div>

					{/* Amount */}
					<span className={`${amountClass} font-mono`}>
						{formatPesos(definition.amountCentavos)}
					</span>

					{/* Type badge + day */}
					<div className="flex items-center gap-2">
						<span className={typeBadgeClass}>{definition.type}</span>
						{/* Completed badge for finished installments */}
						{definition.totalMonths > 0 &&
							definition.remainingMonths === 0 &&
							definition.isPaused && (
								<span className="badge badge-sm badge-success">Completed</span>
							)}
						<span className="text-xs text-base-content/50">day {definition.dayOfMonth}</span>
					</div>

					{/* Installment counter (per D-04, D-05) */}
					{definition.totalMonths > 0 && (
						<span className="text-xs text-base-content/50">
							{definition.remainingMonths} of {definition.totalMonths} months
						</span>
					)}

					{/* Tag + partition */}
					<p className="text-xs text-base-content/50 truncate">
						{definition.tag}
						{partitionLabel ? ` · ${partitionLabel}` : ""}
					</p>
				</div>

				{/* ⋮ menu — absolute top-right */}
				<div className="absolute top-3 right-3 z-10 dropdown dropdown-end">
					<button
						type="button"
						tabIndex={0}
						className="btn btn-ghost btn-xs btn-circle"
						aria-label="More actions"
					>
						<MoreVertical size={14} />
					</button>
					<ul
						tabIndex={0}
						className="dropdown-content menu bg-base-100 rounded-xl z-10 w-36 p-1 shadow-lg border border-base-300/50"
					>
						<li>
							<button type="button" onClick={() => setShowEdit(true)}>
								Edit
							</button>
						</li>
						<li>
							<button type="button" onClick={handlePauseResume}>
								{definition.isPaused ? "Resume" : "Pause"}
							</button>
						</li>
						<li>
							<button type="button" className="text-error" onClick={() => setShowDelete(true)}>
								Delete
							</button>
						</li>
					</ul>
				</div>
			</div>

			{/* Edit modal */}
			{showEdit && <RecurringModal onClose={() => setShowEdit(false)} definition={definition} />}

			{/* Delete confirm modal */}
			{showDelete && (
				<DeleteConfirmModal
					title={`Delete ${definition.name}?`}
					body="This recurring transaction will no longer fire. Transactions already created are not affected."
					confirmLabel={`Delete ${definition.name}`}
					dismissLabel="Keep it"
					onConfirm={handleConfirmDelete}
					onDismiss={() => setShowDelete(false)}
				/>
			)}
		</>
	);
}
