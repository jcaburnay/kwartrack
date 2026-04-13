import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Timestamp } from "spacetimedb";
import { useReducer, useTable } from "spacetimedb/react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers, tables } from "../module_bindings";
import { getCurrentMonthExpenses } from "../utils/budgetCompute";
import { formatPesos } from "../utils/currency";
import { openAsModal } from "../utils/dialog";
import { getVisibleTags } from "../utils/tagConfig";
import { Input } from "./Input";

const todayISO = () => {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
};

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

interface SubAccountGroupedSelectProps {
	id: string;
	value: string;
	onChange: (value: string) => void;
	error?: string;
	accounts: readonly { id: bigint; name: string; isStandalone: boolean }[];
	subAccounts: readonly {
		id: bigint;
		accountId: bigint;
		name: string;
		balanceCentavos: bigint;
		isDefault: boolean;
	}[];
}

function SubAccountGroupedSelect({
	id,
	value,
	onChange,
	error,
	accounts,
	subAccounts,
}: SubAccountGroupedSelectProps) {
	return (
		<select
			id={id}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className={`select select-bordered w-full${error ? " input-error" : ""}`}
		>
			<option value="">Select sub-account</option>
			{accounts.map((account) => {
				if (account.isStandalone) {
					// Find the default sub-account for this standalone account
					const defaultSubAccount = subAccounts.find(
						(sa) => sa.accountId === account.id && sa.isDefault,
					);
					if (!defaultSubAccount) return null;
					return (
						<optgroup key={account.id.toString()} label={account.name}>
							<option value={defaultSubAccount.id.toString()}>{account.name}</option>
						</optgroup>
					);
				}
				// Partitioned account: show non-default sub-accounts
				const accountSubAccounts = subAccounts.filter(
					(sa) => sa.accountId === account.id && !sa.isDefault,
				);
				if (accountSubAccounts.length === 0) return null;
				return (
					<optgroup key={account.id.toString()} label={account.name}>
						{accountSubAccounts.map((subAccount) => (
							<option key={subAccount.id.toString()} value={subAccount.id.toString()}>
								{subAccount.name}
							</option>
						))}
					</optgroup>
				);
			})}
		</select>
	);
}

export function TransactionModal({ onClose, transaction }: TransactionModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		openAsModal(ref.current);
	}, []);
	const createTransaction = useReducer(reducers.createTransaction);
	const editTransaction = useReducer(reducers.editTransaction);
	const [accounts] = useTable(tables.my_accounts);
	const [subAccounts] = useTable(tables.my_sub_accounts);
	const [budgetConfigRows] = useTable(tables.my_budget_config);
	const [budgetAllocations] = useTable(tables.my_budget_allocations);
	const [allTransactions] = useTable(tables.my_transactions);
	const [tagConfigs] = useTable(tables.my_tag_configs);

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
				amount: (Number(transaction.amountCentavos) / 100).toFixed(2),
				tag: transaction.tag,
				sourceSubAccountId:
					transaction.sourceSubAccountId !== 0n ? transaction.sourceSubAccountId.toString() : "",
				destinationSubAccountId:
					transaction.destinationSubAccountId !== 0n
						? transaction.destinationSubAccountId.toString()
						: "",
				serviceFee:
					transaction.serviceFeeCentavos !== 0n
						? (Number(transaction.serviceFeeCentavos) / 100).toFixed(2)
						: "",
				description: transaction.description,
				date: new Date(Number(transaction.date.microsSinceUnixEpoch / 1000n))
					.toISOString()
					.split("T")[0],
			}
		: {
				type: "expense",
				amount: "",
				tag: "",
				sourceSubAccountId: "",
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
			const enteredCentavos = BigInt(Math.round(parseFloat(enteredAmount || "0") * 100));

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
			const enteredCentavos = BigInt(Math.round(parseFloat(enteredAmount || "0") * 100));
			if (enteredCentavos > available) {
				const overBy = enteredCentavos - available;
				creditHint = `⚠ This will exceed your credit limit by ${formatPesos(overBy)}`;
				isCreditOverLimit = true;
			} else {
				creditHint = `Credit available: ${formatPesos(available)} of ${formatPesos(limit)}`;
			}
		}
	}

	const onSubmit = (data: TransactionFormValues) => {
		if (!data.tag) return;
		const amountCentavos = BigInt(Math.round(parseFloat(data.amount) * 100));
		const serviceFeeCentavos = data.serviceFee
			? BigInt(Math.round(parseFloat(data.serviceFee) * 100))
			: 0n;
		const dateTimestamp = Timestamp.fromDate(new Date(data.date));

		const sourceId = data.sourceSubAccountId ? BigInt(data.sourceSubAccountId) : 0n;
		const destId = data.destinationSubAccountId ? BigInt(data.destinationSubAccountId) : 0n;

		if (transaction) {
			editTransaction({
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
			createTransaction({
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
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	useDragToDismiss(boxRef, handleClose);

	const isEditMode = !!transaction;
	const title = isEditMode ? "Edit transaction" : "New transaction";
	const submitLabel = isEditMode ? "Update transaction" : "Save transaction";

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
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
								<Input
									label="Amount (P)"
									id="txn-amount"
									type="number"
									step="0.01"
									min="0.01"
									placeholder="0.00"
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
											onChange={(e) => setValue("tag", e.target.value)}
											className="select select-bordered w-full"
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
										{selectedType === "expense" && selectedTag && budgetHint && (
											<p
												className={`text-xs mt-1 font-mono ${isOverBudget ? "text-warning" : "text-base-content/50"}`}
												role="status"
											>
												{budgetHint}
											</p>
										)}
									</div>
								) : null}

								{selectedType === "transfer" && (
									<Input
										label="Service fee (P)"
										id="txn-service-fee"
										type="number"
										step="0.01"
										min="0"
										placeholder="0.00"
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
													className={`text-sm mt-1 font-mono ${isCreditOverLimit ? "text-warning" : "text-base-content/50"}`}
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
							<Input
								label="Date"
								id="txn-date"
								type="date"
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

					{/* Submit — D-09: Cancel left, Save right */}
					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={handleClose}>
							Cancel
						</button>
						<button
							type="submit"
							className="btn btn-primary flex-1 whitespace-nowrap"
							disabled={isSubmitting}
						>
							{submitLabel}
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
