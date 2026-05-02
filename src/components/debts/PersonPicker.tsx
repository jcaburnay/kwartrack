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
	const [dismissed, setDismissed] = useState(false);
	const [showCreate, setShowCreate] = useState(false);
	const [createSeed, setCreateSeed] = useState("");

	const selected = persons.find((p) => p.id === value) ?? null;

	const matches = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return persons.filter((p) => p.name.toLowerCase().includes(q));
	}, [persons, query]);

	const exact = matches.some((p) => p.name.toLowerCase() === query.trim().toLowerCase());
	const showDropdown = !dismissed && query.trim().length > 0;

	if (selected) {
		return (
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
		);
	}

	return (
		<>
			<div className="relative">
				<label className="floating-label">
					<span>Counter-party</span>
					<input
						type="text"
						role="combobox"
						aria-expanded={showDropdown}
						placeholder="Search or add…"
						className="input input-bordered w-full"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setDismissed(false);
						}}
						onFocus={() => setDismissed(false)}
						// setTimeout so a click on a suggestion lands before we hide.
						onBlur={() => setTimeout(() => setDismissed(true), 150)}
					/>
				</label>
				{showDropdown && (
					<ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-base-100 border border-base-300 rounded shadow-lg max-h-48 overflow-y-auto">
						{matches.map((p) => (
							<li key={p.id}>
								<button
									type="button"
									className="w-full text-left px-3 py-2 hover:bg-base-200"
									// Prevent input blur on click so the suggestion's onClick fires.
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => {
										onChange(p.id);
										setQuery("");
										setDismissed(true);
									}}
								>
									{p.name}
								</button>
							</li>
						))}
						{!exact && (
							<li>
								<button
									type="button"
									className="w-full text-left px-3 py-2 hover:bg-base-200 text-primary"
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => {
										setCreateSeed(query.trim());
										setShowCreate(true);
										setDismissed(true);
									}}
								>
									+ New person "{query.trim()}"
								</button>
							</li>
						)}
					</ul>
				)}
			</div>
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
		</>
	);
}
