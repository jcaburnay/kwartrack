import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Timestamp } from "spacetimedb";
import { useReducer, useTable } from "spacetimedb/react";
import { reducers, tables } from "../module_bindings";
import { getVisibleTags } from "../utils/tagConfig";

interface DebtFormValues {
	personName: string;
	amount: string;
	tag: string;
	partitionId: string;
	description: string;
	date: string;
}

interface DebtModalProps {
	onClose: () => void;
}

export function DebtModal({ onClose }: DebtModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		ref.current?.showModal();
	}, []);

	const createDebt = useReducer(reducers.createDebt);
	const [accounts] = useTable(tables.my_accounts);
	const [partitions] = useTable(tables.my_partitions);
	const [tagConfigs] = useTable(tables.my_tag_configs);
	const [direction, setDirection] = useState<"loaned" | "owed">("loaned");
	const expenseTags = getVisibleTags("expense", tagConfigs);

	const today = new Date().toISOString().slice(0, 10);
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<DebtFormValues>({
		defaultValues: {
			personName: "",
			amount: "",
			tag: "",
			partitionId: "",
			description: "",
			date: today,
		},
	});

	const onSubmit = async (values: DebtFormValues) => {
		const amountCentavos = BigInt(Math.round(parseFloat(values.amount) * 100));
		const partitionId = direction === "loaned" ? BigInt(values.partitionId) : 0n;
		const dateTimestamp = Timestamp.fromDate(new Date(values.date));

		await createDebt({
			personName: values.personName.trim(),
			direction,
			amountCentavos,
			partitionId,
			tag: values.tag,
			description: values.description,
			date: dateTimestamp,
		});
		reset();
		onClose();
	};

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
			<div className="modal-box flex flex-col">
				<div className="flex items-center justify-between mb-4">
					<h3 className="font-semibold text-sm">New debt</h3>
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
							{/* Direction toggle */}
							<div>
								<div className="label">
									<span className="label-text text-sm">Direction</span>
								</div>
								<div className="flex gap-2">
									<button
										type="button"
										className={`btn btn-sm flex-1 ${direction === "loaned" ? "btn-success" : "btn-ghost"}`}
										onClick={() => setDirection("loaned")}
									>
										I lent money
									</button>
									<button
										type="button"
										className={`btn btn-sm flex-1 ${direction === "owed" ? "btn-error" : "btn-ghost"}`}
										onClick={() => setDirection("owed")}
									>
										I owe money
									</button>
								</div>
							</div>

							{/* Person name */}
							<div>
								<label className="label" htmlFor="debt-person">
									<span className="label-text text-sm">Person</span>
								</label>
								<input
									id="debt-person"
									type="text"
									className={`input input-bordered w-full${errors.personName ? " input-error" : ""}`}
									{...register("personName", {
										required: "Person name is required",
										maxLength: { value: 80, message: "Max 80 characters" },
									})}
								/>
								{errors.personName && (
									<p className="text-error text-xs mt-1">{errors.personName.message}</p>
								)}
							</div>

							{/* Amount + Tag side by side */}
							<div className="grid sm:grid-cols-2 gap-3">
								<div>
									<label className="label" htmlFor="debt-amount">
										<span className="label-text text-sm">Amount</span>
									</label>
									<input
										id="debt-amount"
										type="number"
										step="0.01"
										min="0.01"
										className={`input input-bordered w-full${errors.amount ? " input-error" : ""}`}
										{...register("amount", {
											required: "Amount is required",
											validate: (v) => parseFloat(v) > 0 || "Amount must be greater than 0",
										})}
									/>
									{errors.amount && (
										<p className="text-error text-xs mt-1">{errors.amount.message}</p>
									)}
								</div>
								<div>
									<label className="label" htmlFor="debt-tag">
										<span className="label-text text-sm">Tag</span>
									</label>
									<select
										id="debt-tag"
										className={`select select-bordered w-full${errors.tag ? " select-error" : ""}`}
										{...register("tag", { required: "Tag is required" })}
									>
										<option value="">Select tag</option>
										{expenseTags.map((tag) => (
											<option key={tag} value={tag}>
												{tag}
											</option>
										))}
									</select>
									{errors.tag && <p className="text-error text-xs mt-1">{errors.tag.message}</p>}
								</div>
							</div>

							{/* Partition + Date side by side */}
							<div className={`grid ${direction === "loaned" ? "sm:grid-cols-2" : ""} gap-3`}>
								{direction === "loaned" && (
									<div>
										<label className="label" htmlFor="debt-partition">
											<span className="label-text text-sm">Source partition</span>
										</label>
										<select
											id="debt-partition"
											className={`select select-bordered w-full${errors.partitionId ? " select-error" : ""}`}
											{...register("partitionId", {
												required: direction === "loaned" ? "Partition is required" : false,
											})}
										>
											<option value="">Select partition</option>
											{accounts.map((account) => {
												if (account.isStandalone) {
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
												const accountPartitions = partitions.filter(
													(p) => p.accountId === account.id && !p.isDefault,
												);
												if (accountPartitions.length === 0) return null;
												return (
													<optgroup key={account.id.toString()} label={account.name}>
														{accountPartitions.map((p) => (
															<option key={p.id.toString()} value={p.id.toString()}>
																{p.name}
															</option>
														))}
													</optgroup>
												);
											})}
										</select>
										{errors.partitionId && (
											<p className="text-error text-xs mt-1">{errors.partitionId.message}</p>
										)}
									</div>
								)}
								<div>
									<label className="label" htmlFor="debt-date">
										<span className="label-text text-sm">Date</span>
									</label>
									<input
										id="debt-date"
										type="date"
										className="input input-bordered w-full"
										{...register("date", { required: "Date is required" })}
									/>
								</div>
							</div>

							{/* Description */}
							<div>
								<label className="label" htmlFor="debt-desc">
									<span className="label-text text-sm">
										Description <span className="text-base-content/30">(optional)</span>
									</span>
								</label>
								<input
									id="debt-desc"
									type="text"
									className="input input-bordered w-full"
									{...register("description")}
								/>
							</div>
						</div>
					</div>

					{/* Actions */}
					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
							Discard
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							className="btn btn-primary flex-1 whitespace-nowrap"
						>
							{isSubmitting && <span className="loading loading-spinner loading-xs" />}
							Add debt
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
