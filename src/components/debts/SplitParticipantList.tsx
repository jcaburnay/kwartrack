import { X } from "lucide-react";
import type { Person } from "../../hooks/usePersons";
import { formatCentavos } from "../../utils/currency";
import type { SplitMethod } from "../../utils/splitMath";
import { PersonPicker } from "./PersonPicker";

export type ParticipantRow = {
	personId: string;
	personName: string;
	input: number | null;
	shareCentavos: number;
};

type Props = {
	method: SplitMethod;
	totalCentavos: number;
	rows: ParticipantRow[];
	persons: readonly Person[];
	createPerson: (name: string) => Promise<Person | null>;
	onAddPerson: (person: { id: string; name: string }) => void;
	onRemove: (personId: string) => void;
	onInputChange: (personId: string, input: number | null) => void;
};

export function SplitParticipantList({
	method,
	totalCentavos,
	rows,
	persons,
	createPerson,
	onAddPerson,
	onRemove,
	onInputChange,
}: Props) {
	const summed = rows.reduce((a, r) => a + r.shareCentavos, 0);
	const userShare = totalCentavos - summed;
	const showInput = method !== "equal";
	const inputLabel =
		method === "exact"
			? "₱"
			: method === "percentage"
				? "%"
				: method === "shares"
					? "shares"
					: "";

	return (
		<div className="form-control">
			<div className="label">
				<span className="label-text">Participants</span>
				<span className="label-text-alt">
					Σ shares: {formatCentavos(summed)} · Your share: {formatCentavos(userShare)}
				</span>
			</div>
			<ul className="flex flex-col gap-2">
				<li className="flex items-center gap-2 px-2 py-1 rounded bg-base-200 text-sm">
					<span className="badge badge-ghost">You</span>
					<span className="ml-auto font-mono text-xs">{formatCentavos(userShare)}</span>
				</li>
				{rows.map((r) => (
					<li key={r.personId} className="flex items-center gap-2">
						<span className="badge">{r.personName}</span>
						{showInput && (
							<input
								type="number"
								className="input input-sm input-bordered w-24"
								aria-label={`Share for ${r.personName} (${inputLabel})`}
								value={r.input ?? ""}
								onChange={(e) => {
									const v = e.target.value === "" ? null : Number(e.target.value);
									onInputChange(r.personId, v);
								}}
							/>
						)}
						<span className="ml-auto font-mono text-xs">
							{formatCentavos(r.shareCentavos)}
						</span>
						<button
							type="button"
							className="btn btn-ghost btn-xs"
							aria-label={`Remove ${r.personName}`}
							onClick={() => onRemove(r.personId)}
						>
							<X className="w-3.5 h-3.5" />
						</button>
					</li>
				))}
			</ul>
			<div className="mt-2">
				<PersonPicker
					persons={persons.filter((p) => !rows.some((r) => r.personId === p.id))}
					value={null}
					onChange={(personId) => {
						if (!personId) return;
						const p = persons.find((x) => x.id === personId);
						if (p) onAddPerson({ id: p.id, name: p.name });
					}}
					onCreate={async (name) => {
						const created = await createPerson(name);
						if (created) onAddPerson({ id: created.id, name: created.name });
						return created;
					}}
				/>
			</div>
		</div>
	);
}
