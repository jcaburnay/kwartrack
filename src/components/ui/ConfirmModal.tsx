/**
 * ConfirmModal — small modal for "are you sure?" interactions. Built on
 * <Modal> with size="sm". Title is a question, body is description text,
 * footer is right-aligned [Cancel] [Confirm]. Set `destructive` to make the
 * confirm button red (`btn btn-error`).
 */

import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { SubmitButton } from "./SubmitButton";

type Props = {
	title: string;
	description?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
	pending?: boolean;
	error?: string | null;
	onConfirm: () => void;
	onClose: () => void;
};

export function ConfirmModal({
	title,
	description,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	destructive = false,
	pending = false,
	error = null,
	onConfirm,
	onClose,
}: Props) {
	return (
		<Modal onClose={onClose} size="sm">
			<Modal.Header title={title} />
			<Modal.Body>
				{description != null && <p className="text-sm text-base-content/70">{description}</p>}
				{error && (
					<div className="alert alert-error text-sm">
						<span>{error}</span>
					</div>
				)}
			</Modal.Body>
			<Modal.Footer>
				<button type="button" className="btn btn-ghost" onClick={onClose} disabled={pending}>
					{cancelLabel}
				</button>
				<SubmitButton
					type="button"
					className={destructive ? "btn btn-error" : "btn btn-primary"}
					onClick={onConfirm}
					loading={pending}
				>
					{confirmLabel}
				</SubmitButton>
			</Modal.Footer>
		</Modal>
	);
}
