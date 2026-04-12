import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducer } from "spacetimedb/react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers } from "../module_bindings";
import { Input } from "./Input";

interface EditAccountModalProps {
	accountId: bigint;
	currentName: string;
	currentBankId: string | null;
	onClose: () => void;
}

export function EditAccountModal({ accountId, currentName, onClose }: EditAccountModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	const renameAccount = useReducer(reducers.renameAccount);

	const [name, setName] = useState(currentName);

	useEffect(() => {
		ref.current?.showModal();
	}, []);

	useDragToDismiss(boxRef, onClose);

	const handleSave = () => {
		const trimmed = name.trim();
		if (trimmed && trimmed !== currentName) {
			renameAccount({ accountId, newName: trimmed });
		}
		onClose();
	};

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
			<div className="modal-box flex flex-col" ref={boxRef}>
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-semibold">Edit account</h3>
					<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
						<X size={16} />
					</button>
				</div>

				<div className="flex flex-col gap-4">
					<Input
						label="Account name"
						id="edit-account-name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						autoFocus
					/>
				</div>

				<div className="flex gap-2 mt-6">
					<button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
						Cancel
					</button>
					<button
						type="button"
						className="btn btn-primary flex-1"
						disabled={!name.trim()}
						onClick={handleSave}
					>
						Save
					</button>
				</div>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="submit" aria-label="Close modal" />
			</form>
		</dialog>
	);
}
