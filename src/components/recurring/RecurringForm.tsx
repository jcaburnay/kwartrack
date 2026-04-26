import { useEffect, useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import type { Tag, TagScope } from "../../hooks/useTags";
import type { Account } from "../../utils/accountBalances";
import { centavosToPesos, pesosToCentavos } from "../../utils/currency";
import {
	type RecurringInput,
	type RecurringInterval,
	validateRecurring,
} from "../../utils/recurringValidation";
import type { TransactionType } from "../../utils/transactionValidation";
import { TagPickerField } from "../transactions/TagPickerField";

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
		watch,
		setValue,
		handleSubmit,
		formState: { errors, isSubmitting: rhfSubmitting },
	} = useForm<RecurringFormValues>({ defaultValues: defaults });

	const type = watch("type");
	const tagId = watch("tagId");
	const fromAccountId = watch("fromAccountId");
	const toAccountId = watch("toAccountId");

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
			<label className="form-control">
				<div className="label">
					<span className="label-text">Service</span>
				</div>
				<input
					type="text"
					className="input input-bordered"
					autoFocus={mode === "create"}
					{...register("service", {
						required: "Service name is required",
						maxLength: { value: 80, message: "80 characters or fewer" },
						validate: (v) => v.trim().length > 0 || "Service name is required",
					})}
				/>
				{errors.service && (
					<div className="label">
						<span className="label-text-alt text-error">{errors.service.message}</span>
					</div>
				)}
			</label>

			<div className="form-control">
				<div className="label">
					<span className="label-text">Type</span>
				</div>
				<div role="tablist" className="tabs tabs-box">
					{(["expense", "income", "transfer"] as const).map((t) => (
						<button
							key={t}
							type="button"
							role="tab"
							className={`tab ${type === t ? "tab-active" : ""}`}
							onClick={() => setValue("type", t, { shouldDirty: true })}
						>
							{t[0].toUpperCase() + t.slice(1)}
						</button>
					))}
				</div>
			</div>

			<label className="form-control">
				<div className="label">
					<span className="label-text">Amount (₱)</span>
				</div>
				<input
					type="number"
					step="0.01"
					min="0"
					className="input input-bordered"
					{...register("amountPesos", {
						valueAsNumber: true,
						required: "Amount is required",
						min: { value: 0.01, message: "Amount must be greater than 0" },
					})}
				/>
				{errors.amountPesos && (
					<div className="label">
						<span className="label-text-alt text-error">{errors.amountPesos.message}</span>
					</div>
				)}
			</label>

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

			{showFrom && (
				<label className="form-control">
					<div className="label">
						<span className="label-text">From account</span>
					</div>
					<select
						className="select select-bordered"
						value={fromAccountId ?? ""}
						onChange={(e) =>
							setValue("fromAccountId", e.target.value || null, { shouldDirty: true })
						}
					>
						<option value="">Select source…</option>
						{pickableAccounts.map((a) => (
							<option key={a.id} value={a.id}>
								{a.name}
							</option>
						))}
					</select>
				</label>
			)}

			{showTo && (
				<label className="form-control">
					<div className="label">
						<span className="label-text">To account</span>
					</div>
					<select
						className="select select-bordered"
						value={toAccountId ?? ""}
						onChange={(e) => setValue("toAccountId", e.target.value || null, { shouldDirty: true })}
					>
						<option value="">Select destination…</option>
						{pickableAccounts.map((a) => (
							<option key={a.id} value={a.id}>
								{a.name}
							</option>
						))}
					</select>
				</label>
			)}

			{showFee && (
				<label className="form-control">
					<div className="label">
						<span className="label-text">Fee (₱, optional)</span>
					</div>
					<input
						type="number"
						step="0.01"
						min="0"
						className="input input-bordered"
						{...register("feePesos", {
							setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
						})}
					/>
				</label>
			)}

			<label className="form-control">
				<div className="label">
					<span className="label-text">Description (optional)</span>
				</div>
				<input type="text" className="input input-bordered" {...register("description")} />
			</label>

			<div className="grid grid-cols-2 gap-3">
				<label className="form-control">
					<div className="label">
						<span className="label-text">Interval</span>
					</div>
					<select className="select select-bordered" {...register("interval", { required: true })}>
						{INTERVALS.map((iv) => (
							<option key={iv.value} value={iv.value}>
								{iv.label}
							</option>
						))}
					</select>
				</label>

				<label className="form-control">
					<div className="label">
						<span className="label-text">Schedule</span>
					</div>
					<input
						type="date"
						className="input input-bordered"
						{...register("firstOccurrenceDate", { required: "Schedule is required" })}
					/>
					{errors.firstOccurrenceDate && (
						<div className="label">
							<span className="label-text-alt text-error">
								{errors.firstOccurrenceDate.message}
							</span>
						</div>
					)}
				</label>
			</div>

			<label className="form-control">
				<div className="label">
					<span className="label-text">Remaining occurrences (optional)</span>
				</div>
				<input
					type="number"
					min="1"
					step="1"
					className="input input-bordered"
					{...register("remainingOccurrences", {
						setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
					})}
				/>
				<div className="label">
					<span className="label-text-alt text-base-content/60">
						Leave empty for an open-ended subscription. Set for installments.
					</span>
				</div>
			</label>

			{submitError && <div className="alert alert-error text-sm">{submitError}</div>}

			<div className="modal-action">
				<button type="button" className="btn btn-ghost" onClick={onCancel}>
					Cancel
				</button>
				<button type="submit" className="btn btn-primary" disabled={isSubmitting || rhfSubmitting}>
					{isSubmitting || rhfSubmitting ? (
						<span className="loading loading-spinner loading-sm" />
					) : mode === "create" ? (
						"Create"
					) : (
						"Save"
					)}
				</button>
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
