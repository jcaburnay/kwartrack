import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../providers/AuthProvider";
import type { Account, AccountGroup } from "../../../utils/accountBalances";
import { centavosToPesos, pesosToCentavos } from "../../../utils/currency";
import { SubmitButton } from "../../ui/SubmitButton";
import { GroupPickerField } from "../GroupPickerField";

type Interval = "monthly" | "quarterly" | "semi-annual" | "annual" | "at-maturity";

type Form = {
	name: string;
	principalPesos: number;
	interestRatePercent: number;
	maturityDate: string;
	interestPostingInterval: Interval;
	groupId: string | null;
};

type Props = {
	mode: "create" | "edit";
	initial?: Account;
	groups: readonly AccountGroup[];
	onRefetchGroups: () => Promise<void>;
	onSaved: () => void;
	onCancel: () => void;
};

const INTERVALS: { value: Interval; label: string }[] = [
	{ value: "monthly", label: "Monthly" },
	{ value: "quarterly", label: "Quarterly" },
	{ value: "semi-annual", label: "Semi-annual" },
	{ value: "annual", label: "Annual" },
	{ value: "at-maturity", label: "At maturity" },
];

export function TimeDepositForm({
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
			principalPesos:
				initial && initial.principal_centavos != null
					? centavosToPesos(initial.principal_centavos)
					: 0,
			interestRatePercent:
				initial && initial.interest_rate_bps != null ? initial.interest_rate_bps / 100 : 0,
			maturityDate: initial?.maturity_date ?? "",
			interestPostingInterval: (initial?.interest_posting_interval as Interval | null) ?? "monthly",
			groupId: initial?.group_id ?? null,
		},
	});

	const groupId = watch("groupId");
	const today = new Date().toISOString().slice(0, 10);

	const onSubmit: SubmitHandler<Form> = async (values) => {
		setSubmitError(null);
		if (!user) return;
		const principalCentavos = pesosToCentavos(values.principalPesos || 0);
		const bps = Math.round(values.interestRatePercent * 100);

		if (mode === "create") {
			const { error } = await supabase.from("account").insert({
				user_id: user.id,
				name: values.name.trim(),
				type: "time-deposit",
				initial_balance_centavos: principalCentavos,
				principal_centavos: principalCentavos,
				interest_rate_bps: bps,
				maturity_date: values.maturityDate,
				interest_posting_interval: values.interestPostingInterval,
				group_id: values.groupId,
			});
			if (error) return setSubmitError(error.message);
		} else if (initial) {
			const { error } = await supabase
				.from("account")
				.update({
					name: values.name.trim(),
					interest_rate_bps: bps,
					maturity_date: values.maturityDate,
					interest_posting_interval: values.interestPostingInterval,
					group_id: values.groupId,
				})
				.eq("id", initial.id);
			if (error) return setSubmitError(error.message);
		}
		onSaved();
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<div>
					<label className="floating-label">
						<span>Name</span>
						<input
							type="text"
							placeholder="e.g. BPI 6-month TD"
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

				<GroupPickerField
					groups={groups}
					value={groupId}
					onChange={(id) => setValue("groupId", id, { shouldDirty: true })}
					onRefetchGroups={onRefetchGroups}
				/>
			</div>

			<div>
				<label className="floating-label">
					<span>Principal (₱){mode === "edit" ? " — not editable" : ""}</span>
					<input
						type="number"
						step="0.01"
						min="0.01"
						placeholder="0.00"
						className="input input-bordered w-full"
						disabled={mode === "edit"}
						{...register("principalPesos", {
							valueAsNumber: true,
							required: "Principal is required",
							min: { value: 0.01, message: "Must be greater than 0" },
						})}
					/>
				</label>
				{errors.principalPesos && (
					<p className="mt-1 text-xs text-error">{errors.principalPesos.message}</p>
				)}
			</div>

			<div>
				<label className="floating-label">
					<span>Interest rate (% per year)</span>
					<input
						type="number"
						step="0.01"
						min="0.01"
						placeholder="0.00"
						className="input input-bordered w-full"
						{...register("interestRatePercent", {
							valueAsNumber: true,
							required: "Interest rate is required",
							min: { value: 0.01, message: "Must be greater than 0" },
						})}
					/>
				</label>
				{errors.interestRatePercent && (
					<p className="mt-1 text-xs text-error">{errors.interestRatePercent.message}</p>
				)}
			</div>

			<div>
				<label className="floating-label">
					<span>Maturity date</span>
					<input
						type="date"
						className="input input-bordered w-full"
						min={today}
						{...register("maturityDate", {
							required: "Maturity date is required",
							validate: (v) => v > today || "Must be in the future",
						})}
					/>
				</label>
				{errors.maturityDate && (
					<p className="mt-1 text-xs text-error">{errors.maturityDate.message}</p>
				)}
			</div>

			<label className="floating-label">
				<span>Interest posts</span>
				<select className="select select-bordered w-full" {...register("interestPostingInterval")}>
					{INTERVALS.map((i) => (
						<option key={i.value} value={i.value}>
							{i.label}
						</option>
					))}
				</select>
			</label>

			{submitError && <div className="alert alert-error text-sm">{submitError}</div>}

			<div className="-mx-4 px-4 py-3 border-t border-base-300 flex items-center justify-end gap-2">
				<button type="button" className="btn btn-ghost" onClick={onCancel}>
					Cancel
				</button>
				<SubmitButton type="submit" className="btn btn-primary" loading={isSubmitting}>
					{mode === "create" ? "Create" : "Save"}
				</SubmitButton>
			</div>
		</form>
	);
}
