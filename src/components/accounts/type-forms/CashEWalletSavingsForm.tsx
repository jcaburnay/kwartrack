import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../providers/AuthProvider";
import type { Account, AccountGroup, AccountType } from "../../../utils/accountBalances";
import { centavosToPesos, pesosToCentavos } from "../../../utils/currency";
import { GroupPickerField } from "../GroupPickerField";

type Form = {
	name: string;
	initialBalancePesos: number;
	groupId: string | null;
};

type Props = {
	type: Extract<AccountType, "cash" | "e-wallet" | "savings">;
	mode: "create" | "edit";
	initial?: Account;
	groups: readonly AccountGroup[];
	onRefetchGroups: () => Promise<void>;
	onSaved: () => void;
	onCancel: () => void;
};

export function CashEWalletSavingsForm({
	type,
	mode,
	initial,
	groups,
	onRefetchGroups,
	onSaved,
	onCancel,
}: Props) {
	const { user } = useAuth();
	const [submitError, setSubmitError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		watch,
		setValue,
		formState: { errors, isSubmitting },
	} = useForm<Form>({
		defaultValues: {
			name: initial?.name ?? "",
			initialBalancePesos: initial ? centavosToPesos(initial.initial_balance_centavos) : 0,
			groupId: initial?.group_id ?? null,
		},
	});

	const groupId = watch("groupId");

	const onSubmit: SubmitHandler<Form> = async (values) => {
		setSubmitError(null);
		if (!user) return;
		if (mode === "create") {
			const { error } = await supabase.from("account").insert({
				user_id: user.id,
				name: values.name.trim(),
				type,
				initial_balance_centavos: pesosToCentavos(values.initialBalancePesos || 0),
				group_id: values.groupId,
			});
			if (error) return setSubmitError(error.message);
		} else if (initial) {
			const { error } = await supabase
				.from("account")
				.update({ name: values.name.trim(), group_id: values.groupId })
				.eq("id", initial.id);
			if (error) return setSubmitError(error.message);
		}
		onSaved();
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
			<div>
				<label className="floating-label">
					<span>Name</span>
					<input
						type="text"
						placeholder="e.g. Wallet"
						className="input input-bordered w-full"
						autoFocus
						{...register("name", {
							required: "Name is required",
							maxLength: { value: 50, message: "50 characters or fewer" },
						})}
					/>
				</label>
				{errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
			</div>

			<div>
				<label className="floating-label">
					<span>Initial balance (₱){mode === "edit" ? " — not editable" : ""}</span>
					<input
						type="number"
						step="0.01"
						min="0"
						placeholder="0.00"
						className="input input-bordered w-full"
						disabled={mode === "edit"}
						{...register("initialBalancePesos", {
							valueAsNumber: true,
							required: "Initial balance is required",
							min: { value: 0, message: "Must be 0 or more" },
						})}
					/>
				</label>
				{errors.initialBalancePesos && (
					<p className="mt-1 text-xs text-error">{errors.initialBalancePesos.message}</p>
				)}
			</div>

			<GroupPickerField
				groups={groups}
				value={groupId}
				onChange={(id) => setValue("groupId", id, { shouldDirty: true })}
				onRefetchGroups={onRefetchGroups}
			/>

			{submitError && <div className="alert alert-error text-sm">{submitError}</div>}

			<div className="-mx-4 px-4 py-3 mt-4 border-t border-base-300 flex items-center justify-end gap-2">
				<button type="button" className="btn btn-ghost" onClick={onCancel}>
					Cancel
				</button>
				<button type="submit" className="btn btn-primary" disabled={isSubmitting}>
					{isSubmitting ? (
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
