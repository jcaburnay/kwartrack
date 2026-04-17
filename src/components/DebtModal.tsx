import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Timestamp } from "spacetimedb";
import { useAccounts, useDebtActions, useSubAccounts, useTags } from "../hooks";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { toCentavos } from "../utils/currency";
import { todayISO } from "../utils/date";
import { openAsModal } from "../utils/dialog";
import { getVisibleTags } from "../utils/tagConfig";
import { CurrencyInput } from "./CurrencyInput";
import { DateInput } from "./DateInput";
import { Input } from "./Input";
import { SubmitButton } from "./SubmitButton";

interface DebtFormValues {
	personName: string;
	amount: string;
	tag: string;
	subAccountId: string;
	description: string;
	date: string;
}

interface DebtModalProps {
	onClose: () => void;
}

export function DebtModal({ onClose }: DebtModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		openAsModal(ref.current);
	}, []);

	const { create: createDebt } = useDebtActions();
	const { accounts } = useAccounts();
	const { subAccounts } = useSubAccounts();
	const { tagConfigs } = useTags();
	const [direction, setDirection] = useState<"loaned" | "owed">("loaned");
	const expenseTags = getVisibleTags("expense", tagConfigs);

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
			subAccountId: "",
			description: "",
			date: todayISO(),
		},
	});

	const onSubmit = async (values: DebtFormValues) => {
		setFormError(null);
		const amountCentavos = toCentavos(values.amount);
		const subAccountId = direction === "loaned" ? BigInt(values.subAccountId) : 0n;
		const dateTimestamp = Timestamp.fromDate(new Date(values.date));

		try {
			await createDebt({
				personName: values.personName.trim(),
				direction,
				amountCentavos,
				subAccountId,
				tag: values.tag,
				description: values.description,
				date: dateTimestamp,
			});
			reset();
			onClose();
		} catch (err) {
			setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
		}
	};

	const [formError, setFormError] = useState<string | null>(null);

	useDragToDismiss(boxRef, onClose);

	return (
		<dialog ref={ref} className="modal modal-bottom md:modal-middle" onClose={onClose}>
			<div className="modal-box flex flex-col" ref={boxRef}>
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
							<Input
								label="Person"
								id="debt-person"
								type="text"
								error={errors.personName?.message}
								{...register("personName", {
									required: "Person name is required",
									maxLength: { value: 80, message: "Max 80 characters" },
								})}
							/>

							{/* Amount + Tag side by side */}
							<div className="grid sm:grid-cols-2 gap-3">
								<CurrencyInput
									label="Amount"
									id="debt-amount"
									min="0.01"
									error={errors.amount?.message}
									{...register("amount", {
										required: "Amount is required",
										validate: (v) => parseFloat(v) > 0 || "Amount must be greater than 0",
									})}
								/>
								<div>
									<label className="label" htmlFor="debt-tag">
										<span className="label-text text-sm">
											Tag
											{direction === "loaned" && (
												<span className="text-base-content/60 ml-1">(optional)</span>
											)}
										</span>
									</label>
									<select
										id="debt-tag"
										className={`select select-bordered w-full${errors.tag ? " select-error" : ""}`}
										{...register("tag", {
											validate: (v) => direction === "loaned" || !!v || "Tag is required",
										})}
									>
										<option value="">Select tag</option>
										{expenseTags.map((tag) => (
											<option key={tag} value={tag}>
												{tag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
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
											<span className="label-text text-sm">Source sub-account</span>
										</label>
										<select
											id="debt-partition"
											className={`select select-bordered w-full${errors.subAccountId ? " select-error" : ""}`}
											{...register("subAccountId", {
												required: direction === "loaned" ? "Sub-account is required" : false,
											})}
										>
											<option value="">Select sub-account</option>
											{accounts.map((account) => {
												if (account.isStandalone) {
													const defaultPartition = subAccounts.find(
														(p) => p.accountId === account.id && p.isDefault,
													);
													if (!defaultPartition) return null;
													return (
														<optgroup key={account.id.toString()} label={account.name}>
															<option value={defaultPartition.id.toString()}>{account.name}</option>
														</optgroup>
													);
												}
												const accountPartitions = subAccounts.filter(
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
										{errors.subAccountId && (
											<p className="text-error text-xs mt-1">{errors.subAccountId.message}</p>
										)}
									</div>
								)}
								<DateInput
									label="Date"
									id="debt-date"
									error={errors.date?.message}
									{...register("date", { required: "Date is required" })}
								/>
							</div>

							{/* Description */}
							<Input
								label={
									<>
										Description <span className="text-base-content/60">(optional)</span>
									</>
								}
								id="debt-desc"
								type="text"
								{...register("description")}
							/>
						</div>
					</div>

					{formError && (
						<div role="alert" className="alert alert-error text-sm py-2 mt-2">
							<span>{formError}</span>
						</div>
					)}

					{/* Actions */}
					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
							Cancel
						</button>
						<SubmitButton isSubmitting={isSubmitting} label="Add debt" />
					</div>
				</form>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="submit" aria-label="Close modal" />
			</form>
		</dialog>
	);
}
