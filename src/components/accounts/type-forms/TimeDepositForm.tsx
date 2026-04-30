import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../providers/AuthProvider";
import type { Account, AccountGroup } from "../../../utils/accountBalances";
import { centavosToPesos, pesosToCentavos } from "../../../utils/currency";
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
			<label className="form-control">
				<div className="label">
					<span className="label-text">Name</span>
				</div>
				<input
					type="text"
					className="input input-bordered"
					autoFocus
					{...register("name", {
						required: "Name is required",
						maxLength: { value: 50, message: "50 characters or fewer" },
					})}
				/>
				{errors.name && (
					<div className="label">
						<span className="label-text-alt text-error">{errors.name.message}</span>
					</div>
				)}
			</label>

			<label className="form-control">
				<div className="label">
					<span className="label-text">
						Principal (₱){mode === "edit" ? " — not editable" : ""}
					</span>
				</div>
				<input
					type="number"
					step="0.01"
					min="0.01"
					className="input input-bordered"
					disabled={mode === "edit"}
					{...register("principalPesos", {
						valueAsNumber: true,
						required: "Principal is required",
						min: { value: 0.01, message: "Must be greater than 0" },
					})}
				/>
				{errors.principalPesos && (
					<div className="label">
						<span className="label-text-alt text-error">{errors.principalPesos.message}</span>
					</div>
				)}
			</label>

			<label className="form-control">
				<div className="label">
					<span className="label-text">Interest rate (% per year)</span>
				</div>
				<input
					type="number"
					step="0.01"
					min="0.01"
					className="input input-bordered"
					{...register("interestRatePercent", {
						valueAsNumber: true,
						required: "Interest rate is required",
						min: { value: 0.01, message: "Must be greater than 0" },
					})}
				/>
				{errors.interestRatePercent && (
					<div className="label">
						<span className="label-text-alt text-error">{errors.interestRatePercent.message}</span>
					</div>
				)}
			</label>

			<label className="form-control">
				<div className="label">
					<span className="label-text">Maturity date</span>
				</div>
				<input
					type="date"
					className="input input-bordered"
					min={today}
					{...register("maturityDate", {
						required: "Maturity date is required",
						validate: (v) => v > today || "Must be in the future",
					})}
				/>
				{errors.maturityDate && (
					<div className="label">
						<span className="label-text-alt text-error">{errors.maturityDate.message}</span>
					</div>
				)}
			</label>

			<label className="form-control">
				<div className="label">
					<span className="label-text">Interest posts</span>
				</div>
				<select className="select select-bordered" {...register("interestPostingInterval")}>
					{INTERVALS.map((i) => (
						<option key={i.value} value={i.value}>
							{i.label}
						</option>
					))}
				</select>
			</label>

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
