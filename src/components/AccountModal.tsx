import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useReducer } from "spacetimedb/react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers } from "../module_bindings";
import { openAsModal } from "../utils/dialog";
import { Input } from "./Input";

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
		openAsModal(ref.current);
	}, []);

	const nameValue = watch("name");
	const balanceValue = watch("initialBalance");
	const showStandaloneHint = parseFloat(balanceValue) > 0;

	const onSubmit = (data: AccountFormValues) => {
		const centavos = data.initialBalance
			? BigInt(Math.round(parseFloat(data.initialBalance) * 100))
			: 0n;
		createAccount({
			name: data.name.trim(),
			initialBalanceCentavos: centavos,
			iconBankId: undefined,
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
							<Input
								label="Account name"
								id="account-name"
								error={errors.name?.message}
								placeholder="e.g. Maya, GCash, RCBC"
								autoFocus
								autoComplete="off"
								{...register("name", { required: "Account name is required" })}
							/>

							{/* Initial balance */}
							<Input
								label="Initial balance (P)"
								id="account-balance"
								type="number"
								step="0.01"
								min="0"
								placeholder="0.00"
								hint={
									showStandaloneHint ? (
										<p className="text-xs text-base-content/60 mt-1">
											Initial balance set — this will be a standalone account
										</p>
									) : undefined
								}
								{...register("initialBalance")}
							/>
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
