import { useEffect, useState } from "react";
import { type SubmitHandler, useForm, useWatch } from "react-hook-form";
import type { Tag, TagScope } from "../../hooks/useTags";
import type { Account } from "../../utils/accountBalances";
import { centavosToPesos, PHP, pesosToCentavos } from "../../utils/currency";
import {
	type TransactionInput,
	type TransactionType,
	validateTransaction,
} from "../../utils/transactionValidation";
import { SubmitButton } from "../ui/SubmitButton";
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
		control,
		setValue,
		handleSubmit,
		formState: { errors, isSubmitting: rhfSubmitting },
	} = useForm<TransactionFormValues>({ defaultValues: defaults });

	const type = useWatch({ control, name: "type" });
	const tagId = useWatch({ control, name: "tagId" });
	const fromAccountId = useWatch({ control, name: "fromAccountId" });
	const toAccountId = useWatch({ control, name: "toAccountId" });
	const feePesos = useWatch({ control, name: "feePesos" });

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
							autoFocus={mode === "create"}
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
					<label className="floating-label flex-1 min-w-0">
						<span>From account</span>
						<select
							className="select select-bordered w-full"
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
					<span aria-hidden className="text-base-content/50 shrink-0 px-1 text-lg leading-none">
						→
					</span>
					<label className="floating-label flex-1 min-w-0">
						<span>To account</span>
						<select
							className="select select-bordered w-full"
							value={toAccountId ?? ""}
							onChange={(e) =>
								setValue("toAccountId", e.target.value || null, { shouldDirty: true })
							}
						>
							<option value="">Select destination…</option>
							{pickableAccounts.map((a) => (
								<option key={a.id} value={a.id}>
									{a.name}
								</option>
							))}
						</select>
					</label>
				</div>
			) : (
				<>
					{showFrom && (
						<label className="floating-label">
							<span>From account</span>
							<select
								className="select select-bordered w-full"
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
						<label className="floating-label">
							<span>To account</span>
							<select
								className="select select-bordered w-full"
								value={toAccountId ?? ""}
								onChange={(e) =>
									setValue("toAccountId", e.target.value || null, { shouldDirty: true })
								}
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
				</>
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

			{showFee ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
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
						{feePesos != null && (feePesos as number) > 0 && fromAccountId && (
							<p className="mt-1 text-xs text-base-content/60">
								A paired <code className="font-mono">transfer-fees</code> expense of{" "}
								<span className="tabular-nums">{PHP.format(feePesos as number)}</span> will be
								recorded from {accounts.find((a) => a.id === fromAccountId)?.name ?? "source"}.
							</p>
						)}
					</div>

					<div>
						<label className="floating-label">
							<span>Date</span>
							<input
								type="date"
								className="input input-bordered w-full"
								{...register("date", { required: "Date is required" })}
							/>
						</label>
						{errors.date && <p className="mt-1 text-xs text-error">{errors.date.message}</p>}
					</div>
				</div>
			) : (
				<div>
					<label className="floating-label">
						<span>Date</span>
						<input
							type="date"
							className="input input-bordered w-full"
							{...register("date", { required: "Date is required" })}
						/>
					</label>
					{errors.date && <p className="mt-1 text-xs text-error">{errors.date.message}</p>}
				</div>
			)}

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
