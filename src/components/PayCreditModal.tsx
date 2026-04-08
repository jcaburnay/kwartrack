import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Timestamp } from "spacetimedb";
import { useReducer, useTable } from "spacetimedb/react";
import { reducers, tables } from "../module_bindings";
import { formatPesos } from "../utils/currency";
import { getVisibleTags } from "../utils/tagConfig";

interface PayCreditModalProps {
	partitionId: bigint;
	outstandingCentavos: bigint;
	onClose: () => void;
}

interface PayCreditFormValues {
	payFromPartitionId: string;
	amount: string;
	serviceFee: string;
}

export function PayCreditModal({ partitionId, outstandingCentavos, onClose }: PayCreditModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const createTransaction = useReducer(reducers.createTransaction);
	const [allPartitions] = useTable(tables.my_partitions);
	const [tagConfigs] = useTable(tables.my_tag_configs);
	const transferTags = getVisibleTags("transfer", tagConfigs);
	// Preserve the old "bills" categorization only if the user explicitly created it
	// as a transfer tag. Otherwise use the first visible transfer tag or the sentinel.
	const transferTag = transferTags.includes("bills") ? "bills" : (transferTags[0] ?? "transfer");

	// Only show non-credit, non-default partitions in pay-from selector
	// partitionType is a typed string on the partition row after pnpm generate (Plan 02)
	const payFromPartitions = allPartitions.filter(
		(p) => !p.isDefault && p.partitionType !== "credit",
	);

	const defaultValues: PayCreditFormValues = {
		payFromPartitionId: "",
		amount: (Number(outstandingCentavos) / 100).toFixed(2),
		serviceFee: "",
	};

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<PayCreditFormValues>({ defaultValues });

	useEffect(() => {
		dialogRef.current?.showModal();
	}, []);

	const onSubmit = (data: PayCreditFormValues) => {
		const amountCentavos = BigInt(Math.round(parseFloat(data.amount) * 100));
		const serviceFeeCentavos = data.serviceFee
			? BigInt(Math.round(parseFloat(data.serviceFee) * 100))
			: 0n;
		createTransaction({
			type: "transfer",
			amountCentavos,
			tag: transferTag,
			sourcePartitionId: BigInt(data.payFromPartitionId),
			destinationPartitionId: partitionId,
			serviceFeeCentavos,
			description: "Credit payment",
			date: Timestamp.fromDate(new Date()),
		});
		reset();
		onClose();
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	return (
		<dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onClose={handleClose}>
			<div className="modal-box flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-base font-semibold">Pay Credit</h3>
					<button
						type="button"
						className="btn btn-ghost btn-sm btn-circle"
						onClick={handleClose}
						aria-label="Close"
					>
						<X size={16} />
					</button>
				</div>

				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 flex-1">
					{/* Pay from selector */}
					<div className="form-control">
						<label className="label" htmlFor="payFromPartitionId">
							<span className="label-text">Pay from</span>
						</label>
						{payFromPartitions.length === 0 ? (
							<p className="text-sm text-base-content/60">
								No source partitions available. Create a wallet or savings partition first.
							</p>
						) : (
							<select
								id="payFromPartitionId"
								className="select select-bordered w-full"
								{...register("payFromPartitionId", { required: "Source partition is required" })}
							>
								<option value="">Select partition</option>
								{payFromPartitions.map((p) => (
									<option key={p.id.toString()} value={p.id.toString()}>
										{p.name} ({formatPesos(p.balanceCentavos)})
									</option>
								))}
							</select>
						)}
						{errors.payFromPartitionId && (
							<span className="text-error text-sm mt-1">{errors.payFromPartitionId.message}</span>
						)}
					</div>

					{/* Amount */}
					<div className="form-control">
						<label className="label" htmlFor="payAmount">
							<span className="label-text">Amount</span>
						</label>
						<input
							id="payAmount"
							type="number"
							step="0.01"
							min="0.01"
							className="input input-bordered w-full"
							{...register("amount", {
								required: "Amount is required",
								min: { value: 0.01, message: "Amount must be greater than 0" },
							})}
						/>
						<span className="text-sm text-base-content/50 mt-1">
							Paying <span className="font-mono">{formatPesos(outstandingCentavos)}</span> clears
							your balance
						</span>
						{errors.amount && (
							<span className="text-error text-sm mt-1">{errors.amount.message}</span>
						)}
					</div>

					{/* Service fee */}
					<div className="form-control">
						<label className="label" htmlFor="serviceFee">
							<span className="label-text">Service fee (P)</span>
						</label>
						<input
							id="serviceFee"
							type="number"
							step="0.01"
							min="0"
							className="input input-bordered w-full"
							placeholder="0.00"
							{...register("serviceFee")}
						/>
					</div>

					{/* Buttons — dismiss left, submit right (Phase 1000 modal convention) */}
					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={handleClose}>
							Keep balance
						</button>
						<button
							type="submit"
							className="btn btn-primary flex-1"
							disabled={isSubmitting || payFromPartitions.length === 0}
						>
							Confirm payment
						</button>
					</div>
				</form>
			</div>
		</dialog>
	);
}
