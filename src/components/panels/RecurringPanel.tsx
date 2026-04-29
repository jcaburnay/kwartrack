import { useMemo } from "react";
import { useRecurrings } from "../../hooks/useRecurrings";
import { useAuth } from "../../providers/AuthProvider";
import { formatCentavos } from "../../utils/currency";

type Props = { onSeeAll: () => void };

function daysUntil(dateStr: string, tz: string): number {
	const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: tz }));
	const target = new Date(dateStr.slice(0, 10));
	return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function RecurringPanel({ onSeeAll }: Props) {
	const { recurrings, isLoading } = useRecurrings();
	const { profile } = useAuth();
	const tz = profile?.timezone ?? "Asia/Manila";

	const upcoming = useMemo(() => {
		return recurrings
			.filter((r) => !r.is_paused && r.next_occurrence_at)
			.sort(
				(a, b) =>
					new Date(a.next_occurrence_at!).getTime() - new Date(b.next_occurrence_at!).getTime(),
			)
			.slice(0, 5);
	}, [recurrings]);

	return (
		<div className="card bg-base-100 h-full flex flex-col">
			<div className="card-body gap-4 flex-1">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold tracking-wide text-base-content/60 uppercase">
						Recurring
					</h2>
					<button type="button" className="text-xs text-primary hover:underline" onClick={onSeeAll}>
						See all →
					</button>
				</div>

				{isLoading ? (
					<div className="flex justify-center py-4">
						<span className="loading loading-spinner loading-sm text-primary" />
					</div>
				) : upcoming.length === 0 ? (
					<p className="text-sm text-base-content/50">No upcoming recurrings</p>
				) : (
					<div className="space-y-2">
						{upcoming.map((r) => {
							const days = r.next_occurrence_at ? daysUntil(r.next_occurrence_at, tz) : null;
							return (
								<div key={r.id} className="flex items-center justify-between py-0.5">
									<div className="min-w-0">
										<p className="text-sm truncate">{r.service}</p>
										<p className="text-xs text-base-content/40">
											{days === null
												? "—"
												: days === 0
													? "today"
													: days === 1
														? "tomorrow"
														: `in ${days} days`}
										</p>
									</div>
									<span className="text-sm tabular-nums ml-4 text-base-content/80">
										{formatCentavos(r.amount_centavos)}
									</span>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
