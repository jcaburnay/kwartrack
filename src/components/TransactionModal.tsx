import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Timestamp } from "spacetimedb";
import { useReducer, useTable } from "spacetimedb/react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers, tables } from "../module_bindings";
import { getCurrentMonthExpenses } from "../utils/budgetCompute";
import { formatPesos } from "../utils/currency";
import { getVisibleTags } from "../utils/tagConfig";

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
	sourcePartitionId: bigint;
	destinationPartitionId: bigint;
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
	sourcePartitionId: string;
	destinationPartitionId: string;
	serviceFee: string;
	description: string;
	date: string;
}

interface PartitionGroupedSelectProps {
	id: string;
	value: string;
	onChange: (value: string) => void;
	error?: string;
	accounts: readonly { id: bigint; name: string; isStandalone: boolean }[];
	partitions: readonly {
		id: bigint;
		accountId: bigint;
		name: string;
		balanceCentavos: bigint;
		isDefault: boolean;
	}[];
}

function PartitionGroupedSelect({
	id,
	value,
	onChange,
	error,
	accounts,
	partitions,
}: PartitionGroupedSelectProps) {
	return (
		<select
			id={id}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className={`select select-bordered w-full${error ? " input-error" : ""}`}
		>
			<option value="">Select partition</option>
			{accounts.map((account) => {
				if (account.isStandalone) {
					// Find the default partition for this standalone account
					const defaultPartition = partitions.find(
						(p) => p.accountId === account.id && p.isDefault,
					);
					if (!defaultPartition) return null;
					return (
						<optgroup key={account.id.toString()} label={account.name}>
							<option value={defaultPartition.id.toString()}>{account.name}</option>
						</optgroup>
					);
				}
				// Partitioned account: show non-default partitions
				const accountPartitions = partitions.filter(
					(p) => p.accountId === account.id && !p.isDefault,
				);
				if (accountPartitions.length === 0) return null;
				return (
					<optgroup key={account.id.toString()} label={account.name}>
						{accountPartitions.map((partition) => (
							<option key={partition.id.toString()} value={partition.id.toString()}>
								{partition.name}
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
		ref.current?.showModal();
	}, []);
	const createTransaction = useReducer(reducers.createTransaction);
	const editTransaction = useReducer(reducers.editTransaction);
	const [accounts] = useTable(tables.my_accounts);
	const [partitions] = useTable(tables.my_partitions);
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
				sourcePartitionId:
					transaction.sourcePartitionId !== 0n ? transaction.sourcePartitionId.toString() : "",
				destinationPartitionId:
					transaction.destinationPartitionId !== 0n
						? transaction.destinationPartitionId.toString()
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
				tag: expenseTags[0] ?? "foods",
				sourcePartitionId: "",
				destinationPartitionId: "",
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
	const selectedSourcePartitionId = watch("sourcePartitionId");
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
		if (visibleTags.length > 0 && !visibleTags.includes(selectedTag)) {
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

	if (selectedType === "expense" && selectedSourcePartitionId) {
		const sourcePart = partitions.find((p) => p.id.toString() === selectedSourcePartitionId);
		if (
			sourcePart &&
			sourcePart.partitionType === "credit" &&
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
		const amountCentavos = BigInt(Math.round(parseFloat(data.amount) * 100));
		const serviceFeeCentavos = data.serviceFee
			? BigInt(Math.round(parseFloat(data.serviceFee) * 100))
			: 0n;
		const dateTimestamp = Timestamp.fromDate(new Date(data.date));

		const sourceId = data.sourcePartitionId ? BigInt(data.sourcePartitionId) : 0n;
		const destId = data.destinationPartitionId ? BigInt(data.destinationPartitionId) : 0n;

		if (transaction) {
			editTransaction({
				transactionId: transaction.id,
				type: data.type,
				amountCentavos,
				tag: data.tag,
				sourcePartitionId: sourceId,
				destinationPartitionId: destId,
				serviceFeeCentavos,
				description: data.description,
				date: dateTimestamp,
			});
		} else {
			createTransaction({
				type: data.type,
				amountCentavos,
				tag: data.tag,
				sourcePartitionId: sourceId,
				destinationPartitionId: destId,
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
												setValue("sourcePartitionId", "");
												setValue("destinationPartitionId", "");
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
								<div>
									<label className="label" htmlFor="txn-amount">
										<span className="label-text text-sm">Amount (P)</span>
									</label>
									<input
										id="txn-amount"
										type="number"
										step="0.01"
										min="0.01"
										placeholder="0.00"
										{...register("amount", {
											required: "Amount is required",
											validate: (v) => parseFloat(v) > 0 || "Amount must be greater than 0",
										})}
										className={`input input-bordered w-full${errors.amount ? " input-error" : ""}`}
									/>
									{errors.amount && (
										<p className="text-error text-xs mt-1">{errors.amount.message}</p>
									)}
								</div>

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
											{selectedType === "transfer" && <option value="transfer">No tag</option>}
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
									<div>
										<label className="label" htmlFor="txn-service-fee">
											<span className="label-text text-sm">Service fee (P)</span>
										</label>
										<input
											id="txn-service-fee"
											type="number"
											step="0.01"
											min="0"
											placeholder="0.00"
											{...register("serviceFee")}
											className="input input-bordered w-full"
										/>
									</div>
								)}
							</div>

							{/* From + To side by side for transfer */}
							{selectedType === "transfer" ? (
								<div className="grid sm:grid-cols-2 gap-4">
									<div>
										<label className="label" htmlFor="txn-source">
											<span className="label-text text-sm">From</span>
										</label>
										<PartitionGroupedSelect
											id="txn-source"
											value={watch("sourcePartitionId")}
											onChange={(v) => setValue("sourcePartitionId", v)}
											error={errors.sourcePartitionId?.message}
											accounts={accounts}
											partitions={partitions}
										/>
										{errors.sourcePartitionId && (
											<p className="text-error text-xs mt-1">{errors.sourcePartitionId.message}</p>
										)}
										<input
											type="hidden"
											{...register("sourcePartitionId", {
												validate: (v) => v !== "" || "Select a source partition",
											})}
										/>
									</div>
									<div>
										<label className="label" htmlFor="txn-dest">
											<span className="label-text text-sm">To</span>
										</label>
										<PartitionGroupedSelect
											id="txn-dest"
											value={watch("destinationPartitionId")}
											onChange={(v) => setValue("destinationPartitionId", v)}
											error={errors.destinationPartitionId?.message}
											accounts={accounts}
											partitions={partitions}
										/>
										{errors.destinationPartitionId && (
											<p className="text-error text-xs mt-1">
												{errors.destinationPartitionId.message}
											</p>
										)}
										<input
											type="hidden"
											{...register("destinationPartitionId", {
												validate: (v) => v !== "" || "Select a destination partition",
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
											<PartitionGroupedSelect
												id="txn-source"
												value={watch("sourcePartitionId")}
												onChange={(v) => setValue("sourcePartitionId", v)}
												error={errors.sourcePartitionId?.message}
												accounts={accounts}
												partitions={partitions}
											/>
											{errors.sourcePartitionId && (
												<p className="text-error text-xs mt-1">
													{errors.sourcePartitionId.message}
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
												{...register("sourcePartitionId", {
													validate: (v) => {
														if (selectedType === "expense" || selectedType === "transfer") {
															return v !== "" || "Select a source partition";
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
											<PartitionGroupedSelect
												id="txn-dest"
												value={watch("destinationPartitionId")}
												onChange={(v) => setValue("destinationPartitionId", v)}
												error={errors.destinationPartitionId?.message}
												accounts={accounts}
												partitions={partitions}
											/>
											{errors.destinationPartitionId && (
												<p className="text-error text-xs mt-1">
													{errors.destinationPartitionId.message}
												</p>
											)}
											<input
												type="hidden"
												{...register("destinationPartitionId", {
													validate: (v) => {
														if (selectedType === "income" || selectedType === "transfer") {
															return v !== "" || "Select a destination partition";
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
							<div>
								<label className="label" htmlFor="txn-date">
									<span className="label-text text-sm">Date</span>
								</label>
								<input
									id="txn-date"
									type="date"
									{...register("date", { required: "Date is required" })}
									className={`input input-bordered w-full${errors.date ? " input-error" : ""}`}
								/>
								{errors.date && <p className="text-error text-xs mt-1">{errors.date.message}</p>}
							</div>

							{/* Description */}
							<div>
								<label className="label" htmlFor="txn-description">
									<span className="label-text text-sm">Description</span>
								</label>
								<input
									id="txn-description"
									type="text"
									placeholder="Optional note"
									{...register("description")}
									className="input input-bordered w-full"
								/>
							</div>
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
