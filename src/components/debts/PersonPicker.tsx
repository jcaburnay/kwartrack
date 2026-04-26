import { useMemo, useState } from "react";
import type { Person } from "../../hooks/usePersons";
import { NewPersonModal } from "./NewPersonModal";

type Props = {
	persons: readonly Person[];
	value: string | null;
	onChange: (personId: string | null) => void;
	onCreate: (name: string) => Promise<Person | null>;
};

export function PersonPicker({ persons, value, onChange, onCreate }: Props) {
	const [query, setQuery] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [createSeed, setCreateSeed] = useState("");

	const selected = persons.find((p) => p.id === value) ?? null;

	const matches = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return persons;
		return persons.filter((p) => p.name.toLowerCase().includes(q));
	}, [persons, query]);

	const exact = matches.some((p) => p.name.toLowerCase() === query.trim().toLowerCase());

	return (
		<div className="form-control">
			<div className="label">
				<span className="label-text">Counter-party</span>
			</div>
			{selected ? (
				<div className="flex items-center gap-2">
					<span className="badge badge-primary">{selected.name}</span>
					<button
						type="button"
						className="btn btn-ghost btn-xs"
						onClick={() => {
							onChange(null);
							setQuery("");
						}}
					>
						Change
					</button>
				</div>
			) : (
				<>
					<input
						type="text"
						role="combobox"
						aria-expanded="true"
						className="input input-bordered"
						placeholder="Search or add…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					<ul className="menu bg-base-200 rounded-box mt-1 max-h-48 overflow-y-auto">
						{matches.map((p) => (
							<li key={p.id}>
								<button
									type="button"
									onClick={() => {
										onChange(p.id);
										setQuery("");
									}}
								>
									{p.name}
								</button>
							</li>
						))}
						{query.trim().length > 0 && !exact && (
							<li>
								<button
									type="button"
									className="text-primary"
									onClick={() => {
										setCreateSeed(query.trim());
										setShowCreate(true);
									}}
								>
									+ New person "{query.trim()}"
								</button>
							</li>
						)}
					</ul>
				</>
			)}
			{showCreate && (
				<NewPersonModal
					initialName={createSeed}
					create={onCreate}
					onCreated={(p) => {
						setShowCreate(false);
						setQuery("");
						onChange(p.id);
					}}
					onCancel={() => setShowCreate(false)}
				/>
			)}
		</div>
	);
}
