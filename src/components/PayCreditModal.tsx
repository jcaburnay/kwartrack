import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Timestamp } from "spacetimedb";
import { useReducer, useTable } from "spacetimedb/react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers, tables } from "../module_bindings";
import { formatPesos } from "../utils/currency";
import { openAsModal } from "../utils/dialog";
import { getVisibleTags } from "../utils/tagConfig";
import { Input } from "./Input";

interface PayCreditModalProps {
	subAccountId: bigint;
	outstandingCentavos: bigint;
	onClose: () => void;
}

interface PayCreditFormValues {
	payFromSubAccountId: string;
	amount: string;
	serviceFee: string;
}

export function PayCreditModal({
	subAccountId,
	outstandingCentavos,
	onClose,
}: PayCreditModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	const createTransaction = useReducer(reducers.createTransaction);
	const [allSubAccounts] = useTable(tables.my_sub_accounts);
	const [tagConfigs] = useTable(tables.my_tag_configs);
	const transferTags = getVisibleTags("transfer", tagConfigs);
	// Preserve the old "bills" categorization only if the user explicitly created it
	// as a transfer tag. Otherwise use the first visible transfer tag or the sentinel.
	const transferTag = transferTags.includes("bills") ? "bills" : (transferTags[0] ?? "transfer");

	// Only show non-credit, non-default sub-accounts in pay-from selector
	const payFromSubAccounts = allSubAccounts.filter(
		(p) => !p.isDefault && p.subAccountType !== "credit",
	);

	const defaultValues: PayCreditFormValues = {
		payFromSubAccountId: "",
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
		openAsModal(dialogRef.current);
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
			sourceSubAccountId: BigInt(data.payFromSubAccountId),
			destinationSubAccountId: subAccountId,
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

	useDragToDismiss(boxRef, handleClose);

	return (
		<dialog ref={dialogRef} className="modal modal-bottom md:modal-middle" onClose={handleClose}>
			<div className="modal-box flex flex-col" ref={boxRef}>
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
						<label className="label" htmlFor="payFromSubAccountId">
							<span className="label-text">Pay from</span>
						</label>
						{payFromSubAccounts.length === 0 ? (
							<p className="text-sm text-base-content/60">
								No source sub-accounts available. Create a wallet or savings sub-account first.
							</p>
						) : (
							<select
								id="payFromSubAccountId"
								className="select select-bordered w-full"
								{...register("payFromSubAccountId", { required: "Source sub-account is required" })}
							>
								<option value="">Select sub-account</option>
								{payFromSubAccounts.map((p) => (
									<option key={p.id.toString()} value={p.id.toString()}>
										{p.name} ({formatPesos(p.balanceCentavos)})
									</option>
								))}
							</select>
						)}
						{errors.payFromSubAccountId && (
							<span className="text-error text-sm mt-1">{errors.payFromSubAccountId.message}</span>
						)}
					</div>

					{/* Amount */}
					<Input
						label="Amount"
						id="payAmount"
						type="number"
						step="0.01"
						min="0.01"
						error={errors.amount?.message}
						hint={
							<span className="text-sm text-base-content/60 mt-1">
								Paying <span className="font-mono">{formatPesos(outstandingCentavos)}</span> clears
								your balance
							</span>
						}
						{...register("amount", {
							required: "Amount is required",
							min: { value: 0.01, message: "Amount must be greater than 0" },
						})}
					/>

					{/* Service fee */}
					<Input
						label="Service fee (P)"
						id="serviceFee"
						type="number"
						step="0.01"
						min="0"
						placeholder="0.00"
						{...register("serviceFee")}
					/>

					{/* Buttons — dismiss left, submit right (Phase 1000 modal convention) */}
					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={handleClose}>
							Keep balance
						</button>
						<button
							type="submit"
							className="btn btn-primary flex-1"
							disabled={isSubmitting || payFromSubAccounts.length === 0}
						>
							Confirm payment
						</button>
					</div>
				</form>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="button" aria-label="Close modal" onClick={handleClose} />
			</form>
		</dialog>
	);
}
