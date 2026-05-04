import type React from "react";
import { useState } from "react";
import type { Account } from "../../utils/accountBalances";
import { centavosToPesos, formatCentavos, pesosToCentavos } from "../../utils/currency";
import { Modal } from "../ui/Modal";
import { SubmitButton } from "../ui/SubmitButton";

type Props = {
	personName: string;
	direction: "loaned" | "owed";
	amountCentavos: number;
	settledCentavos: number;
	suggestedAccountId: string | null;
	accounts: readonly Account[];
	onSubmit: (input: {
		amountCentavos: number;
		paidAccountId: string;
		date: string;
	}) => Promise<{ error: string | null }>;
	onCancel: () => void;
};

export function SettleModal({
	personName,
	direction,
	amountCentavos,
	settledCentavos,
	suggestedAccountId,
	accounts,
	onSubmit,
	onCancel,
}: Props) {
	const remaining = amountCentavos - settledCentavos;
	const [amountPesos, setAmountPesos] = useState<number>(centavosToPesos(remaining));
	const [paidAccountId, setPaidAccountId] = useState<string>(suggestedAccountId ?? "");
	const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const verb = direction === "loaned" ? "owes you" : "you owe";
	const accountLabel = direction === "loaned" ? "Paid to" : "Paid from";

	const subtitle = `${personName} ${verb} ${formatCentavos(amountCentavos)} · ${formatCentavos(settledCentavos)} already settled · ${formatCentavos(remaining)} left`;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		e.stopPropagation();
		const cents = pesosToCentavos(amountPesos);
		if (!Number.isInteger(cents) || cents <= 0) return setError("Enter a valid amount.");
		if (cents > remaining) return setError("Amount exceeds remaining balance.");
		if (!paidAccountId) return setError("Select an account.");
		setError(null);
		setIsSubmitting(true);
		const result = await onSubmit({ amountCentavos: cents, paidAccountId, date });
		setIsSubmitting(false);
		if (result.error) setError(result.error);
	}

	const pickable = accounts.filter((a) => !a.is_archived);

	return (
		<Modal onClose={onCancel} size="md">
			<Modal.Header title="Settle debt" subtitle={subtitle} />
			<form onSubmit={handleSubmit} className="flex flex-col gap-3">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
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
						<button
							type="button"
							className="mt-1 text-xs text-primary hover:underline"
							onClick={() => setAmountPesos(centavosToPesos(remaining))}
						>
							Pay in full
						</button>
					</div>
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
						value={paidAccountId}
						onChange={(e) => setPaidAccountId(e.target.value)}
					>
						<option value="">Select account…</option>
						{pickable.map((a) => (
							<option key={a.id} value={a.id}>
								{a.name}
							</option>
						))}
					</select>
				</label>
				{error && <div className="alert alert-error text-sm">{error}</div>}
				<div className="-mx-4 px-4 py-3 border-t border-base-300 flex items-center justify-end gap-2">
					<button type="button" className="btn btn-ghost" onClick={onCancel}>
						Cancel
					</button>
					<SubmitButton type="submit" className="btn btn-primary" loading={isSubmitting}>
						Record settlement
					</SubmitButton>
				</div>
			</form>
		</Modal>
	);
}
