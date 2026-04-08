import { Plus, TrendingUp, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTable } from "spacetimedb/react";
import { AccountCard } from "../components/AccountCard";
import { AccountModal } from "../components/AccountModal";
import { NewAccountCard } from "../components/NewAccountCard";
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

	function getAccountBalance(accountId: bigint): bigint {
		return partitions
			.filter((p) => p.accountId === accountId)
			.reduce((sum, p) => sum + p.balanceCentavos, 0n);
	}

	if (!isReady) return null;

	// Empty state — only after data is confirmed empty
	if (accounts.length === 0) {
		return (
			<div className="p-4 sm:p-6">
				<p className="text-xs font-semibold tracking-widest text-base-content/40 uppercase mb-5">
					Accounts
				</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					<button
						type="button"
						className="border-2 border-dashed border-base-300 rounded-xl p-8 flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors bg-transparent w-full"
						onClick={() => setShowModal(true)}
					>
						<div className="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center text-base-content/40">
							<Plus size={20} />
						</div>
						<span className="text-base-content/50 font-medium">New account</span>
					</button>
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

	// Compute net worth
	const netWorth = accounts.reduce((sum, a) => sum + getAccountBalance(a.id), 0n);

	return (
		<div className="p-4 sm:p-6">
			<p className="text-xs font-semibold tracking-widest text-base-content/40 uppercase mb-5">
				Accounts
			</p>

			{/* Net Worth Summary */}
			<div className="bg-gradient-to-br from-primary/10 to-base-200 rounded-2xl px-6 py-5 mb-6 flex items-center justify-between animate-card-enter">
				<div>
					<div className="text-sm font-medium text-base-content/60 flex items-center gap-1.5 mb-1">
						<TrendingUp size={14} />
						Net Worth
					</div>
					<div className="text-3xl font-bold font-mono tracking-tight">{formatPesos(netWorth)}</div>
					<div className="text-xs text-base-content/40 mt-1">
						Across {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
					</div>
				</div>
				<Wallet size={44} strokeWidth={1} className="text-primary/20" />
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
							totalBalanceCentavos={getAccountBalance(account.id)}
							partitionCount={partitions.filter((p) => p.accountId === account.id).length}
						/>
					</div>
				))}
				<div
					className="animate-card-enter"
					style={{ animationDelay: `${accounts.length * 0.06}s` }}
				>
					<NewAccountCard onClick={() => setShowModal(true)} />
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
