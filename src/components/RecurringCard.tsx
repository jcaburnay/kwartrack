import { MoreVertical } from "lucide-react";
import { useState } from "react";
import { useReducer, useTable } from "spacetimedb/react";
import { reducers, tables } from "../module_bindings";
import { getAccountBackground } from "../utils/brandColors";
import { formatPesos } from "../utils/currency";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { RecurringModal } from "./RecurringModal";

interface RecurringDefinition {
	id: bigint;
	name: string;
	type: string;
	amountCentavos: bigint;
	tag: string;
	subAccountId: bigint;
	dayOfMonth: number;
	interval: string;
	anchorMonth: number;
	anchorDayOfWeek: number;
	isPaused: boolean;
	remainingOccurrences: number;
	totalOccurrences: number;
}

interface RecurringCardProps {
	definition: RecurringDefinition;
}

// Format sub-account label as "AccountName/SubAccountName" or "AccountName" for standalone
function formatSubAccountLabel(
	subAccountId: bigint,
	accounts: readonly { id: bigint; name: string }[],
	subAccounts: readonly { id: bigint; accountId: bigint; name: string; isDefault: boolean }[],
): string {
	if (subAccountId === 0n) return "";
	const partition = subAccounts.find((p) => p.id === subAccountId);
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
	const [subAccounts] = useTable(tables.my_sub_accounts);

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

	const partitionLabel = formatSubAccountLabel(definition.subAccountId, accounts, subAccounts);

	const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const MONTH_NAMES = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];

	// Build the scheduling anchor label shown on the card
	const anchorLabel = (() => {
		if (
			(definition.interval === "weekly" || definition.interval === "biweekly") &&
			definition.anchorDayOfWeek > 0
		) {
			// anchorDayOfWeek: 1=Mon..7=Sun → JS index: Mon=1..Sat=6, Sun=0
			const jsDay = definition.anchorDayOfWeek === 7 ? 0 : definition.anchorDayOfWeek;
			return DOW_NAMES[jsDay];
		}
		if (
			(definition.interval === "semiannual" || definition.interval === "yearly") &&
			definition.anchorMonth > 0
		) {
			return `${MONTH_NAMES[definition.anchorMonth - 1]} ${definition.dayOfMonth}`;
		}
		return `day ${definition.dayOfMonth}`;
	})();

	return (
		<>
			<div
				className={`rounded-xl bg-base-100 shadow-sm border border-base-300/50 card-hover relative${definition.isPaused ? " opacity-60" : ""}`}
			>
				<div className="p-5 flex flex-col gap-2 pr-8">
					{/* Name */}
					<div className="flex items-center gap-2.5">
						<span
							className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-base-content/15"
							style={{ background: getAccountBackground(definition.name) }}
						/>
						<p className="text-sm font-semibold leading-tight">{definition.name}</p>
					</div>

					{/* Amount */}
					<span className={`${amountClass} font-mono`}>
						{formatPesos(definition.amountCentavos)}
					</span>

					{/* Type badge + interval badge + day */}
					<div className="flex items-center gap-2 flex-wrap">
						<span className={typeBadgeClass}>{definition.type}</span>
						<span className="badge badge-sm badge-neutral">{definition.interval}</span>
						{/* Completed badge for finished installments */}
						{definition.totalOccurrences > 0 &&
							definition.remainingOccurrences === 0 &&
							definition.isPaused && (
								<span className="badge badge-sm badge-success">Completed</span>
							)}
						<span className="text-xs text-base-content/50">{anchorLabel}</span>
					</div>

					{/* Installment counter */}
					{definition.totalOccurrences > 0 && (
						<span className="text-xs text-base-content/50">
							{definition.remainingOccurrences} of {definition.totalOccurrences} payments
						</span>
					)}

					{/* Tag + partition */}
					<p className="text-xs text-base-content/50 truncate">
						{definition.tag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
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
