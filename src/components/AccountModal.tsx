import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useAccountActions } from "../hooks";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { toCentavos } from "../utils/currency";
import { openAsModal } from "../utils/dialog";
import { CurrencyInput } from "./CurrencyInput";
import { Input } from "./Input";
import { SubmitButton } from "./SubmitButton";

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
	const { create: createAccount } = useAccountActions();

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

	const onSubmit = async (data: AccountFormValues) => {
		setFormError(null);
		const centavos = data.initialBalance ? toCentavos(data.initialBalance) : 0n;
		try {
			await createAccount({
				name: data.name.trim(),
				initialBalanceCentavos: centavos,
				iconBankId: undefined,
			});
			onAccountCreated?.();
			reset();
			onClose();
		} catch (err) {
			setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
		}
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	const [formError, setFormError] = useState<string | null>(null);

	useDragToDismiss(boxRef, handleClose);

	return (
		<dialog ref={ref} className="modal modal-bottom md:modal-middle" onClose={onClose}>
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
							<CurrencyInput
								label="Initial balance (P)"
								id="account-balance"
								min="0"
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

					{formError && (
						<div role="alert" className="alert alert-error text-sm py-2 mt-2">
							<span>{formError}</span>
						</div>
					)}

					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={handleClose}>
							Cancel
						</button>
						<SubmitButton
							isSubmitting={isSubmitting}
							label={`Save ${nameValue.trim() || "account"}`}
						/>
					</div>
				</form>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="submit" aria-label="Close modal" />
			</form>
		</dialog>
	);
}
