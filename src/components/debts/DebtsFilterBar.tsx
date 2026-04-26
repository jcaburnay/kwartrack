import type { Person } from "../../hooks/usePersons";
import type { Tag } from "../../hooks/useTags";
import { DEFAULT_DEBT_FILTERS, type DebtFilters } from "../../utils/debtFilters";

type Props = {
	filters: DebtFilters;
	onChange: (f: DebtFilters) => void;
	persons: readonly Person[];
	tags: readonly Tag[];
};

export function DebtsFilterBar({ filters, onChange, persons, tags }: Props) {
	function patch<K extends keyof DebtFilters>(k: K, v: DebtFilters[K]) {
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
				value={filters.direction ?? ""}
				onChange={(e) =>
					patch("direction", (e.target.value || null) as DebtFilters["direction"])
				}
			>
				<option value="">All directions</option>
				<option value="loaned">Loaned (owe me)</option>
				<option value="owed">Owed (I owe)</option>
			</select>
			<select
				className="select select-sm select-bordered"
				value={filters.settled}
				onChange={(e) => patch("settled", e.target.value as DebtFilters["settled"])}
			>
				<option value="all">All</option>
				<option value="unsettled">Unsettled</option>
				<option value="settled">Settled</option>
			</select>
			<select
				className="select select-sm select-bordered"
				value={filters.personId ?? ""}
				onChange={(e) => patch("personId", e.target.value || null)}
			>
				<option value="">All persons</option>
				{persons.map((p) => (
					<option key={p.id} value={p.id}>
						{p.name}
					</option>
				))}
			</select>
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
				onClick={() => onChange(DEFAULT_DEBT_FILTERS)}
			>
				Reset
			</button>
		</div>
	);
}
