import type { Tag } from "../../hooks/useTags";
import { DEFAULT_SPLIT_FILTERS, type SplitFilters } from "../../utils/splitFilters";

type Props = {
	filters: SplitFilters;
	onChange: (f: SplitFilters) => void;
	tags: readonly Tag[];
};

export function SplitsFilterBar({ filters, onChange, tags }: Props) {
	function patch<K extends keyof SplitFilters>(k: K, v: SplitFilters[K]) {
		onChange({ ...filters, [k]: v });
	}
	return (
		<div className="flex flex-wrap gap-2 items-end">
			<input
				type="text"
				className="input input-sm input-bordered"
				placeholder="Search…"
				value={filters.query}
				onChange={(e) => patch("query", e.target.value)}
			/>
			<select
				className="select select-sm select-bordered"
				value={filters.tagId ?? ""}
				onChange={(e) => patch("tagId", e.target.value || null)}
			>
				<option value="">All tags</option>
				{tags
					.filter((t) => !t.is_system)
					.map((t) => (
						<option key={t.id} value={t.id}>
							{t.name}
						</option>
					))}
			</select>
			<select
				className="select select-sm select-bordered"
				value={filters.method ?? ""}
				onChange={(e) =>
					patch("method", (e.target.value || null) as SplitFilters["method"])
				}
			>
				<option value="">All methods</option>
				<option value="equal">Equal</option>
				<option value="exact">Exact</option>
				<option value="percentage">%</option>
				<option value="shares">Shares</option>
			</select>
			<select
				className="select select-sm select-bordered"
				value={filters.progress}
				onChange={(e) => patch("progress", e.target.value as SplitFilters["progress"])}
			>
				<option value="all">All</option>
				<option value="not-settled">Not settled</option>
				<option value="partially-settled">Partially settled</option>
				<option value="fully-settled">Fully settled</option>
			</select>
			<input
				type="date"
				className="input input-sm input-bordered"
				value={filters.dateFrom ?? ""}
				onChange={(e) => patch("dateFrom", e.target.value || null)}
			/>
			<input
				type="date"
				className="input input-sm input-bordered"
				value={filters.dateTo ?? ""}
				onChange={(e) => patch("dateTo", e.target.value || null)}
			/>
			<button
				type="button"
				className="btn btn-ghost btn-sm"
				onClick={() => onChange(DEFAULT_SPLIT_FILTERS)}
			>
				Reset
			</button>
		</div>
	);
}
