import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Timestamp } from "spacetimedb";
import { useAccounts, useSubAccountActions, useSubAccounts } from "../hooks";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { formatPesos, toAmountString, toCentavos } from "../utils/currency";
import { toISODate } from "../utils/date";
import { openAsModal } from "../utils/dialog";
import { CurrencyInput } from "./CurrencyInput";
import { DateInput } from "./DateInput";
import { Input } from "./Input";
import { SubmitButton } from "./SubmitButton";

interface SubAccountFormValues {
	name: string;
	initialBalance: string;
	remainingAvailable: string;
	subAccountType: string;
	creditLimit: string;
	interestRate: string;
	maturityDate: string;
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
	balanceCentavos: bigint;
	interestRateBps?: number;
	maturityDate?: Date;
}

interface SubAccountModalProps {
	/** When omitted, the modal renders an account selector to choose one */
	accountId?: bigint;
	accountName?: string;
	isStandalone?: boolean;
	existingBalanceCentavos?: bigint;
	/** When `accountId` is omitted, pre-selects this account in the selector */
	defaultAccountId?: bigint;
	onClose: () => void;
	subAccount?: SubAccountData;
}

export function SubAccountModal({
	accountId: providedAccountId,
	accountName: providedAccountName,
	isStandalone: providedIsStandalone,
	existingBalanceCentavos: providedExistingBalance,
	defaultAccountId,
	onClose,
	subAccount,
}: SubAccountModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	const {
		add: addSubAccount,
		convertAndCreate: convertAndCreateSubAccount,
		edit: editSubAccountReducer,
		createTimeDeposit,
		editTimeDepositMetadata,
	} = useSubAccountActions();
	const isEditMode = !!subAccount;

	const { accounts } = useAccounts();
	const { subAccounts: allSubAccounts } = useSubAccounts();

	const showAccountSelector = providedAccountId === undefined;
	const [selectedAccountId, setSelectedAccountId] = useState<bigint | null>(
		providedAccountId ?? defaultAccountId ?? null,
	);

	const effectiveAccountId = providedAccountId ?? selectedAccountId ?? 0n;
	const effectiveAccount = accounts.find((a) => a.id === effectiveAccountId);
	const effectiveAccountName = providedAccountName ?? effectiveAccount?.name ?? "";
	const effectiveIsStandalone = providedIsStandalone ?? effectiveAccount?.isStandalone ?? false;
	const defaultSub =
		effectiveIsStandalone && effectiveAccountId !== 0n
			? allSubAccounts.find((sa) => sa.accountId === effectiveAccountId && sa.isDefault)
			: undefined;
	const effectiveExistingBalance = providedExistingBalance ?? defaultSub?.balanceCentavos ?? 0n;

	const showConversionSection =
		effectiveIsStandalone && !isEditMode && effectiveExistingBalance > 0n;

	const {
		register,
		handleSubmit,
		watch,
		reset,
		getValues,
		trigger,
		formState: { errors, isSubmitting },
	} = useForm<SubAccountFormValues & ConversionFormValues>({
		defaultValues: subAccount
			? {
					name: subAccount.name,
					initialBalance: "",
					remainingAvailable:
						subAccount.subAccountType === "credit"
							? toAmountString(subAccount.creditLimitCentavos - subAccount.balanceCentavos)
							: "",
					subAccountType: subAccount.subAccountType,
					creditLimit: toAmountString(subAccount.creditLimitCentavos),
					existingName: "Main",
					existingSubAccountType: "wallet",
					interestRate:
						subAccount.interestRateBps != null ? (subAccount.interestRateBps / 100).toFixed(2) : "",
					maturityDate: subAccount.maturityDate ? toISODate(subAccount.maturityDate) : "",
				}
			: {
					name: "",
					initialBalance: "",
					remainingAvailable: "",
					subAccountType: "wallet",
					creditLimit: "",
					existingName: "Main",
					existingSubAccountType: "wallet",
					interestRate: "",
					maturityDate: "",
				},
	});

	useEffect(() => {
		openAsModal(ref.current);
	}, []);

	const nameValue = watch("name");
	const selectedType = watch("subAccountType");
	const creditLimitValue = watch("creditLimit");
	useEffect(() => {
		if (selectedType === "credit" && creditLimitValue) {
			void trigger("remainingAvailable");
		}
	}, [creditLimitValue, selectedType, trigger]);

	const onSubmit = async (data: SubAccountFormValues & ConversionFormValues) => {
		if (effectiveAccountId === 0n) {
			setFormError("Please select an account first.");
			return;
		}
		setFormError(null);
		const creditLimitCentavos =
			data.subAccountType === "credit" && data.creditLimit ? toCentavos(data.creditLimit) : 0n;

		try {
			if (isEditMode && subAccount) {
				if (subAccount.subAccountType === "time-deposit") {
					// interestRate is in percent and rateBps is basis points (1 bp = 0.01%),
					// so `* 100` here is percent→bps, not peso→centavo. Do not use toCentavos.
					const rateBps = data.interestRate ? Math.round(parseFloat(data.interestRate) * 100) : 0;
					await editTimeDepositMetadata({
						subAccountId: subAccount.id,
						interestRateBps: rateBps,
						maturityDate: Timestamp.fromDate(new Date(data.maturityDate)),
					});
				} else {
					const remainingCentavos = data.remainingAvailable
						? toCentavos(data.remainingAvailable)
						: creditLimitCentavos;
					const newBalanceCentavos = creditLimitCentavos - remainingCentavos;
					await editSubAccountReducer({
						subAccountId: subAccount.id,
						newName: data.name.trim(),
						newCreditLimitCentavos: creditLimitCentavos,
						newBalanceCentavos,
					});
				}
			} else if (data.subAccountType === "time-deposit" && !effectiveIsStandalone) {
				const initialCentavos = data.initialBalance ? toCentavos(data.initialBalance) : 0n;
				// interestRate is in percent and rateBps is basis points (1 bp = 0.01%),
				// so `* 100` here is percent→bps, not peso→centavo. Do not use toCentavos.
				const rateBps = data.interestRate ? Math.round(parseFloat(data.interestRate) * 100) : 0;
				await createTimeDeposit({
					accountId: effectiveAccountId,
					name: data.name.trim(),
					initialBalanceCentavos: initialCentavos,
					interestRateBps: rateBps,
					maturityDate: Timestamp.fromDate(new Date(data.maturityDate)),
				});
			} else if (effectiveIsStandalone) {
				const initialCentavos = data.initialBalance ? toCentavos(data.initialBalance) : 0n;
				const remainingCentavos =
					data.subAccountType === "credit" && data.remainingAvailable
						? toCentavos(data.remainingAvailable)
						: creditLimitCentavos;
				const newSubAccountInitialBalanceCentavos =
					data.subAccountType === "credit"
						? creditLimitCentavos - remainingCentavos
						: initialCentavos;
				await convertAndCreateSubAccount({
					accountId: effectiveAccountId,
					newName: data.name.trim(),
					newSubAccountType: data.subAccountType,
					newCreditLimitCentavos: creditLimitCentavos,
					newSubAccountInitialBalanceCentavos,
					existingName: data.existingName.trim() || "Main",
					existingSubAccountType: data.existingSubAccountType || "wallet",
				});
			} else {
				const initialCentavos = data.initialBalance ? toCentavos(data.initialBalance) : 0n;
				const remainingCentavos =
					data.subAccountType === "credit" && data.remainingAvailable
						? toCentavos(data.remainingAvailable)
						: creditLimitCentavos;
				const initialBalanceCentavos =
					data.subAccountType === "credit"
						? creditLimitCentavos - remainingCentavos
						: initialCentavos;
				await addSubAccount({
					accountId: effectiveAccountId,
					name: data.name.trim(),
					initialBalanceCentavos,
					subAccountType: data.subAccountType,
					creditLimitCentavos,
				});
			}
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
							{showAccountSelector && (
								<div className="form-control">
									<label className="label" htmlFor="sa-account">
										<span className="label-text">Account</span>
									</label>
									<select
										id="sa-account"
										className="select select-bordered w-full"
										value={selectedAccountId?.toString() ?? ""}
										onChange={(e) =>
											setSelectedAccountId(e.target.value ? BigInt(e.target.value) : null)
										}
									>
										<option value="">Select an account</option>
										{accounts.map((a) => (
											<option key={a.id.toString()} value={a.id.toString()}>
												{a.name}
											</option>
										))}
									</select>
								</div>
							)}
							<Input
								label="Sub-account name"
								id="sub-account-name"
								error={errors.name?.message}
								placeholder="e.g. Ewallet, Savings, Time deposit"
								autoFocus={!(isEditMode && subAccount?.subAccountType === "time-deposit")}
								disabled={isEditMode && subAccount?.subAccountType === "time-deposit"}
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
								<CurrencyInput
									label="Credit limit (P)"
									id="creditLimit"
									min="0"
									placeholder="e.g. 120000.00"
									error={errors.creditLimit?.message}
									{...register("creditLimit", {
										required: selectedType === "credit" ? "Credit limit is required" : false,
										min: { value: 0, message: "Credit limit must be 0 or more" },
									})}
								/>
							)}

							{selectedType === "time-deposit" && (
								<>
									<Input
										label="Annual interest rate (%)"
										id="interest-rate"
										type="number"
										step="0.01"
										min="0"
										max="100"
										placeholder="e.g. 6.00"
										error={errors.interestRate?.message}
										{...register("interestRate", {
											required:
												selectedType === "time-deposit" ? "Interest rate is required" : false,
											min: { value: 0.01, message: "Rate must be greater than 0" },
											max: { value: 100, message: "Rate must be 100 or less" },
										})}
									/>
									<DateInput
										label="Maturity date"
										id="maturity-date"
										error={errors.maturityDate?.message}
										{...register("maturityDate", {
											required:
												selectedType === "time-deposit" ? "Maturity date is required" : false,
										})}
									/>
								</>
							)}

							{!isEditMode && selectedType !== "credit" && (
								<CurrencyInput
									label="Initial balance (P)"
									id="sub-account-balance"
									min="0"
									{...register("initialBalance")}
								/>
							)}

							{selectedType === "credit" && (
								<CurrencyInput
									label="Remaining available (P)"
									id="remaining-available"
									min="0"
									placeholder="e.g. 113800.00"
									error={errors.remainingAvailable?.message}
									{...register("remainingAvailable", {
										validate: (val) => {
											if (!val) return true;
											const remaining = parseFloat(val);
											if (!Number.isFinite(remaining)) return "Enter a valid amount";
											const limit = parseFloat(getValues("creditLimit") || "0");
											if (remaining < 0) return "Remaining cannot be negative";
											if (remaining > limit) return "Remaining cannot exceed credit limit";
											return true;
										},
									})}
								/>
							)}

							{showConversionSection && (
								<>
									<hr className="border-base-300" />
									<div className="flex flex-col gap-3">
										<p className="text-sm text-base-content/60">
											<span className="font-medium text-base-content">
												{effectiveAccountName}'s existing balance
											</span>{" "}
											(<span className="font-mono">{formatPesos(effectiveExistingBalance)}</span>)
											will be moved to a sub-account. What should it be called?
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
							label={
								isEditMode
									? `Update ${nameValue.trim() || "sub-account"}`
									: `Save ${nameValue.trim() || "sub-account"}`
							}
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
