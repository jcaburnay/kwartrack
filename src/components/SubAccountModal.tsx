import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useReducer } from "spacetimedb/react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers } from "../module_bindings";
import { formatPesos } from "../utils/currency";
import { Input } from "./Input";

interface SubAccountFormValues {
	name: string;
	initialBalance: string;
	subAccountType: string;
	creditLimit: string;
}

interface ConversionFormValues {
	existingName: string;
	existingSubAccountType: string;
}

interface SubAccountData {
	id: bigint;
	name: string;
	subAccountType: string;
	creditLimitCentavos: bigint;
}

interface SubAccountModalProps {
	accountId: bigint;
	accountName: string;
	isStandalone: boolean;
	existingBalanceCentavos: bigint;
	onClose: () => void;
	subAccount?: SubAccountData;
}

export function SubAccountModal({
	accountId,
	accountName,
	isStandalone,
	existingBalanceCentavos,
	onClose,
	subAccount,
}: SubAccountModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	const addSubAccount = useReducer(reducers.addSubAccount);
	const convertAndCreateSubAccount = useReducer(reducers.convertAndCreateSubAccount);
	const editSubAccountReducer = useReducer(reducers.editSubAccount);
	const isEditMode = !!subAccount;

	const showConversionSection = isStandalone && !isEditMode && existingBalanceCentavos > 0n;

	const {
		register,
		handleSubmit,
		watch,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<SubAccountFormValues & ConversionFormValues>({
		defaultValues: subAccount
			? {
					name: subAccount.name,
					initialBalance: "",
					subAccountType: subAccount.subAccountType,
					creditLimit: (Number(subAccount.creditLimitCentavos) / 100).toFixed(2),
					existingName: "Main",
					existingSubAccountType: "wallet",
				}
			: {
					name: "",
					initialBalance: "",
					subAccountType: "wallet",
					creditLimit: "",
					existingName: "Main",
					existingSubAccountType: "wallet",
				},
	});

	useEffect(() => {
		ref.current?.showModal();
	}, []);

	const nameValue = watch("name");
	const selectedType = watch("subAccountType");

	const onSubmit = (data: SubAccountFormValues & ConversionFormValues) => {
		if (isEditMode && subAccount) {
			const creditLimitCentavos = data.creditLimit
				? BigInt(Math.round(parseFloat(data.creditLimit) * 100))
				: 0n;
			editSubAccountReducer({
				subAccountId: subAccount.id,
				newName: data.name.trim(),
				newCreditLimitCentavos: creditLimitCentavos,
			});
		} else if (isStandalone) {
			const newCreditLimitCentavos =
				data.subAccountType === "credit" && data.creditLimit
					? BigInt(Math.round(parseFloat(data.creditLimit) * 100))
					: 0n;
			convertAndCreateSubAccount({
				accountId,
				newName: data.name.trim(),
				newSubAccountType: data.subAccountType,
				newCreditLimitCentavos,
				existingName: data.existingName.trim() || "Main",
				existingSubAccountType: data.existingSubAccountType || "wallet",
			});
		} else {
			const initialCentavos = data.initialBalance
				? BigInt(Math.round(parseFloat(data.initialBalance) * 100))
				: 0n;
			const creditLimitCentavos =
				data.subAccountType === "credit" && data.creditLimit
					? BigInt(Math.round(parseFloat(data.creditLimit) * 100))
					: 0n;
			addSubAccount({
				accountId,
				name: data.name.trim(),
				initialBalanceCentavos: data.subAccountType === "credit" ? 0n : initialCentavos,
				subAccountType: data.subAccountType,
				creditLimitCentavos,
			});
		}
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
					<h3 className="text-lg font-semibold">
						{isEditMode ? "Edit sub-account" : "New sub-account"}
					</h3>
					<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
						<X size={16} />
					</button>
				</div>
				<form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col flex-1 min-h-0">
					<div className="flex-1 overflow-y-auto">
						<div className="flex flex-col gap-4">
							<Input
								label="Sub-account name"
								id="sub-account-name"
								error={errors.name?.message}
								placeholder="e.g. Ewallet, Savings, Time deposit"
								autoFocus
								{...register("name", { required: "Sub-account name is required" })}
							/>

							<div className="form-control">
								<label className="label" htmlFor="subAccountType">
									<span className="label-text">Sub-account type</span>
								</label>
								<select
									id="subAccountType"
									className="select select-bordered w-full"
									{...register("subAccountType")}
									disabled={isEditMode}
								>
									<option value="wallet">Wallet</option>
									<option value="savings">Savings</option>
									<option value="time-deposit">Time Deposit</option>
									<option value="credit">Credit</option>
								</select>
							</div>

							{selectedType === "credit" && (
								<Input
									label="Credit limit (P)"
									id="creditLimit"
									type="number"
									step="0.01"
									min="0"
									placeholder="e.g. 120000.00"
									error={errors.creditLimit?.message}
									{...register("creditLimit", {
										required: selectedType === "credit" ? "Credit limit is required" : false,
										min: { value: 0, message: "Credit limit must be 0 or more" },
									})}
								/>
							)}

							{!isEditMode && !isStandalone && (
								<Input
									label="Initial balance (P)"
									id="sub-account-balance"
									type="number"
									step="0.01"
									min="0"
									placeholder="0.00"
									{...register("initialBalance")}
								/>
							)}

							{showConversionSection && (
								<>
									<hr className="border-base-300" />
									<div className="flex flex-col gap-3">
										<p className="text-sm text-base-content/60">
											<span className="font-medium text-base-content">
												{accountName}'s existing balance
											</span>{" "}
											({formatPesos(existingBalanceCentavos)}) will be moved to a sub-account. What
											should it be called?
										</p>
										<div className="flex gap-2">
											<div className="flex-1">
												<Input
													label="Name"
													id="existing-name"
													placeholder="Main"
													{...register("existingName")}
												/>
											</div>
											<div className="form-control">
												<label className="label" htmlFor="existingSubAccountType">
													<span className="label-text">Type</span>
												</label>
												<select
													id="existingSubAccountType"
													className="select select-bordered"
													{...register("existingSubAccountType")}
												>
													<option value="wallet">Wallet</option>
													<option value="savings">Savings</option>
													<option value="time-deposit">Time Deposit</option>
												</select>
											</div>
										</div>
									</div>
								</>
							)}
						</div>
					</div>

					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={handleClose}>
							Cancel
						</button>
						<button type="submit" className="btn btn-primary flex-1" disabled={isSubmitting}>
							{isEditMode
								? `Update ${nameValue.trim() || "sub-account"}`
								: `Save ${nameValue.trim() || "sub-account"}`}
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
