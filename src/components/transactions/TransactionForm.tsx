import { useEffect, useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import type { Tag, TagScope } from "../../hooks/useTags";
import type { Account } from "../../utils/accountBalances";
import { centavosToPesos, pesosToCentavos } from "../../utils/currency";
import {
	type TransactionInput,
	type TransactionType,
	validateTransaction,
} from "../../utils/transactionValidation";
import { TagPickerField } from "./TagPickerField";

export type TransactionFormValues = {
	type: TransactionType;
	amountPesos: number;
	tagId: string | null;
	fromAccountId: string | null;
	toAccountId: string | null;
	feePesos: number | null;
	description: string;
	date: string;
};

type Props = {
	mode: "create" | "edit";
	accounts: readonly Account[];
	tags: readonly Tag[];
	defaults: TransactionFormValues;
	submitError: string | null;
	isSubmitting: boolean;
	createTag: (name: string, type: Exclude<TagScope, "any">) => Promise<Tag | null>;
	onSubmit: (input: TransactionInput) => Promise<void> | void;
	onCancel: () => void;
};

/**
 * Shared form used by both the New and Edit transaction modals. The modal
 * shell owns persistence (supabase insert/update); this component only
 * collects and validates input, then hands the caller a normalised
 * `TransactionInput`.
 */
export function TransactionForm({
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
	} = useForm<TransactionFormValues>({ defaultValues: defaults });

	const type = watch("type");
	const tagId = watch("tagId");
	const fromAccountId = watch("fromAccountId");
	const toAccountId = watch("toAccountId");

	// Relocate a picked account when type changes, matching the spec's pre-fill
	// rule: expense/transfer use `from`, income uses `to`. We also scrub fields
	// that the new type doesn't use so validation can pass cleanly.
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
			// keep toAccountId
		} else if (lastType === "expense" && type === "transfer") {
			// keep fromAccountId, toAccountId starts blank
			setValue("toAccountId", null);
		} else if (lastType === "transfer" && type === "expense") {
			setValue("toAccountId", null);
			setValue("feePesos", null);
		} else if (lastType === "transfer" && type === "income") {
			setValue("fromAccountId", null);
			setValue("feePesos", null);
		}
		// Tag scope changed → clear tag.
		setValue("tagId", null);
		setLastType(type);
	}, [type, lastType, fromAccountId, toAccountId, setValue]);

	const submit: SubmitHandler<TransactionFormValues> = async (values) => {
		const input: TransactionInput = {
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
			date: values.date,
		};
		const check = validateTransaction(input);
		if (!check.ok) {
			// Fallback — real per-field errors come from RHF, this catches cross-field.
			alert(check.message);
			return;
		}
		await onSubmit(input);
	};

	const showFrom = type === "expense" || type === "transfer";
	const showTo = type === "income" || type === "transfer";
	const showFee = type === "transfer";

	// Show only non-archived accounts (archive rule from spec).
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
					autoFocus={mode === "create"}
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
					{watch("feePesos") != null && (watch("feePesos") as number) > 0 && fromAccountId && (
						<div className="label">
							<span className="label-text-alt text-base-content/60">
								A paired <code className="font-mono">transfer-fees</code> expense of ₱
								{(watch("feePesos") as number).toFixed(2)} will be recorded from{" "}
								{accounts.find((a) => a.id === fromAccountId)?.name ?? "source"}.
							</span>
						</div>
					)}
				</label>
			)}

			<label className="form-control">
				<div className="label">
					<span className="label-text">Description (optional)</span>
				</div>
				<input type="text" className="input input-bordered" {...register("description")} />
			</label>

			<label className="form-control">
				<div className="label">
					<span className="label-text">Date</span>
				</div>
				<input
					type="date"
					className="input input-bordered"
					{...register("date", { required: "Date is required" })}
				/>
				{errors.date && (
					<div className="label">
						<span className="label-text-alt text-error">{errors.date.message}</span>
					</div>
				)}
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

/** Helper for the modal shells to convert a DB row to form defaults. */
export function formDefaultsFromTransaction(
	tx: {
		type: TransactionType;
		amount_centavos: number;
		tag_id: string | null;
		from_account_id: string | null;
		to_account_id: string | null;
		fee_centavos: number | null;
		description: string | null;
		date: string;
	} | null,
	prefill?: Partial<TransactionFormValues>,
	todayISO?: string,
): TransactionFormValues {
	if (tx) {
		return {
			type: tx.type,
			amountPesos: centavosToPesos(tx.amount_centavos),
			tagId: tx.tag_id,
			fromAccountId: tx.from_account_id,
			toAccountId: tx.to_account_id,
			feePesos: tx.fee_centavos == null ? null : centavosToPesos(tx.fee_centavos),
			description: tx.description ?? "",
			date: tx.date,
		};
	}
	const today = todayISO ?? new Date().toISOString().slice(0, 10);
	return {
		type: "expense",
		amountPesos: 0,
		tagId: null,
		fromAccountId: null,
		toAccountId: null,
		feePesos: null,
		description: "",
		date: today,
		...prefill,
	};
}
