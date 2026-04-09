import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useReducer } from "spacetimedb/react";
import { type BankEntry, filterBanks } from "../data/banks";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers } from "../module_bindings";
import { BankIcon } from "./BankIcon";

interface AccountFormValues {
	name: string;
	initialBalance: string;
}

interface AccountModalProps {
	onClose: () => void;
	onAccountCreated?: () => void;
}

export function AccountModal({ onClose, onAccountCreated }: AccountModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	const createAccount = useReducer(reducers.createAccount);

	const [iconBankId, setIconBankId] = useState<string | null>(null);
	const [showSuggestions, setShowSuggestions] = useState(false);

	const {
		register,
		handleSubmit,
		watch,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<AccountFormValues>({
		defaultValues: { name: "", initialBalance: "" },
	});

	useEffect(() => {
		ref.current?.showModal();
	}, []);

	const nameValue = watch("name");
	const balanceValue = watch("initialBalance");
	const showStandaloneHint = parseFloat(balanceValue) > 0;
	const suggestions = filterBanks(nameValue);

	const handleSelectBank = (bank: BankEntry) => {
		setIconBankId(bank.id);
		setShowSuggestions(false);
	};

	const onSubmit = (data: AccountFormValues) => {
		const centavos = data.initialBalance
			? BigInt(Math.round(parseFloat(data.initialBalance) * 100))
			: 0n;
		createAccount({
			name: data.name.trim(),
			initialBalanceCentavos: centavos,
			iconBankId: iconBankId ?? undefined,
		});
		onAccountCreated?.();
		reset();
		onClose();
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	useDragToDismiss(boxRef, handleClose);

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
			<div className="modal-box flex flex-col" ref={boxRef}>
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-semibold">New account</h3>
					<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
						<X size={16} />
					</button>
				</div>
				<form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col flex-1 min-h-0">
					<div className="flex-1 overflow-y-auto">
						<div className="flex flex-col gap-4">
							{/* Account name with bank autocomplete */}
							<div>
								<label className="label" htmlFor="account-name">
									<span className="label-text text-sm">Account name</span>
								</label>
								<div className="relative">
									<input
										id="account-name"
										{...register("name", { required: "Account name is required" })}
										className={`input input-bordered w-full${errors.name ? " input-error" : ""}`}
										placeholder="e.g. Maya, GCash, RCBC"
										autoFocus
										autoComplete="off"
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
														onMouseDown={() => handleSelectBank(bank)}
													>
														<BankIcon bankId={bank.id} name={bank.name} size={20} />
														{bank.name}
													</button>
												</li>
											))}
										</ul>
									)}
								</div>
								{errors.name && <p className="text-error text-xs mt-1">{errors.name.message}</p>}
							</div>

							{/* Initial balance */}
							<div>
								<label className="label" htmlFor="account-balance">
									<span className="label-text text-sm">Initial balance (P)</span>
								</label>
								<input
									id="account-balance"
									{...register("initialBalance")}
									type="number"
									step="0.01"
									min="0"
									className="input input-bordered w-full"
									placeholder="0.00"
								/>
								{showStandaloneHint && (
									<p className="text-xs text-base-content/60 mt-1">
										Initial balance set — this will be a standalone account
									</p>
								)}
							</div>
						</div>
					</div>

					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={handleClose}>
							Cancel
						</button>
						<button type="submit" className="btn btn-primary flex-1" disabled={isSubmitting}>
							Save {nameValue.trim() || "account"}
						</button>
					</div>
				</form>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="submit" aria-label="Close modal" />
			</form>
		</dialog>
	);
}
