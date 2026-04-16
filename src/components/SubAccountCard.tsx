import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducer } from "spacetimedb/react";
import { reducers } from "../module_bindings";
import { formatPesos } from "../utils/currency";

interface SubAccountCardProps {
	id: bigint;
	name: string;
	balanceCentavos: bigint;
	subAccountType?: string;
	creditLimitCentavos?: bigint;
	onDeleteRequest: (id: bigint, name: string) => void;
	onPayCredit?: (subAccountId: bigint) => void;
	onEdit?: (subAccountId: bigint) => void;
	interestRateBps?: number;
	maturityDate?: Date;
	isMatured?: boolean;
}

export function SubAccountCard({
	id,
	name,
	balanceCentavos,
	subAccountType = "wallet",
	creditLimitCentavos = 0n,
	onDeleteRequest,
	onPayCredit,
	onEdit,
	interestRateBps,
	maturityDate,
	isMatured = false,
}: SubAccountCardProps) {
	const renameSubAccount = useReducer(reducers.renameSubAccount);
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
			renameSubAccount({ subAccountId: id, newName: trimmed });
		}
		setIsRenaming(false);
	};

	const handleRenameCancel = () => {
		setIsRenaming(false);
		setRenameValue(name);
	};

	const isCreditSubAccount = subAccountType === "credit" && creditLimitCentavos > 0n;
	const availableCentavos = isCreditSubAccount
		? balanceCentavos > creditLimitCentavos
			? 0n
			: creditLimitCentavos - balanceCentavos
		: 0n;
	const availablePct = isCreditSubAccount
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

	const isTimeDeposit = subAccountType === "time-deposit";
	const interestRateDisplay =
		interestRateBps != null ? `${(interestRateBps / 100).toFixed(2)}% p.a.` : null;
	const maturityDateDisplay = maturityDate
		? "Matures " +
			maturityDate.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
		: null;

	return (
		<div className="rounded-xl bg-base-100 shadow-sm p-5 flex flex-col gap-4 relative card-hover border border-base-300/50">
			<div className="absolute top-3 right-3 dropdown dropdown-end">
				<button
					type="button"
					className="btn btn-ghost btn-xs btn-circle"
					aria-label="Sub-account options"
				>
					<MoreVertical size={14} />
				</button>
				<ul className="dropdown-content menu bg-base-100 rounded-xl z-10 w-36 p-1 shadow-lg border border-base-300/50">
					{(isCreditSubAccount || isTimeDeposit) && onEdit ? (
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
					{isCreditSubAccount && onPayCredit && (
						<li>
							<button type="button" onClick={() => onPayCredit(id)}>
								Pay
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

			<div className="pr-6 flex flex-col gap-1">
				{isRenaming ? (
					<input
						ref={inputRef}
						className="input input-bordered input-sm w-full"
						value={renameValue}
						onChange={(e) => setRenameValue(e.target.value)}
						onBlur={handleRenameCommit}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleRenameCommit();
							if (e.key === "Escape") handleRenameCancel();
						}}
						placeholder="Sub-account name"
					/>
				) : (
					<span className="font-semibold text-base">{name}</span>
				)}
				{isCreditSubAccount && <span className="badge badge-warning badge-xs w-fit">CREDIT</span>}
			</div>

			{isCreditSubAccount ? (
				<div className="flex flex-col gap-1.5">
					<div className="flex flex-col gap-0.5">
						<span className="text-xl font-semibold font-mono">
							{formatPesos(availableCentavos)}
						</span>
						<span className="text-xs text-base-content/60 font-mono">
							of {formatPesos(creditLimitCentavos)} limit
						</span>
					</div>
					<progress
						className={`progress ${progressColor} w-full h-2`}
						value={availablePct}
						max={100}
						title={`${availablePct}% available`}
					/>
					<span className="text-xs text-base-content/60">{availablePct}% available</span>
				</div>
			) : (
				<div className="flex flex-col gap-1">
					<span className="text-xl font-semibold font-mono">{formatPesos(balanceCentavos)}</span>
					{isTimeDeposit && (
						<div className="flex flex-col gap-1">
							{isMatured ? (
								<span className="badge badge-warning badge-sm w-fit">Matured</span>
							) : null}
							{interestRateDisplay && (
								<span className="text-xs text-base-content/60 font-mono">
									{interestRateDisplay}
								</span>
							)}
							{maturityDateDisplay && !isMatured && (
								<span className="text-xs text-base-content/60">{maturityDateDisplay}</span>
							)}
							{isMatured && (
								<span className="text-xs text-base-content/60">Withdraw or roll over</span>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
