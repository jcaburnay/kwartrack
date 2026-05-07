import { useState } from "react";
import { Modal } from "../ui/Modal";

type DeleteAccountDialogProps = {
	displayName: string;
	onClose: () => void;
	onConfirm: () => Promise<void>;
};

export function DeleteAccountDialog({ displayName, onClose, onConfirm }: DeleteAccountDialogProps) {
	const [typed, setTyped] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const armed = typed.trim() === displayName.trim() && displayName.trim().length > 0;

	async function handleConfirm() {
		if (!armed || submitting) return;
		setSubmitting(true);
		setError(null);
		try {
			await onConfirm();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not delete account.");
			setSubmitting(false);
		}
	}

	return (
		<Modal onClose={submitting ? () => {} : onClose} size="md">
			<Modal.Header title="Delete account" />
			<Modal.Body>
				<p className="text-sm">
					This permanently deletes your account and <strong>every record you own</strong> —
					accounts, transactions, recurrings, budgets, debts, splits, contacts, and tags. There is
					no grace period and no way to undo.
				</p>
				<p className="text-sm text-base-content/70">
					If you want a backup first, cancel this and run an export from the Data tab.
				</p>
				<div className="flex flex-col gap-1.5">
					<label htmlFor="delete-confirm" className="text-xs font-medium">
						Type <span className="font-mono">{displayName}</span> to confirm
					</label>
					<input
						id="delete-confirm"
						type="text"
						className="input input-bordered input-sm w-full"
						value={typed}
						onChange={(e) => setTyped(e.target.value)}
						autoComplete="off"
						spellCheck={false}
					/>
				</div>
				{error && <p className="text-xs text-error">{error}</p>}
			</Modal.Body>
			<Modal.Footer>
				<button
					type="button"
					className="btn btn-sm btn-ghost"
					onClick={onClose}
					disabled={submitting}
				>
					Cancel
				</button>
				<button
					type="button"
					className="btn btn-sm btn-error"
					disabled={!armed || submitting}
					onClick={handleConfirm}
				>
					{submitting ? "Deleting…" : "Delete account"}
				</button>
			</Modal.Footer>
		</Modal>
	);
}
