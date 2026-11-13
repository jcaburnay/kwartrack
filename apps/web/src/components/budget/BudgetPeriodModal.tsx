import { useState } from "react";
import {
	type BudgetDateRange,
	defaultBudgetEnd,
	validateBudgetRange,
} from "../../utils/budgetPeriod";
import { centavosToPesos, pesosToCentavos } from "../../utils/currency";
import { Modal } from "../ui/Modal";
import { SubmitButton } from "../ui/SubmitButton";

type Props = {
	startDate: string;
	period?: BudgetDateRange & { id: string; overall_centavos: number };
	periods: readonly (BudgetDateRange & { id: string })[];
	onSave: (range: BudgetDateRange, cap: number) => Promise<string | null>;
	onCancel: () => void;
};
export function BudgetPeriodModal({ startDate, period, periods, onSave, onCancel }: Props) {
	const [start, setStart] = useState(period?.start_date ?? startDate);
	const [end, setEnd] = useState(period?.end_date ?? defaultBudgetEnd(startDate));
	const [endEdited, setEndEdited] = useState(Boolean(period));
	const [amount, setAmount] = useState(
		period ? String(centavosToPesos(period.overall_centavos)) : "",
	);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	async function save() {
		const range = { start_date: start, end_date: end };
		const validation = validateBudgetRange(range, periods, period?.id);
		if (validation) {
			setError(validation);
			return;
		}
		const cap = pesosToCentavos(Number(amount));
		if (!Number.isFinite(Number(amount)) || Number(amount) < 0 || !Number.isSafeInteger(cap)) {
			setError("Enter a non-negative overall cap.");
			return;
		}
		setError(null);
		setSaving(true);
		try {
			setError(await onSave(range, cap));
		} catch {
			setError("Could not save this budget. Please try again.");
		} finally {
			setSaving(false);
		}
	}
	return (
		<Modal
			onClose={() => {
				if (!saving) onCancel();
			}}
			size="md"
		>
			<Modal.Header title={period ? "Edit budget period" : "Create budget"} />
			<Modal.Body>
				<div className="flex flex-col gap-4">
					<p className="text-sm text-base-content/70">
						Both dates are included. You can leave gaps between budgets.
					</p>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<label className="floating-label">
							<span>Start date</span>
							<input
								aria-label="Start date"
								className="input input-bordered w-full"
								type="date"
								value={start}
								disabled={saving}
								onChange={(e) => {
									setStart(e.target.value);
									if (!endEdited) setEnd(defaultBudgetEnd(e.target.value));
								}}
							/>
						</label>
						<label className="floating-label">
							<span>End date</span>
							<input
								aria-label="End date"
								className="input input-bordered w-full"
								type="date"
								value={end}
								disabled={saving}
								onChange={(e) => {
									setEnd(e.target.value);
									setEndEdited(true);
								}}
							/>
						</label>
					</div>
					<label className="floating-label">
						<span>Overall cap (₱)</span>
						<input
							aria-label="Overall cap (₱)"
							className="input input-bordered w-full"
							type="number"
							min="0"
							step="0.01"
							placeholder="0.00"
							value={amount}
							disabled={saving}
							onChange={(e) => setAmount(e.target.value)}
						/>
					</label>
					{error && (
						<div role="alert" className="alert alert-error text-sm">
							{error}
						</div>
					)}
				</div>
			</Modal.Body>
			<Modal.Footer>
				<button type="button" className="btn btn-ghost" disabled={saving} onClick={onCancel}>
					Cancel
				</button>
				<SubmitButton type="button" className="btn btn-primary" loading={saving} onClick={save}>
					{period ? "Save changes" : "Create budget"}
				</SubmitButton>
			</Modal.Footer>
		</Modal>
	);
}
