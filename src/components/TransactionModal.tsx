import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Timestamp } from "spacetimedb";
import {
	useAccounts,
	useBudget,
	useSubAccounts,
	useTags,
	useTransactionActions,
	useTransactions,
} from "../hooks";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { getCurrentMonthExpenses } from "../utils/budgetCompute";
import { formatPesos, toAmountString, toCentavos } from "../utils/currency";
import { fromTimestamp, todayISO, toISODate } from "../utils/date";
import { openAsModal } from "../utils/dialog";
import { getVisibleTags } from "../utils/tagConfig";
import { CurrencyInput } from "./CurrencyInput";
import { DateInput } from "./DateInput";
import { Input } from "./Input";
import { SubAccountGroupedSelect } from "./SubAccountGroupedSelect";
import { SubmitButton } from "./SubmitButton";

interface Transaction {
	id: bigint;
	type: string;
	amountCentavos: bigint;
	tag: string;
	sourceSubAccountId: bigint;
	destinationSubAccountId: bigint;
	serviceFeeCentavos: bigint;
	description: string;
	date: { microsSinceUnixEpoch: bigint };
}

interface TransactionModalProps {
	onClose: () => void;
	/** When provided, opens in edit mode pre-filled with existing values */
	transaction?: Transaction;
	/** When provided AND not in edit mode, pre-selects this sub-account as source */
	defaultSourceSubAccountId?: bigint;
}

interface TransactionFormValues {
	type: "expense" | "income" | "transfer";
	amount: string;
	tag: string;
	sourceSubAccountId: string;
	destinationSubAccountId: string;
	serviceFee: string;
	description: string;
	date: string;
}

export function TransactionModal({
	onClose,
	transaction,
	defaultSourceSubAccountId,
}: TransactionModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		openAsModal(ref.current);
	}, []);
	const { create: createTransaction, edit: editTransaction } = useTransactionActions();
	const { accounts } = useAccounts();
	const { subAccounts } = useSubAccounts();
	const { config: budgetConfigRows, allocations: budgetAllocations } = useBudget();
	const { transactions: allTransactions } = useTransactions();
	const { tagConfigs } = useTags();

	const expenseTags = getVisibleTags("expense", tagConfigs);
	const incomeTags = getVisibleTags("income", tagConfigs);
	const transferTags = getVisibleTags("transfer", tagConfigs);
	const tagsByType: Record<TransactionFormValues["type"], string[]> = {
		expense: expenseTags,
		income: incomeTags,
		transfer: transferTags,
	};

	const defaultValues: TransactionFormValues = transaction
		? {
				type: transaction.type as "expense" | "income" | "transfer",
				amount: toAmountString(transaction.amountCentavos),
				tag: transaction.tag,
				sourceSubAccountId:
					transaction.sourceSubAccountId !== 0n ? transaction.sourceSubAccountId.toString() : "",
				destinationSubAccountId:
					transaction.destinationSubAccountId !== 0n
						? transaction.destinationSubAccountId.toString()
						: "",
				serviceFee:
					transaction.serviceFeeCentavos !== 0n
						? toAmountString(transaction.serviceFeeCentavos)
						: "",
				description: transaction.description,
				date: toISODate(fromTimestamp(transaction.date)),
			}
		: {
				type: "expense",
				amount: "",
				tag: "",
				sourceSubAccountId: defaultSourceSubAccountId ? defaultSourceSubAccountId.toString() : "",
				destinationSubAccountId: "",
				serviceFee: "",
				description: "",
				date: todayISO(),
			};

	const {
		register,
		handleSubmit,
		watch,
		setValue,
		reset,
		getValues,
		clearErrors,
		formState: { errors, isSubmitting },
	} = useForm<TransactionFormValues>({ defaultValues });

	const selectedType = watch("type");
	const selectedTag = watch("tag");
	const enteredAmount = watch("amount");
	const selectedSourceSubAccountId = watch("sourceSubAccountId");
	const visibleTags = tagsByType[selectedType] ?? [];
	const tagOptions =
		selectedTag && selectedTag !== "transfer" && !visibleTags.includes(selectedTag)
			? [selectedTag, ...visibleTags]
			: visibleTags;

	useEffect(() => {
		if (transaction) return;
		if (selectedType === "transfer") {
			if (!selectedTag || (selectedTag !== "transfer" && !visibleTags.includes(selectedTag))) {
				setValue("tag", "transfer");
			}
			return;
		}
		if (visibleTags.length > 0 && selectedTag !== "" && !visibleTags.includes(selectedTag)) {
			setValue("tag", visibleTags[0]);
		}
	}, [selectedTag, selectedType, setValue, transaction, visibleTags]);

	// Budget hint computation (D-14, D-15, D-16) — expense type only
	let budgetHint: string | null = null;
	let isOverBudget = false;

	if (selectedType === "expense" && selectedTag && budgetConfigRows.length > 0) {
		const budgetConfig = budgetConfigRows[0];
		if (budgetConfig.totalCentavos > 0n) {
			const spentByTag = getCurrentMonthExpenses(allTransactions);
			const allocation = budgetAllocations.find((a) => a.tag === selectedTag);
			const enteredCentavos = toCentavos(enteredAmount || "0");

			if (allocation) {
				const spentCentavos = spentByTag.get(selectedTag) ?? 0n;
				const remainingCentavos = allocation.allocatedCentavos - spentCentavos;

				if (enteredCentavos > remainingCentavos) {
					const overBy = enteredCentavos - remainingCentavos;
					const tagDisplay = selectedTag
						.replace(/-/g, " ")
						.replace(/\b\w/g, (c) => c.toUpperCase());
					budgetHint = `⚠ This will exceed your ${tagDisplay} budget by ${formatPesos(overBy)}`;
					isOverBudget = true;
				} else {
					budgetHint = `Budget remaining: ${formatPesos(remainingCentavos)} of ${formatPesos(allocation.allocatedCentavos)}`;
				}
			} else {
				// Tag has no specific allocation — show unallocated pool
				const allocatedTotal = budgetAllocations.reduce((sum, a) => sum + a.allocatedCentavos, 0n);
				const unallocatedPool = budgetConfig.totalCentavos - allocatedTotal;
				const spentByTagMap = getCurrentMonthExpenses(allTransactions);
				const spentUnallocated = [...spentByTagMap.entries()]
					.filter(([tag]) => !budgetAllocations.some((a) => a.tag === tag))
					.reduce((sum, [, amt]) => sum + amt, 0n);
				const remainingUnallocated = unallocatedPool - spentUnallocated;
				if (remainingUnallocated > 0n) {
					budgetHint = `Budget remaining: ${formatPesos(remainingUnallocated)} unallocated`;
				}
			}
		}
	}

	// Credit hint computation (D-08, D-09) — expense type + credit partition source only
	let creditHint: string | null = null;
	let isCreditOverLimit = false;

	if (selectedType === "expense" && selectedSourceSubAccountId) {
		const sourcePart = subAccounts.find((sa) => sa.id.toString() === selectedSourceSubAccountId);
		if (
			sourcePart &&
			sourcePart.subAccountType === "credit" &&
			sourcePart.creditLimitCentavos > 0n
		) {
			const outstanding = sourcePart.balanceCentavos;
			const limit = sourcePart.creditLimitCentavos;
			const available = limit - outstanding;
			const enteredCentavos = toCentavos(enteredAmount || "0");
			if (enteredCentavos > available) {
				const overBy = enteredCentavos - available;
				creditHint = `⚠ This will exceed your credit limit by ${formatPesos(overBy)}`;
				isCreditOverLimit = true;
			} else {
				creditHint = `Credit available: ${formatPesos(available)} of ${formatPesos(limit)}`;
			}
		}
	}

	const onSubmit = async (data: TransactionFormValues) => {
		if (!data.tag) return;
		setFormError(null);
		const amountCentavos = toCentavos(data.amount);
		const serviceFeeCentavos = data.serviceFee ? toCentavos(data.serviceFee) : 0n;
		const dateTimestamp = Timestamp.fromDate(new Date(data.date));

		const sourceId = data.sourceSubAccountId ? BigInt(data.sourceSubAccountId) : 0n;
		const destId = data.destinationSubAccountId ? BigInt(data.destinationSubAccountId) : 0n;

		try {
			if (transaction) {
				await editTransaction({
					transactionId: transaction.id,
					type: data.type,
					amountCentavos,
					tag: data.tag,
					sourceSubAccountId: sourceId,
					destinationSubAccountId: destId,
					serviceFeeCentavos,
					description: data.description,
					date: dateTimestamp,
				});
			} else {
				await createTransaction({
					type: data.type,
					amountCentavos,
					tag: data.tag,
					sourceSubAccountId: sourceId,
					destinationSubAccountId: destId,
					serviceFeeCentavos,
					description: data.description,
					date: dateTimestamp,
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

	useDragToDismiss(boxRef, handleClose);

	const [formError, setFormError] = useState<string | null>(null);

	const isEditMode = !!transaction;
	const title = isEditMode ? "Edit transaction" : "New transaction";
	const submitLabel = isEditMode ? "Update transaction" : "Save transaction";

	return (
		<dialog ref={ref} className="modal modal-bottom md:modal-middle" onClose={onClose}>
			<div className="modal-box flex flex-col" ref={boxRef}>
				{/* Header */}
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-semibold">{title}</h3>
					<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
						<X size={16} />
					</button>
				</div>

				<form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col flex-1 min-h-0">
					<div className="flex-1 overflow-y-auto">
						<div className="flex flex-col gap-4">
							{/* Type selector */}
							<div className="join w-full mb-4">
								{(["expense", "income", "transfer"] as const).map((t) => {
									const activeClass =
										t === "expense" ? "btn-error" : t === "income" ? "btn-success" : "btn-neutral";
									return (
										<button
											key={t}
											type="button"
											className={`btn join-item flex-1 ${selectedType === t ? activeClass : "btn-ghost"}`}
											onClick={() => {
												setValue("type", t);
												setValue("sourceSubAccountId", "");
												setValue("destinationSubAccountId", "");
												const firstTag = tagsByType[t]?.[0];
												setValue("tag", firstTag ?? (t === "transfer" ? "transfer" : ""));
											}}
										>
											{t.charAt(0).toUpperCase() + t.slice(1)}
										</button>
									);
								})}
							</div>

							{/* Amount + Tag (expense/income) or Amount + Service fee (transfer) */}
							<div className="grid sm:grid-cols-2 gap-4">
								<CurrencyInput
									label="Amount (P)"
									id="txn-amount"
									min="0.01"
									error={errors.amount?.message}
									{...register("amount", {
										required: "Amount is required",
										validate: (v) => parseFloat(v) > 0 || "Amount must be greater than 0",
									})}
								/>

								{selectedType === "transfer" || tagOptions.length > 0 ? (
									<div>
										<label className="label" htmlFor="txn-tag">
											<span className="label-text text-sm">Tag</span>
										</label>
										<select
											id="txn-tag"
											value={watch("tag")}
											onChange={(e) => {
												setValue("tag", e.target.value);
												if (e.target.value) clearErrors("tag");
											}}
											className={`select select-bordered w-full${errors.tag ? " select-error" : ""}`}
										>
											{selectedType === "transfer" ? (
												<option value="transfer">No tag</option>
											) : (
												<option value="">Select tag</option>
											)}
											{tagOptions.map((tag) => (
												<option key={tag} value={tag}>
													{tag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
												</option>
											))}
										</select>
										<input
											type="hidden"
											{...register("tag", {
												validate: (v) =>
													getValues("type") === "transfer" || v !== "" || "Tag is required",
											})}
										/>
										{errors.tag && <p className="text-error text-xs mt-1">{errors.tag.message}</p>}
										{selectedType === "expense" && selectedTag && budgetHint && (
											<p
												className={`text-xs mt-1 font-mono ${isOverBudget ? "text-warning" : "text-base-content/60"}`}
												role="status"
											>
												{budgetHint}
											</p>
										)}
									</div>
								) : null}

								{selectedType === "transfer" && (
									<CurrencyInput
										label="Service fee (P)"
										id="txn-service-fee"
										min="0"
										{...register("serviceFee")}
									/>
								)}
							</div>

							{/* From + To side by side for transfer */}
							{selectedType === "transfer" ? (
								<div className="grid sm:grid-cols-2 gap-4">
									<div>
										<label className="label" htmlFor="txn-source">
											<span className="label-text text-sm">From</span>
										</label>
										<SubAccountGroupedSelect
											id="txn-source"
											value={watch("sourceSubAccountId")}
											onChange={(v) => setValue("sourceSubAccountId", v)}
											error={errors.sourceSubAccountId?.message}
											accounts={accounts}
											subAccounts={subAccounts}
										/>
										{errors.sourceSubAccountId && (
											<p className="text-error text-xs mt-1">{errors.sourceSubAccountId.message}</p>
										)}
										<input
											type="hidden"
											{...register("sourceSubAccountId", {
												validate: (v) => v !== "" || "Select a source sub-account",
											})}
										/>
									</div>
									<div>
										<label className="label" htmlFor="txn-dest">
											<span className="label-text text-sm">To</span>
										</label>
										<SubAccountGroupedSelect
											id="txn-dest"
											value={watch("destinationSubAccountId")}
											onChange={(v) => setValue("destinationSubAccountId", v)}
											error={errors.destinationSubAccountId?.message}
											accounts={accounts}
											subAccounts={subAccounts}
										/>
										{errors.destinationSubAccountId && (
											<p className="text-error text-xs mt-1">
												{errors.destinationSubAccountId.message}
											</p>
										)}
										<input
											type="hidden"
											{...register("destinationSubAccountId", {
												validate: (v) => v !== "" || "Select a destination sub-account",
											})}
										/>
									</div>
								</div>
							) : (
								<>
									{/* From (expense) */}
									{selectedType === "expense" && (
										<div>
											<label className="label" htmlFor="txn-source">
												<span className="label-text text-sm">From</span>
											</label>
											<SubAccountGroupedSelect
												id="txn-source"
												value={watch("sourceSubAccountId")}
												onChange={(v) => setValue("sourceSubAccountId", v)}
												error={errors.sourceSubAccountId?.message}
												accounts={accounts}
												subAccounts={subAccounts}
											/>
											{errors.sourceSubAccountId && (
												<p className="text-error text-xs mt-1">
													{errors.sourceSubAccountId.message}
												</p>
											)}
											{creditHint && (
												<p
													className={`text-sm mt-1 font-mono ${isCreditOverLimit ? "text-warning" : "text-base-content/60"}`}
												>
													{creditHint}
												</p>
											)}
											<input
												type="hidden"
												{...register("sourceSubAccountId", {
													validate: (v) => {
														if (selectedType === "expense" || selectedType === "transfer") {
															return v !== "" || "Select a source sub-account";
														}
														return true;
													},
												})}
											/>
										</div>
									)}

									{/* To (income) */}
									{selectedType === "income" && (
										<div>
											<label className="label" htmlFor="txn-dest">
												<span className="label-text text-sm">To</span>
											</label>
											<SubAccountGroupedSelect
												id="txn-dest"
												value={watch("destinationSubAccountId")}
												onChange={(v) => setValue("destinationSubAccountId", v)}
												error={errors.destinationSubAccountId?.message}
												accounts={accounts}
												subAccounts={subAccounts}
											/>
											{errors.destinationSubAccountId && (
												<p className="text-error text-xs mt-1">
													{errors.destinationSubAccountId.message}
												</p>
											)}
											<input
												type="hidden"
												{...register("destinationSubAccountId", {
													validate: (v) => {
														if (selectedType === "income" || selectedType === "transfer") {
															return v !== "" || "Select a destination sub-account";
														}
														return true;
													},
												})}
											/>
										</div>
									)}
								</>
							)}

							{/* Date */}
							<DateInput
								label="Date"
								id="txn-date"
								error={errors.date?.message}
								{...register("date", { required: "Date is required" })}
							/>

							{/* Description */}
							<Input
								label="Description"
								id="txn-description"
								type="text"
								placeholder="Optional note"
								{...register("description")}
							/>
						</div>
					</div>

					{formError && (
						<div role="alert" className="alert alert-error text-sm py-2 mt-2">
							<span>{formError}</span>
						</div>
					)}

					{/* Submit — D-09: Cancel left, Save right */}
					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={handleClose}>
							Cancel
						</button>
						<SubmitButton isSubmitting={isSubmitting} label={submitLabel} />
					</div>
				</form>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="submit" aria-label="Close modal" />
			</form>
		</dialog>
	);
}
