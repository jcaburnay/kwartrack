import type React from "react";
import { useMemo, useState } from "react";
import type { Person } from "../../hooks/usePersons";
import type { Tag } from "../../hooks/useTags";
import type { Account } from "../../utils/accountBalances";
import { pesosToCentavos } from "../../utils/currency";
import { computeShareCentavos, type SplitMethod } from "../../utils/splitMath";
import { type SplitInput, validateSplit } from "../../utils/splitValidation";
import { SplitMethodPicker } from "./SplitMethodPicker";
import { type ParticipantRow, SplitParticipantList } from "./SplitParticipantList";

export type SplitFormDefaults = {
	description: string;
	totalPesos: number;
	date: string;
	paidFromAccountId: string | null;
	tagId: string | null;
	method: SplitMethod;
	rows: ParticipantRow[];
};

type Props = {
	defaults: SplitFormDefaults;
	persons: readonly Person[];
	accounts: readonly Account[];
	tags: readonly Tag[];
	createPerson: (name: string) => Promise<Person | null>;
	submitLabel: string;
	submitError: string | null;
	isSubmitting: boolean;
	onSubmit: (input: SplitInput) => Promise<void> | void;
	onCancel: () => void;
};

export function defaultSplitFormValues(today: string): SplitFormDefaults {
	return {
		description: "",
		totalPesos: 0,
		date: today,
		paidFromAccountId: null,
		tagId: null,
		method: "equal",
		rows: [],
	};
}

export function SplitForm({
	defaults,
	persons,
	accounts,
	tags,
	createPerson,
	submitLabel,
	submitError,
	isSubmitting,
	onSubmit,
	onCancel,
}: Props) {
	const [description, setDescription] = useState(defaults.description);
	const [totalPesos, setTotalPesos] = useState<number>(defaults.totalPesos);
	const [date, setDate] = useState(defaults.date);
	const [paidFromAccountId, setPaidFromAccountId] = useState<string | null>(
		defaults.paidFromAccountId,
	);
	const [tagId, setTagId] = useState<string | null>(defaults.tagId);
	const [method, setMethod] = useState<SplitMethod>(defaults.method);
	const [rows, setRows] = useState<ParticipantRow[]>(defaults.rows);
	const [error, setError] = useState<string | null>(null);

	const totalCentavos = pesosToCentavos(totalPesos || 0);

	// Derive share_centavos from method/total/inputs without storing in state.
	// Avoids the loop where storing computed shares triggers another render.
	// payer is index 0 in computeShareCentavos; spec absorbs remainder on payer.
	const rowsWithShares = useMemo(() => {
		if (rows.length === 0) return rows;
		const inputRows = [{ input: null }, ...rows.map((r) => ({ input: r.input }))];
		const result = computeShareCentavos({ method, totalCentavos, rows: inputRows });
		if (result == null) return rows.map((r) => ({ ...r, shareCentavos: 0 }));
		// result[0] = payer share; rows[i] gets result[i+1].
		return rows.map((r, i) => ({ ...r, shareCentavos: result[i + 1] }));
	}, [rows, method, totalCentavos]);

	const pickableAccounts = accounts.filter((a) => !a.is_archived);
	const pickableTags = tags.filter((t) => !t.is_system && t.type === "expense");

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		e.stopPropagation();
		const input: SplitInput = {
			description: description.trim(),
			totalCentavos,
			date,
			paidFromAccountId,
			tagId,
			method,
			participants: rowsWithShares.map((r) => ({
				personId: r.personId,
				shareCentavos: r.shareCentavos,
				shareInputValue: r.input,
			})),
		};
		const v = validateSplit(input);
		if (!v.ok) return setError(v.message);
		setError(null);
		await onSubmit(input);
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
			<label className="form-control">
				<div className="label">
					<span className="label-text">Description</span>
				</div>
				<input
					autoFocus
					type="text"
					className="input input-bordered"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</label>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<label className="form-control">
					<div className="label">
						<span className="label-text">Total (₱)</span>
					</div>
					<input
						type="number"
						step="0.01"
						min="0.01"
						className="input input-bordered"
						value={totalPesos}
						onChange={(e) => setTotalPesos(Number(e.target.value))}
					/>
				</label>

				<label className="form-control">
					<div className="label">
						<span className="label-text">Date</span>
					</div>
					<input
						type="date"
						className="input input-bordered"
						value={date}
						onChange={(e) => setDate(e.target.value)}
					/>
				</label>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<label className="form-control">
					<div className="label">
						<span className="label-text">Paid from</span>
					</div>
					<select
						className="select select-bordered"
						value={paidFromAccountId ?? ""}
						onChange={(e) => setPaidFromAccountId(e.target.value || null)}
					>
						<option value="">Select…</option>
						{pickableAccounts.map((a) => (
							<option key={a.id} value={a.id}>
								{a.name}
							</option>
						))}
					</select>
				</label>

				<label className="form-control">
					<div className="label">
						<span className="label-text">Tag</span>
					</div>
					<select
						className="select select-bordered"
						value={tagId ?? ""}
						onChange={(e) => setTagId(e.target.value || null)}
					>
						<option value="">Select…</option>
						{pickableTags.map((t) => (
							<option key={t.id} value={t.id}>
								{t.name}
							</option>
						))}
					</select>
				</label>
			</div>

			<SplitMethodPicker method={method} onChange={setMethod} />

			<SplitParticipantList
				method={method}
				totalCentavos={totalCentavos}
				rows={rowsWithShares}
				persons={persons}
				createPerson={createPerson}
				onAddPerson={(p) =>
					setRows((prev) => [
						...prev,
						{ personId: p.id, personName: p.name, input: null, shareCentavos: 0 },
					])
				}
				onRemove={(personId) => setRows((prev) => prev.filter((r) => r.personId !== personId))}
				onInputChange={(personId, input) =>
					setRows((prev) => prev.map((r) => (r.personId === personId ? { ...r, input } : r)))
				}
			/>

			{error && <div className="alert alert-error text-sm">{error}</div>}
			{submitError && <div className="alert alert-error text-sm">{submitError}</div>}
			<div className="-mx-4 px-4 py-3 mt-4 border-t border-base-300 flex items-center justify-end gap-2">
				<button type="button" className="btn btn-ghost" onClick={onCancel}>
					Cancel
				</button>
				<button type="submit" className="btn btn-primary" disabled={isSubmitting}>
					{isSubmitting ? <span className="loading loading-spinner loading-sm" /> : submitLabel}
				</button>
			</div>
		</form>
	);
}
