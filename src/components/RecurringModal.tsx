import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useReducer, useTable } from "spacetimedb/react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers, tables } from "../module_bindings";
import { type CatalogEntry, filterCatalog, getLogoUrl } from "../utils/subscriptionCatalog";
import { getVisibleTags } from "../utils/tagConfig";

interface RecurringDefinition {
	id: bigint;
	name: string;
	type: string;
	amountCentavos: bigint;
	tag: string;
	partitionId: bigint;
	dayOfMonth: number;
	isPaused: boolean;
	remainingMonths: number;
	totalMonths: number;
}

interface RecurringFormValues {
	name: string;
	type: "expense" | "income";
	amount: string;
	tag: string;
	partitionId: string;
	dayOfMonth: string;
	remainingMonths: string;
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
		ref.current?.showModal();
	}, []);
	const createRecurring = useReducer(reducers.createRecurringDefinition);
	const editRecurring = useReducer(reducers.editRecurringDefinition);
	const [accounts] = useTable(tables.my_accounts);
	const [partitions] = useTable(tables.my_partitions);
	const [tagConfigs] = useTable(tables.my_tag_configs);
	const isEdit = !!definition;
	const effectiveMode = isEdit
		? definition.totalMonths > 0
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
				partitionId: definition.partitionId.toString(),
				dayOfMonth: definition.dayOfMonth.toString(),
				remainingMonths: definition.remainingMonths ? definition.remainingMonths.toString() : "",
			}
		: {
				name: "",
				type: "expense",
				amount: "",
				tag: "",
				partitionId: "",
				dayOfMonth: "1",
				remainingMonths: "",
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
	const selectedTag = watch("tag");
	const nameValue = watch("name");
	const [suggestionsOpen, setSuggestionsOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const suggestions = useMemo(() => {
		setActiveIndex(-1);
		return isInstallment ? [] : filterCatalog(nameValue);
	}, [nameValue, isInstallment]);

	const { onChange: nameOnChange, ...nameFieldProps } = register("name", {
		required: "Name is required",
		maxLength: { value: 80, message: "Max 80 characters" },
	});

	// When type changes, reset tag to empty string (tags differ by type)
	const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setValue("type", e.target.value as "expense" | "income");
		setValue("tag", "");
	};

	const onSubmit = async (values: RecurringFormValues) => {
		const amountCentavos = BigInt(Math.round(parseFloat(values.amount) * 100));
		const partitionId = BigInt(values.partitionId);
		const dayOfMonth = parseInt(values.dayOfMonth, 10);
		const remainingMonths = values.remainingMonths ? parseInt(values.remainingMonths, 10) : 0;

		if (isEdit && definition) {
			await editRecurring({
				definitionId: definition.id,
				name: values.name.trim(),
				type: values.type,
				amountCentavos,
				tag: values.tag,
				partitionId,
				dayOfMonth,
				remainingMonths,
			});
		} else {
			await createRecurring({
				name: values.name.trim(),
				type: values.type,
				amountCentavos,
				tag: values.tag,
				partitionId,
				dayOfMonth,
				remainingMonths,
				totalMonths: remainingMonths,
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
							{/* Name with catalog autocomplete */}
							<div>
								<label className="label" htmlFor="rec-name">
									<span className="label-text text-sm">Name</span>
								</label>
								<div className="relative">
									<input
										id="rec-name"
										type="text"
										autoComplete="off"
										className={`input input-bordered w-full${errors.name ? " input-error" : ""}`}
										{...nameFieldProps}
										onChange={(e) => {
											nameOnChange(e);
											setSuggestionsOpen(true);
										}}
										onFocus={() => setSuggestionsOpen(true)}
										onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
										onKeyDown={(e) => {
											if (!suggestionsOpen || suggestions.length === 0) return;
											if (e.key === "ArrowDown") {
												e.preventDefault();
												setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
											} else if (e.key === "ArrowUp") {
												e.preventDefault();
												setActiveIndex((i) => Math.max(i - 1, -1));
											} else if (e.key === "Enter" && activeIndex >= 0) {
												e.preventDefault();
												setValue("name", suggestions[activeIndex].name, { shouldValidate: true });
												setSuggestionsOpen(false);
												setActiveIndex(-1);
											} else if (e.key === "Escape") {
												setSuggestionsOpen(false);
												setActiveIndex(-1);
											}
										}}
									/>
									{suggestionsOpen && suggestions.length > 0 && (
										<ul className="absolute z-50 top-full mt-1 left-0 right-0 bg-base-100 border border-base-300/70 rounded-xl shadow-lg overflow-hidden">
											{suggestions.map((entry: CatalogEntry, idx: number) => (
												<li key={entry.domain + entry.name}>
													<button
														type="button"
														className={`flex items-center gap-3 px-3 py-2 w-full transition-colors text-left${idx === activeIndex ? " bg-base-200" : " hover:bg-base-200"}`}
														onMouseDown={(e) => {
															e.preventDefault();
															setValue("name", entry.name, { shouldValidate: true });
															setSuggestionsOpen(false);
															setActiveIndex(-1);
														}}
														onMouseEnter={() => setActiveIndex(idx)}
													>
														<img
															src={getLogoUrl(entry.domain)}
															alt=""
															className="w-5 h-5 rounded-sm flex-shrink-0 object-contain"
															onError={(e) => {
																e.currentTarget.style.display = "none";
															}}
														/>
														<span className="text-sm">{entry.name}</span>
													</button>
												</li>
											))}
										</ul>
									)}
								</div>
								{errors.name && <p className="text-error text-xs mt-1">{errors.name.message}</p>}
							</div>

							{/* Amount + Tag side by side */}
							<div className="grid sm:grid-cols-2 gap-3">
								<div>
									<label className="label" htmlFor="rec-amount">
										<span className="label-text text-sm">Amount</span>
									</label>
									<input
										id="rec-amount"
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
												{tag}
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
											{selectedType === "expense" ? "Source partition" : "Destination partition"}
										</span>
									</label>
									<PartitionGroupedSelect
										id="rec-partition"
										value={watch("partitionId")}
										onChange={(v) => setValue("partitionId", v)}
										error={errors.partitionId?.message}
										accounts={accounts}
										partitions={partitions}
									/>
									<input
										type="hidden"
										{...register("partitionId", {
											required: "Partition is required",
											validate: (v) => v !== "" || "Partition is required",
										})}
									/>
									{errors.partitionId && (
										<p className="text-error text-xs mt-1">{errors.partitionId.message}</p>
									)}
								</div>
							</div>

							{/* Day of month + Remaining months side by side */}
							<div className={`grid ${isInstallment ? "sm:grid-cols-2" : ""} gap-3`}>
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
								{isInstallment && (
									<div>
										<label className="label" htmlFor="rec-remaining">
											<span className="label-text text-sm">Remaining months</span>
										</label>
										<input
											id="rec-remaining"
											type="number"
											min="1"
											max="360"
											className={`input input-bordered w-full${errors.remainingMonths ? " input-error" : ""}`}
											{...register("remainingMonths", {
												required: "Required for installments",
												validate: (v) => {
													const n = parseInt(v, 10);
													return (n >= 1 && n <= 360) || "Must be 1-360";
												},
											})}
										/>
										{errors.remainingMonths && (
											<p className="text-error text-xs mt-1">{errors.remainingMonths.message}</p>
										)}
									</div>
								)}
							</div>
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
