import { MoreVertical } from "lucide-react";

interface TransactionRowActionsProps {
	onEdit: () => void;
	onDelete: () => void;
}

export function TransactionRowActions({ onEdit, onDelete }: TransactionRowActionsProps) {
	return (
		<div className="dropdown dropdown-end">
			<button
				type="button"
				tabIndex={0}
				className="btn btn-ghost btn-xs btn-circle"
				aria-label="Transaction options"
			>
				<MoreVertical size={14} />
			</button>
			<ul
				tabIndex={0}
				className="dropdown-content menu bg-base-100 rounded-xl border border-base-300/50 z-10 w-36 p-1 shadow-md"
			>
				<li>
					<button type="button" onClick={onEdit}>
						Edit
					</button>
				</li>
				<li>
					<button type="button" className="text-error" onClick={onDelete}>
						Delete
					</button>
				</li>
			</ul>
		</div>
	);
}
