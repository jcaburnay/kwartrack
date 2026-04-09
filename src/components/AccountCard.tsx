import { MoreVertical } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useReducer } from "spacetimedb/react";
import { reducers } from "../module_bindings";
import { formatPesos } from "../utils/currency";
import { EditAccountModal } from "./AccountIconModal";
import { BankIcon } from "./BankIcon";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

interface AccountCardProps {
	id: bigint;
	name: string;
	totalBalanceCentavos: bigint;
	partitionCount: number;
	iconBankId?: string | null;
}

export function AccountCard({
	id,
	name,
	totalBalanceCentavos,
	partitionCount,
	iconBankId,
}: AccountCardProps) {
	const deleteAccount = useReducer(reducers.deleteAccount);

	const [showEditModal, setShowEditModal] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	return (
		<>
			<div className="rounded-xl bg-base-100 shadow-sm card-hover relative border border-base-300/50">
				<Link to={`/accounts/${id.toString()}`} className="p-5 flex flex-col gap-4 pr-10">
					<div className="flex items-center gap-3">
						<BankIcon bankId={iconBankId} name={name} size={40} />
						<div>
							<span className="font-semibold text-base">{name}</span>
							{partitionCount > 1 && (
								<p className="text-xs text-base-content/40">{partitionCount} partitions</p>
							)}
						</div>
					</div>
					<span className="text-xl font-semibold font-mono">
						{formatPesos(totalBalanceCentavos)}
					</span>
				</Link>

				{/* Options dropdown */}
				<div className="absolute top-3 right-3 z-10 dropdown dropdown-end">
					<button
						type="button"
						className="btn btn-ghost btn-xs btn-circle"
						aria-label="Account options"
						tabIndex={0}
					>
						<MoreVertical size={14} />
					</button>
					<ul
						tabIndex={0}
						className="dropdown-content menu bg-base-100 rounded-xl z-10 w-32 p-1 shadow-lg border border-base-300/50"
					>
						<li>
							<button type="button" onClick={() => setShowEditModal(true)}>
								Edit
							</button>
						</li>
						<li>
							<button
								type="button"
								className="text-error"
								onClick={() => setShowDeleteConfirm(true)}
							>
								Delete
							</button>
						</li>
					</ul>
				</div>
			</div>

			{showEditModal && (
				<EditAccountModal
					accountId={id}
					currentName={name}
					currentBankId={iconBankId ?? null}
					onClose={() => setShowEditModal(false)}
				/>
			)}

			{showDeleteConfirm && (
				<DeleteConfirmModal
					title={`Delete ${name}?`}
					body="This will permanently delete this account and all its partitions."
					confirmLabel={`Delete ${name}`}
					dismissLabel="Cancel"
					onConfirm={() => {
						deleteAccount({ accountId: id });
						setShowDeleteConfirm(false);
					}}
					onDismiss={() => setShowDeleteConfirm(false)}
				/>
			)}
		</>
	);
}
