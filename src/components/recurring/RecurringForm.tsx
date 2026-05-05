import { useEffect, useState } from "react";
import { type SubmitHandler, useForm, useWatch } from "react-hook-form";
import type { Tag, TagScope } from "../../hooks/useTags";
import type { Account, AccountGroup } from "../../utils/accountBalances";
import { centavosToPesos, pesosToCentavos } from "../../utils/currency";
import {
	type RecurringInput,
	type RecurringInterval,
	validateRecurring,
} from "../../utils/recurringValidation";
import type { TransactionType } from "../../utils/transactionValidation";
import { AccountSelect } from "../accounts/AccountSelect";
import { TagPickerField } from "../transactions/TagPickerField";
import { SubmitButton } from "../ui/SubmitButton";

export type RecurringFormValues = {
	service: string;
	type: TransactionType;
	amountPesos: number;
	tagId: string | null;
	fromAccountId: string | null;
	toAccountId: string | null;
	feePesos: number | null;
	description: string;
	interval: RecurringInterval;
	firstOccurrenceDate: string;
	remainingOccurrences: number | null;
};

type Props = {
	mode: "create" | "edit";
	accounts: readonly Account[];
	groups: readonly AccountGroup[];
	tags: readonly Tag[];
	defaults: RecurringFormValues;
	submitError: string | null;
	isSubmitting: boolean;
	createTag: (name: string, type: Exclude<TagScope, "any">) => Promise<Tag | null>;
	onSubmit: (input: RecurringInput) => Promise<void> | void;
	onCancel: () => void;
};

const INTERVALS: { value: RecurringInterval; label: string }[] = [
	{ value: "weekly", label: "Weekly" },
	{ value: "monthly", label: "Monthly" },
	{ value: "quarterly", label: "Quarterly" },
	{ value: "semi_annual", label: "Semi-annual" },
	{ value: "annual", label: "Annual" },
];

export function RecurringForm({
	mode,
	accounts,
	groups,
	tags,
	defaults,
	submitError,
	isSubmitting,
	createTag,
	onSubmit,
	onCancel,
}: Props) {
	const {
		register,
		control,
		setValue,
		handleSubmit,
		formState: { errors, isSubmitting: rhfSubmitting },
	} = useForm<RecurringFormValues>({ defaultValues: defaults });

	const type = useWatch({ control, name: "type" });
	const tagId = useWatch({ control, name: "tagId" });
	const fromAccountId = useWatch({ control, name: "fromAccountId" });
	const toAccountId = useWatch({ control, name: "toAccountId" });

	// Mirror TransactionForm's account-relocation-on-type-change behaviour.
	const [lastType, setLastType] = useState<TransactionType>(defaults.type);
	useEffect(() => {
		if (type === lastType) return;
		if (lastType === "expense" && type === "income") {
			setValue("toAccountId", fromAccountId);
			setValue("fromAccountId", null);
		} else if (lastType === "income" && type === "expense") {
			setValue("fromAccountId", toAccountId);
			setValue("toAccountId", null);
		} else if (lastType === "income" && type === "transfer") {
			setValue("fromAccountId", null);
		} else if (lastType === "expense" && type === "transfer") {
			setValue("toAccountId", null);
		} else if (lastType === "transfer" && type === "expense") {
			setValue("toAccountId", null);
			setValue("feePesos", null);
		} else if (lastType === "transfer" && type === "income") {
			setValue("fromAccountId", null);
			setValue("feePesos", null);
		}
		setValue("tagId", null);
		setLastType(type);
	}, [type, lastType, fromAccountId, toAccountId, setValue]);

	const submit: SubmitHandler<RecurringFormValues> = async (values) => {
		const input: RecurringInput = {
			service: values.service,
			type: values.type,
			amountCentavos: pesosToCentavos(values.amountPesos || 0),
			tagId: values.tagId,
			fromAccountId: values.fromAccountId,
			toAccountId: values.toAccountId,
			feeCentavos:
				values.feePesos == null ||
				(typeof values.feePesos === "number" && !Number.isFinite(values.feePesos)) ||
				(values.feePesos as number) <= 0
					? null
					: pesosToCentavos(values.feePesos as number),
			description: values.description.trim(),
			date: values.firstOccurrenceDate,
			interval: values.interval,
			firstOccurrenceDate: values.firstOccurrenceDate,
			remainingOccurrences:
				values.remainingOccurrences == null ||
				(typeof values.remainingOccurrences === "number" &&
					!Number.isFinite(values.remainingOccurrences))
					? null
					: Number(values.remainingOccurrences),
		};
		const check = validateRecurring(input);
		if (!check.ok) {
			alert(check.message);
			return;
		}
		await onSubmit(input);
	};

	const showFrom = type === "expense" || type === "transfer";
	const showTo = type === "income" || type === "transfer";
	const showFee = type === "transfer";

	const pickableAccounts = accounts.filter((a) => !a.is_archived);

	return (
		<form
			onSubmit={(e) => {
				e.stopPropagation();
				handleSubmit(submit)(e);
			}}
			noValidate
			className="flex flex-col gap-3"
		>
			<div>
				<label className="floating-label">
					<span>Service</span>
					<input
						type="text"
						placeholder="e.g. Netflix"
						className="input input-bordered w-full"
						autoFocus={mode === "create"}
						{...register("service", {
							required: "Service name is required",
							maxLength: { value: 80, message: "80 characters or fewer" },
							validate: (v) => v.trim().length > 0 || "Service name is required",
						})}
					/>
				</label>
				{errors.service && <p className="mt-1 text-xs text-error">{errors.service.message}</p>}
			</div>

			<div role="toolbar" aria-label="Type" className="join w-full">
				{(
					[
						{ value: "expense", label: "Expense", activeClass: "btn-error" },
						{ value: "income", label: "Income", activeClass: "btn-success" },
						{ value: "transfer", label: "Transfer", activeClass: "btn-neutral" },
					] as const
				).map((opt) => {
					const active = type === opt.value;
					return (
						<button
							key={opt.value}
							type="button"
							aria-pressed={active}
							className={`btn join-item flex-1 border border-base-content/40 ${active ? opt.activeClass : "btn-ghost"}`}
							onClick={() => setValue("type", opt.value, { shouldDirty: true })}
						>
							{opt.label}
						</button>
					);
				})}
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<div>
					<label className="floating-label">
						<span>Amount (₱)</span>
						<input
							type="number"
							step="0.01"
							min="0"
							placeholder="0.00"
							className="input input-bordered w-full"
							{...register("amountPesos", {
								valueAsNumber: true,
								required: "Amount is required",
								min: { value: 0.01, message: "Amount must be greater than 0" },
							})}
						/>
					</label>
					{errors.amountPesos && (
						<p className="mt-1 text-xs text-error">{errors.amountPesos.message}</p>
					)}
				</div>

				<TagPickerField
					tags={tags}
					transactionType={type}
					value={tagId}
					onChange={(id) => setValue("tagId", id, { shouldDirty: true })}
					createInline={createTag}
					required={type !== "transfer"}
					errorMessage={
						type !== "transfer" && tagId == null && errors.tagId ? "Tag is required" : undefined
					}
				/>
			</div>

			{showFrom && showTo ? (
				<div className="flex items-center gap-2">
					<AccountSelect
						label="From account"
						placeholder="Select source…"
						value={fromAccountId}
						onChange={(id) => setValue("fromAccountId", id, { shouldDirty: true })}
						accounts={pickableAccounts}
						groups={groups}
						className="floating-label flex-1 min-w-0"
					/>
					<span aria-hidden className="text-base-content/50 shrink-0 px-1 text-lg leading-none">
						→
					</span>
					<AccountSelect
						label="To account"
						placeholder="Select destination…"
						value={toAccountId}
						onChange={(id) => setValue("toAccountId", id, { shouldDirty: true })}
						accounts={pickableAccounts}
						groups={groups}
						className="floating-label flex-1 min-w-0"
					/>
				</div>
			) : (
				<>
					{showFrom && (
						<AccountSelect
							label="From account"
							placeholder="Select source…"
							value={fromAccountId}
							onChange={(id) => setValue("fromAccountId", id, { shouldDirty: true })}
							accounts={pickableAccounts}
							groups={groups}
						/>
					)}

					{showTo && (
						<AccountSelect
							label="To account"
							placeholder="Select destination…"
							value={toAccountId}
							onChange={(id) => setValue("toAccountId", id, { shouldDirty: true })}
							accounts={pickableAccounts}
							groups={groups}
						/>
					)}
				</>
			)}

			{showFee && (
				<label className="floating-label">
					<span>Fee (₱, optional)</span>
					<input
						type="number"
						step="0.01"
						min="0"
						placeholder="0.00"
						className="input input-bordered w-full"
						{...register("feePesos", {
							setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
						})}
					/>
				</label>
			)}

			<label className="floating-label">
				<span>Description (optional)</span>
				<input
					type="text"
					placeholder="Description (optional)"
					className="input input-bordered w-full"
					{...register("description")}
				/>
			</label>

			<div className="grid grid-cols-2 gap-3">
				<label className="floating-label">
					<span>Interval</span>
					<select
						className="select select-bordered w-full"
						{...register("interval", { required: true })}
					>
						{INTERVALS.map((iv) => (
							<option key={iv.value} value={iv.value}>
								{iv.label}
							</option>
						))}
					</select>
				</label>

				<div>
					<label className="floating-label">
						<span>Schedule</span>
						<input
							type="date"
							className="input input-bordered w-full"
							{...register("firstOccurrenceDate", { required: "Schedule is required" })}
						/>
					</label>
					{errors.firstOccurrenceDate && (
						<p className="mt-1 text-xs text-error">{errors.firstOccurrenceDate.message}</p>
					)}
				</div>
			</div>

			<div>
				<label className="floating-label">
					<span>Remaining occurrences (optional)</span>
					<input
						type="number"
						min="1"
						step="1"
						placeholder="Leave empty for open-ended"
						className="input input-bordered w-full"
						{...register("remainingOccurrences", {
							setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
						})}
					/>
				</label>
				<p className="mt-1 text-xs text-base-content/60">
					Leave empty for an open-ended subscription. Set for installments.
				</p>
			</div>

			{submitError && <div className="alert alert-error text-sm">{submitError}</div>}

			<div className="-mx-4 px-4 py-3 border-t border-base-300 flex items-center justify-end gap-2">
				<button type="button" className="btn btn-ghost" onClick={onCancel}>
					Cancel
				</button>
				<SubmitButton
					type="submit"
					className="btn btn-primary"
					loading={isSubmitting || rhfSubmitting}
				>
					{mode === "create" ? "Create" : "Save"}
				</SubmitButton>
			</div>
		</form>
	);
}

export function formDefaultsFromRecurring(
	r: {
		service: string;
		type: TransactionType;
		amount_centavos: number;
		tag_id: string | null;
		from_account_id: string | null;
		to_account_id: string | null;
		fee_centavos: number | null;
		description: string | null;
		interval: RecurringInterval;
		first_occurrence_date: string;
		remaining_occurrences: number | null;
	} | null,
	prefill?: Partial<RecurringFormValues>,
	todayISO?: string,
): RecurringFormValues {
	if (r) {
		return {
			service: r.service,
			type: r.type,
			amountPesos: centavosToPesos(r.amount_centavos),
			tagId: r.tag_id,
			fromAccountId: r.from_account_id,
			toAccountId: r.to_account_id,
			feePesos: r.fee_centavos == null ? null : centavosToPesos(r.fee_centavos),
			description: r.description ?? "",
			interval: r.interval,
			firstOccurrenceDate: r.first_occurrence_date,
			remainingOccurrences: r.remaining_occurrences,
		};
	}
	const today = todayISO ?? new Date().toISOString().slice(0, 10);
	return {
		service: "",
		type: "expense",
		amountPesos: 0,
		tagId: null,
		fromAccountId: null,
		toAccountId: null,
		feePesos: null,
		description: "",
		interval: "monthly",
		firstOccurrenceDate: today,
		remainingOccurrences: null,
		...prefill,
	};
}
