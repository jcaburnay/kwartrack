import { MoreVertical } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useAccountActions } from "../hooks";
import { getAccountBackground } from "../utils/brandColors";
import { formatPesos } from "../utils/currency";
import { EditAccountModal } from "./AccountIconModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

interface AccountCardProps {
	id: bigint;
	name: string;
	totalBalanceCentavos: bigint;
	subAccountCount: number;
	iconBankId?: string | null;
}

export function AccountCard({
	id,
	name,
	totalBalanceCentavos,
	subAccountCount,
	iconBankId,
}: AccountCardProps) {
	const { remove: deleteAccount } = useAccountActions();

	const [showEditModal, setShowEditModal] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	return (
		<>
			<div className="rounded-xl bg-base-100 shadow-sm card-hover relative border border-base-300/50">
				<Link to={`/accounts/${id.toString()}`} className="p-5 flex flex-col gap-4 pr-10">
					<div className="flex items-center gap-3">
						<span
							className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-base-content/15"
							style={{ background: getAccountBackground(name) }}
						/>
						<div>
							<span className="font-semibold text-base">{name}</span>
							<p className="text-xs text-base-content/60">
								{subAccountCount === 0
									? "Standalone"
									: subAccountCount === 1
										? "1 sub-account"
										: `${subAccountCount} sub-accounts`}
							</p>
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
					>
						<MoreVertical size={14} />
					</button>
					<ul className="dropdown-content menu bg-base-100 rounded-xl z-10 w-32 p-1 shadow-lg border border-base-300/50">
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
					body="This will permanently delete this account and all its sub-accounts."
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
