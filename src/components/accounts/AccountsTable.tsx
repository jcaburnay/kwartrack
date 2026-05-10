import type { Account, AccountGroup, AccountType } from "../../utils/accountBalances";
import {
	creditUtilization,
	groupRollup,
	isLiability,
	sortAccountsByGroupAndName,
} from "../../utils/accountBalances";
import { ACCOUNT_TYPE_LABEL } from "../../utils/accountValidation";
import { formatCentavos } from "../../utils/currency";
import { AccountRowActions } from "./AccountRowActions";

type Props = {
	accounts: readonly Account[];
	groups: readonly AccountGroup[];
	selectedAccountId: string | null;
	selectedGroupId: string | null;
	onSelectAccount: (id: string | null) => void;
	onSelectGroup: (id: string | null) => void;
	onEdit: (account: Account) => void;
	onChanged: () => Promise<void> | void;
	showArchived: boolean;
	typeFilter?: AccountType | null;
};

function pctClass(pct: number): string {
	if (pct > 1) return "progress-error";
	if (pct >= 0.8) return "progress-warning";
	return "progress-success";
}

function CompactCreditBar({ account }: { account: Account }) {
	const util = creditUtilization(account);
	if (!util) return null;
	const utilPct = Math.min(100, Math.round(util.utilizationPct * 100));
	return (
		<div className="flex flex-col gap-0.5 mt-1 w-32 sm:w-40 ml-auto">
			<progress
				className={`progress h-1 ${pctClass(util.utilizationPct)}`}
				value={utilPct}
				max="100"
			/>
		</div>
	);
}

type DisplayRow =
	| { kind: "group-header"; group: AccountGroup; netCentavos: number }
	| { kind: "account"; account: Account };

function buildRows(accounts: readonly Account[], groups: readonly AccountGroup[]): DisplayRow[] {
	const rows: DisplayRow[] = [];
	const sorted = sortAccountsByGroupAndName(accounts, groups);

	let lastGroupId: string | null | undefined;
	for (const a of sorted) {
		if (a.group_id !== lastGroupId) {
			lastGroupId = a.group_id;
			const group = groups.find((g) => g.id === a.group_id);
			if (group) {
				rows.push({
					kind: "group-header",
					group,
					netCentavos: groupRollup(group.id, accounts),
				});
			}
		}
		rows.push({ kind: "account", account: a });
	}
	return rows;
}

export function AccountsTable({
	accounts,
	groups,
	selectedAccountId,
	selectedGroupId,
	onSelectAccount,
	onSelectGroup,
	onEdit,
	onChanged,
	showArchived,
	typeFilter,
}: Props) {
	let visible = showArchived ? accounts : accounts.filter((a) => !a.is_archived);
	if (typeFilter) {
		visible = visible.filter((a) => a.type === typeFilter);
	}
	const rows = buildRows(visible, groups);

	if (rows.length === 0) {
		return (
			<div className="border border-dashed border-base-300 p-6 text-center text-base-content/60">
				No accounts yet. Tap the <strong>+</strong> button to create your first one.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="table table-pin-rows">
				<thead>
					<tr className="text-base-content/60">
						<th>Account</th>
						<th className="text-right">Balance</th>
						<th className="w-12" />
					</tr>
				</thead>
				<tbody>
					{rows.map((row) =>
						row.kind === "group-header" ? (
							<tr
								key={`g-${row.group.id}`}
								className={`bg-base-200 cursor-pointer ${
									selectedGroupId === row.group.id ? "outline outline-primary/30" : ""
								}`}
								onClick={() =>
									onSelectGroup(selectedGroupId === row.group.id ? null : row.group.id)
								}
							>
								<th className="font-semibold">{row.group.name}</th>
								<th
									className={`text-right font-semibold ${row.netCentavos < 0 ? "text-error" : "text-success"}`}
								>
									{formatCentavos(row.netCentavos)}
								</th>
								<th />
							</tr>
						) : (
							<tr
								key={row.account.id}
								className={`cursor-pointer hover:bg-base-200 ${
									selectedAccountId === row.account.id
										? "border-l-2 border-primary"
										: "border-l-2 border-transparent"
								} ${row.account.is_archived ? "opacity-60" : ""}`}
								onClick={() =>
									onSelectAccount(selectedAccountId === row.account.id ? null : row.account.id)
								}
							>
								<td className="pl-8">
									<div className="flex flex-col">
										<span>
											{row.account.name}
											{row.account.is_archived && (
												<span className="badge badge-ghost badge-sm ml-2">Archived</span>
											)}
											{row.account.type === "time-deposit" && row.account.is_matured && (
												<span className="badge badge-ghost badge-sm ml-2">Matured</span>
											)}
										</span>
										<span className="text-xs text-base-content/50">
											{ACCOUNT_TYPE_LABEL[row.account.type]}
										</span>
									</div>
								</td>
								<td
									className={`text-right tabular-nums ${isLiability(row.account) ? "text-error" : "text-success"}`}
								>
									<div>{formatCentavos(row.account.balance_centavos)}</div>
									{row.account.type === "credit" && <CompactCreditBar account={row.account} />}
								</td>
								{/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation wrapper for the row-actions kebab. */}
								<td onClick={(e) => e.stopPropagation()}>
									<AccountRowActions account={row.account} onEdit={onEdit} onChanged={onChanged} />
								</td>
							</tr>
						),
					)}
				</tbody>
			</table>
		</div>
	);
}
