import { useEffect, useRef } from "react";

interface DeleteConfirmModalProps {
	title: string;
	body: string;
	confirmLabel: string;
	dismissLabel: string;
	onConfirm: () => void;
	onDismiss: () => void;
}

export function DeleteConfirmModal({
	title,
	body,
	confirmLabel,
	dismissLabel,
	onConfirm,
	onDismiss,
}: DeleteConfirmModalProps) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		ref.current?.showModal();
	}, []);

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onDismiss}>
			<div className="modal-box flex flex-col">
				<h3 className="text-lg font-semibold mb-2">{title}</h3>
				<p className="text-sm text-base-content/60 mb-4">{body}</p>
				{/* D-09: Dismiss left, Confirm/Delete right */}
				<div className="flex gap-2 mt-4">
					<button type="button" className="btn btn-ghost flex-1" onClick={onDismiss}>
						{dismissLabel}
					</button>
					<button type="button" className="btn btn-error flex-1" onClick={onConfirm}>
						{confirmLabel}
					</button>
				</div>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="button" aria-label="Close modal" onClick={onDismiss} />
			</form>
		</dialog>
	);
}
