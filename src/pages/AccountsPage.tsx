import { TrendingUp } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTable } from "spacetimedb/react";
import { AccountCard } from "../components/AccountCard";
import { AccountModal } from "../components/AccountModal";
import { NewItemCard } from "../components/NewItemCard";
import { tables } from "../module_bindings";
import { formatPesos } from "../utils/currency";

export function AccountsPage() {
	const [showModal, setShowModal] = useState(false);
	const navigate = useNavigate();
	const pendingNavigation = useRef(false);

	const [accounts, isReady] = useTable(tables.my_accounts, {
		onInsert: (row) => {
			if (pendingNavigation.current) {
				pendingNavigation.current = false;
				navigate(`/accounts/${row.id.toString()}`);
			}
		},
	});
	const [partitions] = useTable(tables.my_partitions);

	// Aggregate partition stats in one pass instead of filtering per account
	const accountStats = useMemo(() => {
		const map = new Map<bigint, { balance: bigint; partitionCount: number }>();
		for (const p of partitions) {
			const existing = map.get(p.accountId);
			if (existing) {
				existing.balance += p.balanceCentavos;
				existing.partitionCount++;
			} else {
				map.set(p.accountId, { balance: p.balanceCentavos, partitionCount: 1 });
			}
		}
		return map;
	}, [partitions]);

	const netWorth = useMemo(
		() => accounts.reduce((sum, a) => sum + (accountStats.get(a.id)?.balance ?? 0n), 0n),
		[accounts, accountStats],
	);

	if (!isReady) return null;

	// Empty state
	if (accounts.length === 0) {
		return (
			<div className="p-4 sm:p-6 animate-card-enter">
				<h1 className="text-xs font-medium tracking-widest text-base-content/35 uppercase mb-5">
					Accounts
				</h1>
				<p className="text-sm text-base-content/50 mb-5">
					Accounts hold your money — savings, checking, credit cards. Each can be split into
					partitions. Add your first account to start tracking.
				</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					<NewItemCard label="New account" onClick={() => setShowModal(true)} />
				</div>
				{showModal && (
					<AccountModal
						onClose={() => setShowModal(false)}
						onAccountCreated={() => {
							pendingNavigation.current = true;
						}}
					/>
				)}
			</div>
		);
	}

	return (
		<div className="p-4 sm:p-6 animate-card-enter">
			<h1 className="text-xs font-medium tracking-widest text-base-content/35 uppercase mb-5">
				Accounts
			</h1>

			{/* Net Worth Summary */}
			<div className="mb-6 animate-card-enter">
				<div className="text-xs font-medium text-base-content/40 flex items-center gap-1.5 mb-1 uppercase tracking-widest">
					<TrendingUp size={12} />
					Net Worth
				</div>
				<div className="text-3xl font-bold font-mono tracking-tight">{formatPesos(netWorth)}</div>
				<div className="text-xs text-base-content/40 mt-1">
					Across {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
				</div>
			</div>

			{/* Account Cards Grid */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{accounts.map((account, i) => (
					<div
						key={account.id.toString()}
						className="animate-card-enter"
						style={{ animationDelay: `${i * 0.06}s` }}
					>
						<AccountCard
							id={account.id}
							name={account.name}
							totalBalanceCentavos={accountStats.get(account.id)?.balance ?? 0n}
							partitionCount={accountStats.get(account.id)?.partitionCount ?? 0}
						/>
					</div>
				))}
				<div
					className="animate-card-enter h-full"
					style={{ animationDelay: `${accounts.length * 0.06}s` }}
				>
					<NewItemCard label="New account" onClick={() => setShowModal(true)} />
				</div>
			</div>
			{showModal && (
				<AccountModal
					onClose={() => setShowModal(false)}
					onAccountCreated={() => {
						pendingNavigation.current = true;
					}}
				/>
			)}
		</div>
	);
}
