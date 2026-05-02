import type React from "react";
import { useState } from "react";
import type { Person } from "../../hooks/usePersons";
import type { Tag } from "../../hooks/useTags";
import type { Account } from "../../utils/accountBalances";
import { pesosToCentavos } from "../../utils/currency";
import { type DebtInput, validateDebt } from "../../utils/debtValidation";
import { Modal } from "../ui/Modal";
import { PersonPicker } from "./PersonPicker";

type Props = {
	persons: readonly Person[];
	accounts: readonly Account[];
	tags: readonly Tag[];
	createPerson: (name: string) => Promise<Person | null>;
	createDebt: (input: DebtInput) => Promise<{ error: string | null }>;
	onSaved: () => void;
	onCancel: () => void;
};

export function NewDebtModal({
	persons,
	accounts,
	tags,
	createPerson,
	createDebt,
	onSaved,
	onCancel,
}: Props) {
	const [personId, setPersonId] = useState<string | null>(null);
	const [direction, setDirection] = useState<"loaned" | "owed">("loaned");
	const [amountPesos, setAmountPesos] = useState<number>(0);
	const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
	const [description, setDescription] = useState("");
	const [paidAccountId, setPaidAccountId] = useState<string | null>(null);
	const [tagId, setTagId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const accountLabel = direction === "loaned" ? "Paid from (optional)" : "Paid to (optional)";
	const pickableAccounts = accounts.filter((a) => !a.is_archived);
	const pickableTags = tags.filter(
		(t) => !t.is_system && (t.type === "expense" || t.type === "income"),
	);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		e.stopPropagation();
		const input: DebtInput = {
			personId,
			direction,
			amountCentavos: pesosToCentavos(amountPesos),
			date,
			description: description.trim(),
			paidAccountId,
			tagId,
		};
		const v = validateDebt(input);
		if (!v.ok) return setError(v.message);
		setError(null);
		setIsSubmitting(true);
		const result = await createDebt(input);
		setIsSubmitting(false);
		if (result.error) return setError(result.error);
		onSaved();
	}

	return (
		<Modal onClose={onCancel} size="md">
			<Modal.Header title="New debt" />
			<form onSubmit={handleSubmit} className="flex flex-col gap-3">
				<PersonPicker
					persons={persons}
					value={personId}
					onChange={setPersonId}
					onCreate={createPerson}
				/>

				<div role="toolbar" aria-label="Direction" className="join w-full">
					{(
						[
							{ value: "loaned", label: "They owe me", activeClass: "btn-success" },
							{ value: "owed", label: "I owe them", activeClass: "btn-error" },
						] as const
					).map((opt) => {
						const active = direction === opt.value;
						return (
							<button
								key={opt.value}
								type="button"
								aria-pressed={active}
								className={`btn join-item flex-1 border border-base-content/40 ${active ? opt.activeClass : "btn-ghost"}`}
								onClick={() => setDirection(opt.value)}
							>
								{opt.label}
							</button>
						);
					})}
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<label className="floating-label">
						<span>Amount (₱)</span>
						<input
							type="number"
							step="0.01"
							min="0.01"
							placeholder="0.00"
							className="input input-bordered w-full"
							value={amountPesos}
							onChange={(e) => setAmountPesos(Number(e.target.value))}
						/>
					</label>

					<label className="floating-label">
						<span>Date</span>
						<input
							type="date"
							className="input input-bordered w-full"
							value={date}
							onChange={(e) => setDate(e.target.value)}
						/>
					</label>
				</div>

				<label className="floating-label">
					<span>{accountLabel}</span>
					<select
						className="select select-bordered w-full"
						value={paidAccountId ?? ""}
						onChange={(e) => setPaidAccountId(e.target.value || null)}
					>
						<option value="">Data-only (no tracked account)</option>
						{pickableAccounts.map((a) => (
							<option key={a.id} value={a.id}>
								{a.name}
							</option>
						))}
					</select>
				</label>

				{paidAccountId && (
					<label className="floating-label">
						<span>Tag (required)</span>
						<select
							className="select select-bordered w-full"
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
				)}

				<label className="floating-label">
					<span>Description (optional)</span>
					<input
						type="text"
						placeholder="Description (optional)"
						className="input input-bordered w-full"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
				</label>

				{error && <div className="alert alert-error text-sm">{error}</div>}

				<div className="-mx-4 px-4 py-3 mt-4 border-t border-base-300 flex items-center justify-end gap-2">
					<button type="button" className="btn btn-ghost" onClick={onCancel}>
						Cancel
					</button>
					<button type="submit" className="btn btn-primary" disabled={isSubmitting}>
						{isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Create"}
					</button>
				</div>
			</form>
		</Modal>
	);
}
