import { X } from "lucide-react";
import type { Account, AccountGroup } from "../../utils/accountBalances";
import { groupRollup } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";

type Props = {
	group: AccountGroup;
	accounts: readonly Account[];
	onClear: () => void;
};

export function GroupSummaryCard({ group, accounts, onClear }: Props) {
	const members = accounts.filter((a) => a.group_id === group.id && !a.is_archived);
	const rollup = groupRollup(group.id, accounts);
	const isNegative = rollup < 0;

	return (
		<div className="flex flex-col gap-3 p-4">
			<div className="flex items-center justify-between">
				<span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
					{group.name}
				</span>
				<button
					type="button"
					aria-label="Clear group selection"
					className="btn btn-ghost btn-xs btn-circle"
					onClick={onClear}
				>
					<X className="size-3.5" />
				</button>
			</div>

			<div>
				<p
					data-testid="group-rollup"
					className={`text-3xl font-semibold tabular-nums ${isNegative ? "text-error" : ""}`}
				>
					{formatCentavos(rollup)}
				</p>
				<p className="text-xs text-base-content/60 mt-0.5">
					{members.length} {members.length === 1 ? "account" : "accounts"}
				</p>
			</div>

			{members.length > 0 && (
				<ul className="flex flex-col gap-1.5 text-sm">
					{members.map((a) => (
						<li key={a.id} className="flex items-center justify-between gap-3">
							<span className="text-base-content/80 truncate">{a.name}</span>
							<span
								className={`tabular-nums font-mono text-base-content/80 ${a.balance_centavos < 0 ? "text-error" : ""}`}
							>
								{formatCentavos(a.balance_centavos)}
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
