import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useReducer } from "spacetimedb/react";
import { reducers } from "../module_bindings";
import { getAvatarColor } from "../utils/avatarColor";
import { formatPesos } from "../utils/currency";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

interface AccountCardProps {
	id: bigint;
	name: string;
	totalBalanceCentavos: bigint;
	partitionCount: number;
}

export function AccountCard({ id, name, totalBalanceCentavos, partitionCount }: AccountCardProps) {
	const renameAccount = useReducer(reducers.renameAccount);
	const deleteAccount = useReducer(reducers.deleteAccount);

	const [isRenaming, setIsRenaming] = useState(false);
	const [renameValue, setRenameValue] = useState(name);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isRenaming) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isRenaming]);

	const handleRenameCommit = () => {
		const trimmed = renameValue.trim();
		if (trimmed && trimmed !== name) {
			renameAccount({ accountId: id, newName: trimmed });
		}
		setIsRenaming(false);
	};

	const handleRenameCancel = () => {
		setIsRenaming(false);
		setRenameValue(name);
	};

	const avatar = getAvatarColor(name);

	return (
		<>
			<div className="rounded-xl bg-base-100 shadow-sm card-hover relative border border-base-300/50">
				{/* Card content */}
				{isRenaming ? (
					<div className="p-5 flex flex-col gap-4">
						<div className="flex items-center gap-3 pr-8">
							<div
								className={`w-10 h-10 rounded-xl ${avatar.bg} ${avatar.text} flex-shrink-0 flex items-center justify-center text-sm font-bold`}
							>
								{name.charAt(0).toUpperCase()}
							</div>
							<input
								ref={inputRef}
								className="input input-bordered input-sm flex-1"
								value={renameValue}
								onChange={(e) => setRenameValue(e.target.value)}
								onBlur={handleRenameCommit}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleRenameCommit();
									if (e.key === "Escape") handleRenameCancel();
								}}
								placeholder="Account name"
							/>
						</div>
						<span className="text-xl font-semibold font-mono">
							{formatPesos(totalBalanceCentavos)}
						</span>
					</div>
				) : (
					<Link to={`/accounts/${id.toString()}`} className="p-5 flex flex-col gap-4 pr-10">
						<div className="flex items-center gap-3">
							<div
								className={`w-10 h-10 rounded-xl ${avatar.bg} ${avatar.text} flex-shrink-0 flex items-center justify-center text-sm font-bold`}
							>
								{name.charAt(0).toUpperCase()}
							</div>
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
				)}

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
						className="dropdown-content menu bg-base-100 rounded-xl z-10 w-36 p-1 shadow-lg border border-base-300/50"
					>
						<li>
							<button
								type="button"
								onClick={() => {
									setRenameValue(name);
									setIsRenaming(true);
								}}
							>
								Rename
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
