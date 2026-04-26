import { Link } from "react-router";
import type { Account } from "../../utils/accountBalances";
import { computeNetWorth } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";

type Props = {
	accounts: readonly Account[];
	isLoading: boolean;
};

export function OverviewHero({ accounts, isLoading }: Props) {
	if (isLoading && accounts.length === 0) {
		return (
			<section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				{[0, 1, 2].map((i) => (
					<div key={i} className="card bg-base-100 shadow-sm">
						<div className="card-body gap-2">
							<div className="skeleton h-4 w-24" />
							<div className="skeleton h-8 w-32" />
						</div>
					</div>
				))}
			</section>
		);
	}

	const net = computeNetWorth(accounts);
	const netNegative = net.netWorthCentavos < 0;

	return (
		<section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
			<Link
				to="/accounts"
				data-overview-card="assets"
				className="card bg-base-100 shadow-sm hover:shadow-md transition"
			>
				<div className="card-body gap-1">
					<span className="text-sm text-base-content/70">Total Assets</span>
					<span className="text-3xl font-semibold">{formatCentavos(net.assetsCentavos)}</span>
				</div>
			</Link>
			<Link
				to="/accounts?type=credit"
				data-overview-card="liabilities"
				className="card bg-base-100 shadow-sm hover:shadow-md transition"
			>
				<div className="card-body gap-1">
					<span className="text-sm text-base-content/70">Total Liabilities</span>
					<span className="text-3xl font-semibold text-error">
						{formatCentavos(net.liabilitiesCentavos)}
					</span>
				</div>
			</Link>
			<Link
				to="/accounts"
				data-overview-card="net"
				className="card bg-base-100 shadow-sm hover:shadow-md transition"
			>
				<div className="card-body gap-1">
					<span className="text-sm text-base-content/70">Net Worth</span>
					<span className={`text-3xl font-semibold ${netNegative ? "text-error" : ""}`}>
						{formatCentavos(net.netWorthCentavos)}
					</span>
				</div>
			</Link>
		</section>
	);
}
