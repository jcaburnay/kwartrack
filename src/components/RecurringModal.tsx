import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useReducer, useTable } from "spacetimedb/react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers, tables } from "../module_bindings";
import { openAsModal } from "../utils/dialog";
import { getVisibleTags } from "../utils/tagConfig";
import { Input } from "./Input";

interface RecurringDefinition {
	id: bigint;
	name: string;
	type: string;
	amountCentavos: bigint;
	tag: string;
	subAccountId: bigint;
	dayOfMonth: number;
	interval: string;
	anchorMonth: number;
	anchorDayOfWeek: number;
	isPaused: boolean;
	remainingOccurrences: number;
	totalOccurrences: number;
}

interface RecurringFormValues {
	name: string;
	type: "expense" | "income";
	amount: string;
	tag: string;
	subAccountId: string;
	dayOfMonth: string;
	interval: string;
	anchorMonth: string;
	anchorDayOfWeek: string;
	remainingOccurrences: string;
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
					// Find the default partition for this standalone account
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
				// Partitioned account: show non-default partitions
				const accountPartitions = subAccounts.filter(
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

interface RecurringModalProps {
	onClose: () => void;
	definition?: RecurringDefinition;
	mode?: "subscription" | "installment";
}

export function RecurringModal({
	onClose,
	definition,
	mode = "subscription",
}: RecurringModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		openAsModal(ref.current);
	}, []);
	const createRecurring = useReducer(reducers.createRecurringDefinition);
	const editRecurring = useReducer(reducers.editRecurringDefinition);
	const [accounts] = useTable(tables.my_accounts);
	const [subAccounts] = useTable(tables.my_sub_accounts);
	const [tagConfigs] = useTable(tables.my_tag_configs);
	const isEdit = !!definition;
	const effectiveMode = isEdit
		? definition.totalOccurrences > 0
			? "installment"
			: "subscription"
		: mode;
	const isInstallment = effectiveMode === "installment";
	const tagsByType: Record<string, string[]> = {
		expense: getVisibleTags("expense", tagConfigs),
		income: getVisibleTags("income", tagConfigs),
		transfer: getVisibleTags("transfer", tagConfigs),
	};

	const defaultValues: RecurringFormValues = definition
		? {
				name: definition.name,
				type: definition.type as "expense" | "income",
				amount: (Number(definition.amountCentavos) / 100).toFixed(2),
				tag: definition.tag,
				subAccountId: definition.subAccountId.toString(),
				dayOfMonth: definition.dayOfMonth.toString(),
				interval: definition.interval,
				anchorMonth:
					definition.anchorMonth > 0
						? definition.anchorMonth.toString()
						: (new Date().getMonth() + 1).toString(),
				anchorDayOfWeek:
					definition.anchorDayOfWeek > 0 ? definition.anchorDayOfWeek.toString() : "1",
				remainingOccurrences: definition.remainingOccurrences
					? definition.remainingOccurrences.toString()
					: "",
			}
		: {
				name: "",
				type: "expense",
				amount: "",
				tag: isInstallment ? "" : "digital-subscriptions",
				subAccountId: "",
				dayOfMonth: "1",
				interval: "monthly",
				anchorMonth: (new Date().getMonth() + 1).toString(),
				anchorDayOfWeek: "1",
				remainingOccurrences: "",
			};

	const {
		register,
		handleSubmit,
		watch,
		reset,
		setValue,
		formState: { errors, isSubmitting },
	} = useForm<RecurringFormValues>({ defaultValues });

	const selectedType = watch("type");
	const selectedInterval = watch("interval");
	const isWeeklyBiweekly = selectedInterval === "weekly" || selectedInterval === "biweekly";
	const hasMonthAnchor =
		selectedInterval === "quarterly" ||
		selectedInterval === "semiannual" ||
		selectedInterval === "yearly";
	const selectedTag = watch("tag");
	// When type changes, reset tag to empty string (tags differ by type)
	const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setValue("type", e.target.value as "expense" | "income");
		setValue("tag", "");
	};

	const onSubmit = async (values: RecurringFormValues) => {
		const amountCentavos = BigInt(Math.round(parseFloat(values.amount) * 100));
		const subAccountId = BigInt(values.subAccountId);
		const dayOfMonth = parseInt(values.dayOfMonth, 10);
		const anchorMonth = hasMonthAnchor ? parseInt(values.anchorMonth, 10) : 0;
		const anchorDayOfWeek = isWeeklyBiweekly ? parseInt(values.anchorDayOfWeek, 10) : 0;
		// For weekly/biweekly, dayOfMonth is unused — store placeholder 1
		const effectiveDayOfMonth = isWeeklyBiweekly ? 1 : dayOfMonth;
		const remainingOccurrences = values.remainingOccurrences
			? parseInt(values.remainingOccurrences, 10)
			: 0;

		if (isEdit && definition) {
			await editRecurring({
				definitionId: definition.id,
				name: values.name.trim(),
				type: values.type,
				amountCentavos,
				tag: values.tag,
				subAccountId,
				dayOfMonth: effectiveDayOfMonth,
				interval: values.interval,
				anchorMonth,
				anchorDayOfWeek,
				remainingOccurrences,
			});
		} else {
			await createRecurring({
				name: values.name.trim(),
				type: values.type,
				amountCentavos,
				tag: values.tag,
				subAccountId,
				dayOfMonth: effectiveDayOfMonth,
				interval: values.interval,
				anchorMonth,
				anchorDayOfWeek,
				remainingOccurrences,
				totalOccurrences: isInstallment ? remainingOccurrences : 0,
			});
		}
		reset();
		onClose();
	};

	const visibleTags = tagsByType[selectedType] ?? [];
	const availableTags =
		selectedTag && !visibleTags.includes(selectedTag) ? [selectedTag, ...visibleTags] : visibleTags;

	useDragToDismiss(boxRef, onClose);

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
			<div className="modal-box flex flex-col" ref={boxRef}>
				<div className="flex items-center justify-between mb-4">
					<h3 className="font-semibold text-sm">
						{isEdit
							? "Edit recurring transaction"
							: isInstallment
								? "New installment"
								: "New subscription"}
					</h3>
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
							<Input
								label="Name"
								id="rec-name"
								error={errors.name?.message}
								autoComplete="off"
								{...register("name", {
									required: "Name is required",
									maxLength: { value: 80, message: "Max 80 characters" },
								})}
							/>

							{/* Amount + Tag side by side */}
							<div className="grid sm:grid-cols-2 gap-3">
								<Input
									label="Amount"
									id="rec-amount"
									type="number"
									step="0.01"
									min="0.01"
									error={errors.amount?.message}
									{...register("amount", {
										required: "Amount is required",
										validate: (v) => parseFloat(v) > 0 || "Amount must be greater than 0",
									})}
								/>

								<div>
									<label className="label" htmlFor="rec-tag">
										<span className="label-text text-sm">Tag</span>
									</label>
									<select
										id="rec-tag"
										className={`select select-bordered w-full${errors.tag ? " select-error" : ""}`}
										{...register("tag", { required: "Tag is required" })}
									>
										<option value="">Select tag</option>
										{availableTags.map((tag) => (
											<option key={tag} value={tag}>
												{tag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
											</option>
										))}
									</select>
									{errors.tag && <p className="text-error text-xs mt-1">{errors.tag.message}</p>}
								</div>
							</div>

							{/* Type + Partition side by side */}
							<div className="grid sm:grid-cols-2 gap-3">
								<div>
									<label className="label" htmlFor="rec-type">
										<span className="label-text text-sm">Type</span>
									</label>
									<select
										id="rec-type"
										className="select select-bordered w-full"
										{...register("type", { required: "Type is required" })}
										onChange={handleTypeChange}
									>
										<option value="expense">Expense</option>
										<option value="income">Income</option>
									</select>
								</div>

								<div>
									<label className="label" htmlFor="rec-partition">
										<span className="label-text text-sm">
											{selectedType === "expense"
												? "Source sub-account"
												: "Destination sub-account"}
										</span>
									</label>
									<SubAccountGroupedSelect
										id="rec-partition"
										value={watch("subAccountId")}
										onChange={(v) => setValue("subAccountId", v)}
										error={errors.subAccountId?.message}
										accounts={accounts}
										subAccounts={subAccounts}
									/>
									<input
										type="hidden"
										{...register("subAccountId", {
											required: "Sub-account is required",
											validate: (v) => v !== "" || "Sub-account is required",
										})}
									/>
									{errors.subAccountId && (
										<p className="text-error text-xs mt-1">{errors.subAccountId.message}</p>
									)}
								</div>
							</div>

							{/* Interval + scheduling anchor */}
							<div className="grid sm:grid-cols-2 gap-3">
								<div>
									<label className="label" htmlFor="rec-interval">
										<span className="label-text text-sm">Interval</span>
									</label>
									<select
										id="rec-interval"
										aria-label="Interval"
										className="select select-bordered w-full"
										{...register("interval", { required: "Interval is required" })}
									>
										<option value="weekly">Weekly</option>
										<option value="biweekly">Bi-weekly</option>
										<option value="monthly">Monthly</option>
										<option value="quarterly">Quarterly</option>
										<option value="semiannual">Semi-annual</option>
										<option value="yearly">Yearly</option>
									</select>
									{errors.interval && (
										<p className="text-error text-xs mt-1">{errors.interval.message}</p>
									)}
								</div>

								{/* Day-of-week picker — weekly/biweekly only */}
								{isWeeklyBiweekly && (
									<div>
										<label className="label" htmlFor="rec-dow">
											<span className="label-text text-sm">Day of week</span>
										</label>
										<select
											id="rec-dow"
											aria-label="Day of week"
											className="select select-bordered w-full"
											{...register("anchorDayOfWeek", { required: "Day is required" })}
										>
											<option value="1">Monday</option>
											<option value="2">Tuesday</option>
											<option value="3">Wednesday</option>
											<option value="4">Thursday</option>
											<option value="5">Friday</option>
											<option value="6">Saturday</option>
											<option value="7">Sunday</option>
										</select>
										{errors.anchorDayOfWeek && (
											<p className="text-error text-xs mt-1">{errors.anchorDayOfWeek.message}</p>
										)}
									</div>
								)}

								{/* Month anchor picker — quarterly/semiannual/yearly */}
								{hasMonthAnchor && (
									<div>
										<label className="label" htmlFor="rec-anchor-month">
											<span className="label-text text-sm">Anchor month</span>
										</label>
										<select
											id="rec-anchor-month"
											aria-label="Anchor month"
											className="select select-bordered w-full"
											{...register("anchorMonth", { required: "Month is required" })}
										>
											<option value="1">January</option>
											<option value="2">February</option>
											<option value="3">March</option>
											<option value="4">April</option>
											<option value="5">May</option>
											<option value="6">June</option>
											<option value="7">July</option>
											<option value="8">August</option>
											<option value="9">September</option>
											<option value="10">October</option>
											<option value="11">November</option>
											<option value="12">December</option>
										</select>
										{errors.anchorMonth && (
											<p className="text-error text-xs mt-1">{errors.anchorMonth.message}</p>
										)}
									</div>
								)}

								{/* Day-of-month picker — all intervals except weekly/biweekly */}
								{!isWeeklyBiweekly && (
									<div>
										<label className="label" htmlFor="rec-day">
											<span className="label-text text-sm">Day of month</span>
										</label>
										<select
											id="rec-day"
											aria-label="Day of month"
											className="select select-bordered w-full"
											{...register("dayOfMonth", { required: "Day is required" })}
										>
											{Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
												<option key={d} value={d.toString()}>
													{d}
												</option>
											))}
										</select>
										{errors.dayOfMonth && (
											<p className="text-error text-xs mt-1">{errors.dayOfMonth.message}</p>
										)}
									</div>
								)}
							</div>
							{/* Remaining occurrences — installment mode only */}
							{isInstallment && (
								<Input
									label="Remaining occurrences"
									id="rec-remaining"
									type="number"
									min="1"
									max="360"
									error={errors.remainingOccurrences?.message}
									{...register("remainingOccurrences", {
										required: "Required for installments",
										validate: (v) => {
											const n = parseInt(v, 10);
											return (n >= 1 && n <= 360) || "Must be 1-360";
										},
									})}
								/>
							)}
						</div>
					</div>

					{/* Actions — D-09: Discard left, Save right */}
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
							{isEdit ? "Save changes" : isInstallment ? "Add installment" : "Add subscription"}
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
