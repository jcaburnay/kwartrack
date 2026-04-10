import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useReducer, useTable } from "spacetimedb/react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers, tables } from "../module_bindings";
import { formatPesos } from "../utils/currency";
import { Input } from "./Input";

interface Debt {
	id: bigint;
	personName: string;
	direction: string;
	amountCentavos: bigint;
	settledAmountCentavos: bigint;
	tag: string;
	partitionId: bigint;
	description: string;
	splitEventId: bigint;
}

interface SettleFormValues {
	amount: string;
	partitionId: string;
}

interface SettleModalProps {
	debt: Debt;
	onClose: () => void;
}

export function SettleModal({ debt, onClose }: SettleModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		ref.current?.showModal();
	}, []);

	const settleDebt = useReducer(reducers.settleDebt);
	const [accounts] = useTable(tables.my_accounts);
	const [partitions] = useTable(tables.my_partitions);

	const remaining = Number(debt.amountCentavos - debt.settledAmountCentavos) / 100;

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<SettleFormValues>({
		defaultValues: { amount: remaining.toFixed(2), partitionId: "" },
	});

	const onSubmit = async (values: SettleFormValues) => {
		const amountCentavos = BigInt(Math.round(parseFloat(values.amount) * 100));
		const partitionId = BigInt(values.partitionId);

		await settleDebt({
			debtId: debt.id,
			amountCentavos,
			partitionId,
		});
		onClose();
	};

	const label = debt.direction === "loaned" ? "Receive to" : "Pay from";

	useDragToDismiss(boxRef, onClose);

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
			<div className="modal-box flex flex-col" ref={boxRef}>
				<div className="flex items-center justify-between mb-4">
					<h3 className="font-semibold text-sm">Settle — {debt.personName}</h3>
					<button
						type="button"
						className="btn btn-ghost btn-xs btn-circle"
						onClick={onClose}
						aria-label="Close"
					>
						<X size={14} />
					</button>
				</div>

				<p className="text-xs text-base-content/50 mb-3">
					Remaining: {formatPesos(debt.amountCentavos - debt.settledAmountCentavos)}
				</p>

				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
					<div className="grid sm:grid-cols-2 gap-3">
						<Input
							label="Settlement amount"
							id="settle-amount"
							type="number"
							step="0.01"
							min="0.01"
							max={remaining}
							error={errors.amount?.message}
							{...register("amount", {
								required: "Amount is required",
								validate: (v) => {
									const n = parseFloat(v);
									if (n <= 0) return "Must be greater than 0";
									if (n > remaining) return `Cannot exceed ${remaining.toFixed(2)}`;
									return true;
								},
							})}
						/>
						<div>
							<label className="label" htmlFor="settle-partition">
								<span className="label-text text-sm">{label}</span>
							</label>
							<select
								id="settle-partition"
								className={`select select-bordered w-full${errors.partitionId ? " select-error" : ""}`}
								{...register("partitionId", {
									required: "Partition is required",
									validate: (v) => v !== "" || "Partition is required",
								})}
							>
								<option value="">Select partition</option>
								{accounts.map((account) => {
									if (account.isStandalone) {
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
									const accountPartitions = partitions.filter(
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
							{errors.partitionId && (
								<p className="text-error text-xs mt-1">{errors.partitionId.message}</p>
							)}
						</div>
					</div>

					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							className="btn btn-success flex-1 whitespace-nowrap"
						>
							{isSubmitting && <span className="loading loading-spinner loading-xs" />}
							Settle
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
