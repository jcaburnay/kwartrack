import { AlertTriangle, HandCoins, Repeat } from "lucide-react";
import { Link } from "react-router";
import { formatCentavos } from "../../utils/currency";
import type { UpcomingItem } from "../../utils/overviewAggregation";

type Props = {
	items: readonly UpcomingItem[];
	isLoading: boolean;
};

function ItemRow({ item }: { item: UpcomingItem }) {
	switch (item.kind) {
		case "recurring": {
			const dayLabel =
				item.daysAway === 0
					? "due now"
					: item.daysAway === 1
						? "in 1 day"
						: `in ${item.daysAway} days`;
			return (
				<Link to="/recurring" className="flex items-center gap-3 hover:opacity-80">
					<Repeat className="size-4 text-base-content/60" aria-hidden="true" />
					<span className="flex-1 text-sm">
						<span className="font-medium">{item.service}</span>
						<span className="text-base-content/60">
							{" "}
							· {formatCentavos(item.amountCentavos)} · {dayLabel}
						</span>
					</span>
				</Link>
			);
		}
		case "loaned-debt": {
			return (
				<Link to="/debts-and-splits" className="flex items-center gap-3 hover:opacity-80">
					<HandCoins className="size-4 text-base-content/60" aria-hidden="true" />
					<span className="flex-1 text-sm">
						<span className="font-medium">{item.personName}</span>
						<span className="text-base-content/60">
							{" "}
							owes {formatCentavos(item.remainingCentavos)} · {item.daysOld} days
						</span>
					</span>
				</Link>
			);
		}
		case "budget-warning": {
			const pctRounded = Math.round(item.pct * 100);
			return (
				<Link to="/budget" className="flex items-center gap-3 hover:opacity-80">
					<AlertTriangle className="size-4 text-warning" aria-hidden="true" />
					<span className="flex-1 text-sm">
						<span className="font-medium font-mono">{item.tagName}</span>
						<span className="text-base-content/60">
							{" "}
							at {pctRounded}% · {item.daysLeftInMonth} days left
						</span>
					</span>
				</Link>
			);
		}
	}
}

export function UpcomingCard({ items, isLoading }: Props) {
	return (
		<section className="card bg-base-100 shadow-sm">
			<div className="card-body gap-3">
				<h3 className="card-title text-lg">Upcoming</h3>
				{isLoading && items.length === 0 ? (
					<>
						<div className="skeleton h-4 w-full" />
						<div className="skeleton h-4 w-full" />
						<div className="skeleton h-4 w-full" />
					</>
				) : items.length === 0 ? (
					<p className="text-base-content/70">You're all caught up 🎉</p>
				) : (
					<div className="flex flex-col gap-2">
						{items.map((item) => (
							<ItemRow
								key={item.kind === "budget-warning" ? `w-${item.tagId}` : `${item.kind}-${item.id}`}
								item={item}
							/>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
