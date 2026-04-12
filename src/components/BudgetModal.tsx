import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useReducer, useTable } from "spacetimedb/react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers, tables } from "../module_bindings";
import { openAsModal } from "../utils/dialog";
import { getVisibleTags } from "../utils/tagConfig";
import { Input } from "./Input";

interface AllocationRow {
	tag: string;
	amount: string;
}

interface BudgetFormValues {
	totalAmount: string;
}

interface BudgetModalProps {
	onClose: () => void;
}

export function BudgetModal({ onClose }: BudgetModalProps) {
	const setBudget = useReducer(reducers.setBudget);
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	const setBudgetAllocations = useReducer(reducers.setBudgetAllocations);
	const [budgetConfigRows] = useTable(tables.my_budget_config);
	const [allocationRows] = useTable(tables.my_budget_allocations);
	const [tagConfigs] = useTable(tables.my_tag_configs);

	const budgetConfig = budgetConfigRows[0] ?? null;
	const allocations = allocationRows as readonly { tag: string; allocatedCentavos: bigint }[];
	const expenseTags = getVisibleTags("expense", tagConfigs);

	useEffect(() => {
		openAsModal(ref.current);
	}, []);

	const [rows, setRows] = useState<AllocationRow[]>(() => [
		...allocations.map((a) => ({
			tag: a.tag,
			amount: (Number(a.allocatedCentavos) / 100).toFixed(2),
		})),
		{ tag: "", amount: "" },
	]);

	const {
		register,
		handleSubmit,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<BudgetFormValues>({
		defaultValues: {
			totalAmount: budgetConfig ? (Number(budgetConfig.totalCentavos) / 100).toFixed(2) : "",
		},
	});

	const watchedTotal = watch("totalAmount");
	const totalAmount = parseFloat(watchedTotal) || 0;
	const allocatedTotal = rows
		.filter((r) => r.tag && r.amount && parseFloat(r.amount) > 0)
		.reduce((sum, r) => sum + parseFloat(r.amount), 0);
	const isOverAllocated = allocatedTotal > totalAmount + 0.001;

	const usedTags = new Set(rows.map((r) => r.tag).filter(Boolean));
	useDragToDismiss(boxRef, onClose);

	const handleTagChange = (index: number, newTag: string) => {
		setRows((prev) => {
			const updated = prev.map((row, i) => (i === index ? { ...row, tag: newTag } : row));
			if (index === prev.length - 1 && newTag !== "") {
				return [...updated, { tag: "", amount: "" }];
			}
			return updated;
		});
	};

	const handleAmountChange = (index: number, val: string) =>
		setRows((prev) => prev.map((row, i) => (i === index ? { ...row, amount: val } : row)));

	const handleRemoveRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

	const onSubmit = async (values: BudgetFormValues) => {
		const totalCentavos = BigInt(Math.round(parseFloat(values.totalAmount) * 100));
		await setBudget({ totalCentavos });

		const allocationList = rows
			.filter((r) => r.tag && r.amount && parseFloat(r.amount) > 0)
			.map((r) => ({
				tag: r.tag,
				allocatedCentavos: BigInt(Math.round(parseFloat(r.amount) * 100)),
			}));
		await setBudgetAllocations({ allocations: allocationList });

		onClose();
	};

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
			<div className="modal-box flex flex-col" ref={boxRef}>
				{/* Header */}
				<div className="flex items-center justify-between mb-4">
					<h3 className="font-semibold text-sm">Set monthly budget</h3>
					<button
						type="button"
						className="btn btn-ghost btn-xs btn-circle"
						onClick={onClose}
						aria-label="Close"
					>
						<X size={14} />
					</button>
				</div>

				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
					<div className="flex-1 overflow-y-auto">
						<div className="flex flex-col gap-3">
							{/* Total monthly budget — required */}
							<Input
								label="Total monthly budget (required)"
								id="budget-total"
								type="number"
								min="0"
								step="0.01"
								error={errors.totalAmount?.message}
								{...register("totalAmount", {
									required: "Total budget is required",
									validate: (v) => parseFloat(v) > 0 || "Must be greater than 0",
								})}
							/>

							{/* Per-tag allocations */}
							<div>
								<span className="label-text text-sm text-base-content/50">
									Per-tag allocations (optional)
								</span>
							</div>

							{rows.map((row, index) => {
								const isEmptyRow = index === rows.length - 1 && row.tag === "";
								const currentTagOptions =
									row.tag && !expenseTags.includes(row.tag)
										? [row.tag, ...expenseTags]
										: expenseTags;
								const available = [...new Set(currentTagOptions)].filter(
									(tag) => !usedTags.has(tag) || rows[index].tag === tag,
								);
								return (
									<div
										key={row.tag || `row-${index}`}
										className="grid gap-2 items-center"
										style={{ gridTemplateColumns: "1fr 1fr 2rem" }}
									>
										<select
											value={row.tag}
											onChange={(e) => handleTagChange(index, e.target.value)}
											className="select select-bordered"
											aria-label={isEmptyRow ? "Select tag" : `Tag for row ${index + 1}`}
										>
											<option value="">Select tag</option>
											{available.map((tag) => (
												<option key={tag} value={tag}>
													{tag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
												</option>
											))}
										</select>

										{!isEmptyRow ? (
											<>
												<input
													type="number"
													min="0"
													step="0.01"
													placeholder="0.00"
													value={row.amount}
													onChange={(e) => handleAmountChange(index, e.target.value)}
													className="input input-bordered"
												/>
												<button
													type="button"
													className="btn btn-ghost btn-xs btn-circle"
													onClick={() => handleRemoveRow(index)}
													aria-label={`Remove ${row.tag}`}
												>
													<X size={12} />
												</button>
											</>
										) : (
											<>
												<span />
												<span />
											</>
										)}
									</div>
								);
							})}
						</div>
					</div>

					{/* Allocation summary */}
					{allocatedTotal > 0 && (
						<div
							className={`flex items-center justify-between text-xs mt-3 px-1 ${
								isOverAllocated ? "text-error" : "text-base-content/50"
							}`}
						>
							<span>Tag allocations total</span>
							<span className="font-mono font-semibold">
								{allocatedTotal.toLocaleString("en-PH", {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								})}{" "}
								/{" "}
								{totalAmount.toLocaleString("en-PH", {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								})}
							</span>
						</div>
					)}
					{isOverAllocated && (
						<p className="text-error text-xs mt-1 px-1">Tag allocations exceed the total budget.</p>
					)}

					{/* Actions */}
					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
							Discard
						</button>
						<button
							type="submit"
							disabled={isSubmitting || isOverAllocated}
							className="btn btn-primary flex-1"
						>
							{isSubmitting && <span className="loading loading-spinner loading-xs" />}
							Save budget
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
