import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducer } from "spacetimedb/react";
import { reducers } from "../module_bindings";
import { getAvatarColor } from "../utils/avatarColor";
import { formatPesos } from "../utils/currency";

interface PartitionCardProps {
	id: bigint;
	name: string;
	balanceCentavos: bigint;
	partitionType?: string;
	creditLimitCentavos?: bigint;
	onDeleteRequest: (id: bigint, name: string) => void;
	onPayCredit?: (partitionId: bigint) => void;
	onEdit?: (partitionId: bigint) => void;
}

export function PartitionCard({
	id,
	name,
	balanceCentavos,
	partitionType = "wallet",
	creditLimitCentavos = 0n,
	onDeleteRequest,
	onPayCredit,
	onEdit,
}: PartitionCardProps) {
	const renamePartition = useReducer(reducers.renamePartition);
	const [isRenaming, setIsRenaming] = useState(false);
	const [renameValue, setRenameValue] = useState(name);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isRenaming) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isRenaming]);

	const handleRenameStart = () => {
		setRenameValue(name);
		setIsRenaming(true);
	};

	const handleRenameCommit = () => {
		const trimmed = renameValue.trim();
		if (trimmed && trimmed !== name) {
			renamePartition({ partitionId: id, newName: trimmed });
		}
		setIsRenaming(false);
	};

	const handleRenameCancel = () => {
		setIsRenaming(false);
		setRenameValue(name);
	};

	const isCreditPartition = partitionType === "credit" && creditLimitCentavos > 0n;
	const availableCentavos = isCreditPartition ? creditLimitCentavos - balanceCentavos : 0n;
	const availablePct = isCreditPartition
		? Math.max(
				0,
				Math.min(
					100,
					100 - Math.round((Number(balanceCentavos) * 100) / Number(creditLimitCentavos)),
				),
			)
		: 0;
	const progressColor =
		availablePct <= 0
			? "progress-error"
			: availablePct <= 20
				? "progress-warning"
				: "progress-success";

	const avatar = getAvatarColor(name);

	return (
		<div className="rounded-xl bg-base-100 shadow-sm p-5 flex flex-col gap-4 relative card-hover border border-base-300/50">
			{/* Options dropdown */}
			<div className="absolute top-3 right-3 dropdown dropdown-end">
				<button
					type="button"
					className="btn btn-ghost btn-xs btn-circle"
					aria-label="Partition options"
					tabIndex={0}
				>
					<MoreVertical size={14} />
				</button>
				<ul
					tabIndex={0}
					className="dropdown-content menu bg-base-100 rounded-xl z-10 w-36 p-1 shadow-lg border border-base-300/50"
				>
					{isCreditPartition && onEdit ? (
						<li>
							<button type="button" onClick={() => onEdit(id)}>
								Edit
							</button>
						</li>
					) : (
						<li>
							<button type="button" onClick={handleRenameStart}>
								Rename
							</button>
						</li>
					)}
					<li>
						<button type="button" className="text-error" onClick={() => onDeleteRequest(id, name)}>
							Delete
						</button>
					</li>
				</ul>
			</div>

			{/* Avatar + name */}
			<div className="flex items-center gap-3 pr-6">
				<div
					className={`w-10 h-10 rounded-xl ${avatar.bg} ${avatar.text} flex-shrink-0 flex items-center justify-center text-sm font-bold`}
				>
					{name.charAt(0).toUpperCase()}
				</div>
				{isRenaming ? (
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
						placeholder="Partition name"
					/>
				) : (
					<span className="font-semibold text-base">{name}</span>
				)}
			</div>

			{/* Balance */}
			{isCreditPartition ? (
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center gap-2">
						<span className="text-xl font-semibold font-mono">
							{formatPesos(availableCentavos)} / {formatPesos(creditLimitCentavos)}
						</span>
						<span className="badge badge-warning badge-sm">CREDIT</span>
					</div>
					<progress
						className={`progress ${progressColor} w-full h-2`}
						value={availablePct}
						max={100}
					/>
					<span className="text-sm text-base-content/60">{availablePct}% available</span>
					<button
						type="button"
						className="btn btn-sm btn-outline btn-primary w-full mt-1"
						onClick={() => onPayCredit?.(id)}
						disabled={balanceCentavos === 0n}
					>
						Pay Credit
					</button>
				</div>
			) : (
				<span className="text-xl font-semibold font-mono">{formatPesos(balanceCentavos)}</span>
			)}
		</div>
	);
}
