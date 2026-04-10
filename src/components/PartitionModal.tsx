import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useReducer } from "spacetimedb/react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers } from "../module_bindings";
import { Input } from "./Input";

interface PartitionFormValues {
	name: string;
	initialBalance: string;
	partitionType: string;
	creditLimit: string;
}

interface PartitionData {
	id: bigint;
	name: string;
	partitionType: string;
	creditLimitCentavos: bigint;
}

interface PartitionModalProps {
	accountId: bigint;
	isStandalone: boolean;
	onClose: () => void;
	partition?: PartitionData;
}

export function PartitionModal({
	accountId,
	isStandalone: _isStandalone,
	onClose,
	partition,
}: PartitionModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	const addPartition = useReducer(reducers.addPartition);
	const editPartitionReducer = useReducer(reducers.editPartition);
	const isEditMode = !!partition;
	const {
		register,
		handleSubmit,
		watch,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<PartitionFormValues>({
		defaultValues: partition
			? {
					name: partition.name,
					initialBalance: "",
					partitionType: partition.partitionType,
					creditLimit: (Number(partition.creditLimitCentavos) / 100).toFixed(2),
				}
			: { name: "", initialBalance: "", partitionType: "wallet", creditLimit: "" },
	});

	useEffect(() => {
		ref.current?.showModal();
	}, []);

	const nameValue = watch("name");
	const selectedType = watch("partitionType");

	const onSubmit = (data: PartitionFormValues) => {
		if (isEditMode && partition) {
			const creditLimitCentavos = data.creditLimit
				? BigInt(Math.round(parseFloat(data.creditLimit) * 100))
				: 0n;
			editPartitionReducer({
				partitionId: partition.id,
				newName: data.name.trim(),
				newCreditLimitCentavos: creditLimitCentavos,
			});
		} else {
			const initialCentavos = data.initialBalance
				? BigInt(Math.round(parseFloat(data.initialBalance) * 100))
				: 0n;
			const creditLimitCentavos =
				data.partitionType === "credit" && data.creditLimit
					? BigInt(Math.round(parseFloat(data.creditLimit) * 100))
					: 0n;
			addPartition({
				accountId,
				name: data.name.trim(),
				initialBalanceCentavos: data.partitionType === "credit" ? 0n : initialCentavos,
				partitionType: data.partitionType,
				creditLimitCentavos,
			});
		}
		reset();
		onClose();
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	useDragToDismiss(boxRef, handleClose);

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
			<div className="modal-box flex flex-col" ref={boxRef}>
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-semibold">
						{isEditMode ? "Edit partition" : "New partition"}
					</h3>
					<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
						<X size={16} />
					</button>
				</div>
				<form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col flex-1 min-h-0">
					<div className="flex-1 overflow-y-auto">
						<div className="flex flex-col gap-4">
							<Input
								label="Partition name"
								id="partition-name"
								error={errors.name?.message}
								placeholder="e.g. Ewallet, Savings, Time deposit"
								autoFocus
								{...register("name", { required: "Partition name is required" })}
							/>

							<div className="form-control">
								<label className="label" htmlFor="partitionType">
									<span className="label-text">Partition type</span>
								</label>
								<select
									id="partitionType"
									className="select select-bordered w-full"
									{...register("partitionType")}
									disabled={isEditMode}
								>
									<option value="wallet">Wallet</option>
									<option value="savings">Savings</option>
									<option value="time-deposit">Time Deposit</option>
									<option value="credit">Credit</option>
								</select>
							</div>

							{selectedType === "credit" && (
								<div className="form-control">
									<Input
										label="Credit limit (P)"
										id="creditLimit"
										type="number"
										step="0.01"
										min="0"
										placeholder="e.g. 120000.00"
										error={errors.creditLimit?.message}
										{...register("creditLimit", {
											required: selectedType === "credit" ? "Credit limit is required" : false,
											min: { value: 0, message: "Credit limit must be 0 or more" },
										})}
									/>
								</div>
							)}

							{!isEditMode && (
								<Input
									label="Initial balance (P)"
									id="partition-balance"
									type="number"
									step="0.01"
									min="0"
									placeholder="0.00"
									{...register("initialBalance")}
								/>
							)}
						</div>
					</div>

					{/* Submit — D-09: Cancel left, Save right */}
					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={handleClose}>
							Cancel
						</button>
						<button type="submit" className="btn btn-primary flex-1" disabled={isSubmitting}>
							{isEditMode
								? `Update ${nameValue.trim() || "partition"}`
								: `Save ${nameValue.trim() || "partition"}`}
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
