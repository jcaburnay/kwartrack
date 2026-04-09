import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducer } from "spacetimedb/react";
import { type BankEntry, filterBanks, findBank } from "../data/banks";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers } from "../module_bindings";
import { BankIcon } from "./BankIcon";

interface EditAccountModalProps {
	accountId: bigint;
	currentName: string;
	currentBankId: string | null;
	onClose: () => void;
}

export function EditAccountModal({
	accountId,
	currentName,
	currentBankId,
	onClose,
}: EditAccountModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	const renameAccount = useReducer(reducers.renameAccount);
	const updateAccountIcon = useReducer(reducers.updateAccountIcon);

	const [name, setName] = useState(currentName);
	const [query, setQuery] = useState(currentBankId ? (findBank(currentBankId)?.name ?? "") : "");
	const [selectedBankId, setSelectedBankId] = useState<string | null>(currentBankId);
	const [showSuggestions, setShowSuggestions] = useState(false);

	const suggestions = filterBanks(query);

	useEffect(() => {
		ref.current?.showModal();
	}, []);

	useDragToDismiss(boxRef, onClose);

	const handleSelect = (bank: BankEntry) => {
		setSelectedBankId(bank.id);
		setQuery(bank.name);
		setShowSuggestions(false);
	};

	const handleSave = () => {
		const trimmed = name.trim();
		if (trimmed && trimmed !== currentName) {
			renameAccount({ accountId, newName: trimmed });
		}
		if (selectedBankId !== currentBankId) {
			updateAccountIcon({ accountId, iconBankId: selectedBankId ?? undefined });
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
					{/* Name */}
					<div>
						<label className="label" htmlFor="edit-account-name">
							<span className="label-text text-sm">Account name</span>
						</label>
						<input
							id="edit-account-name"
							className="input input-bordered w-full"
							value={name}
							onChange={(e) => setName(e.target.value)}
							autoFocus
						/>
					</div>

					{/* Icon search */}
					<div>
						<label className="label" htmlFor="edit-account-icon">
							<span className="label-text text-sm">Bank / e-wallet icon</span>
						</label>
						<div className="relative">
							<input
								id="edit-account-icon"
								className="input input-bordered w-full"
								placeholder="Search banks..."
								value={query}
								onChange={(e) => {
									setQuery(e.target.value);
									setShowSuggestions(true);
									if (!e.target.value) setSelectedBankId(null);
								}}
								onFocus={() => setShowSuggestions(true)}
								onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
							/>
							{showSuggestions && suggestions.length > 0 && (
								<ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-base-100 border border-base-300/50 rounded-xl shadow-lg overflow-hidden">
									{suggestions.map((bank) => (
										<li key={bank.id}>
											<button
												type="button"
												className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-base-200/60 text-sm"
												onMouseDown={() => handleSelect(bank)}
											>
												<BankIcon bankId={bank.id} name={bank.name} size={20} />
												{bank.name}
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
						{selectedBankId && (
							<button
								type="button"
								className="btn btn-ghost btn-xs text-base-content/50 self-start mt-1"
								onClick={() => {
									setSelectedBankId(null);
									setQuery("");
								}}
							>
								Remove icon
							</button>
						)}
					</div>
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
