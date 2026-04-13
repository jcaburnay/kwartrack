import { Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Timestamp } from "spacetimedb";
import { useReducer, useTable } from "spacetimedb/react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers, tables } from "../module_bindings";
import { formatPesos } from "../utils/currency";
import { openAsModal } from "../utils/dialog";
import { Input } from "./Input";

const TAGS = [
	"foods",
	"grocery",
	"transportation",
	"online-shopping",
	"gadgets",
	"bills",
	"pets",
	"personal-care",
	"health",
	"digital-subscriptions",
	"entertainment",
	"clothing",
	"education",
	"travel",
	"housing",
	"insurance",
	"gifts",
];

interface SplitFormValues {
	description: string;
	totalAmount: string;
	tag: string;
	payerSubAccountId: string;
	date: string;
}

interface SplitModalProps {
	onClose: () => void;
}

export function SplitModal({ onClose }: SplitModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		openAsModal(ref.current);
	}, []);

	const createSplit = useReducer(reducers.createSplit);
	const [accounts] = useTable(tables.my_accounts);
	const [subAccounts] = useTable(tables.my_sub_accounts);
	const [participants, setParticipants] = useState<string[]>([""]);

	const today = new Date().toISOString().slice(0, 10);
	const {
		register,
		handleSubmit,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<SplitFormValues>({
		defaultValues: {
			description: "",
			totalAmount: "",
			tag: "",
			payerSubAccountId: "",
			date: today,
		},
	});

	const totalAmount = parseFloat(watch("totalAmount") || "0");
	const splitCount = participants.filter((p) => p.trim()).length + 1; // +1 for you
	const shareAmount = splitCount > 0 ? totalAmount / splitCount : 0;

	const addParticipant = () => setParticipants((prev) => [...prev, ""]);
	const removeParticipant = (index: number) =>
		setParticipants((prev) => prev.filter((_, i) => i !== index));
	const updateParticipant = (index: number, value: string) => {
		setParticipants((prev) => prev.map((p, i) => (i === index ? value : p)));
	};

	const onSubmit = async (values: SplitFormValues) => {
		const totalAmountCentavos = BigInt(Math.round(parseFloat(values.totalAmount) * 100));
		const payerSubAccountId = BigInt(values.payerSubAccountId);
		const dateTimestamp = Timestamp.fromDate(new Date(values.date));
		const participantNames = participants.filter((p) => p.trim());

		if (participantNames.length === 0) return;

		await createSplit({
			description: values.description.trim(),
			totalAmountCentavos,
			payerSubAccountId,
			tag: values.tag,
			date: dateTimestamp,
			participantNames,
		});
		onClose();
	};

	useDragToDismiss(boxRef, onClose);

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
			<div className="modal-box flex flex-col" ref={boxRef}>
				<div className="flex items-center justify-between mb-4">
					<h3 className="font-semibold text-sm">New split</h3>
					<button
						type="button"
						className="btn btn-ghost btn-xs btn-circle"
						onClick={onClose}
						aria-label="Close"
					>
						<X size={14} />
					</button>
				</div>

				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
					<div className="flex-1 overflow-y-auto">
						<div className="flex flex-col gap-3">
							{/* Description */}
							<Input
								label="Description"
								id="split-desc"
								type="text"
								error={errors.description?.message}
								{...register("description", {
									required: "Description is required",
									maxLength: { value: 120, message: "Max 120 characters" },
								})}
							/>

							{/* Total + Tag side by side */}
							<div className="grid sm:grid-cols-2 gap-3">
								<Input
									label="Total amount"
									id="split-amount"
									type="number"
									step="0.01"
									min="0.01"
									error={errors.totalAmount?.message}
									{...register("totalAmount", {
										required: "Amount is required",
										validate: (v) => parseFloat(v) > 0 || "Amount must be greater than 0",
									})}
								/>
								<div>
									<label className="label" htmlFor="split-tag">
										<span className="label-text text-sm">Tag</span>
									</label>
									<select
										id="split-tag"
										className={`select select-bordered w-full${errors.tag ? " select-error" : ""}`}
										{...register("tag", { required: "Tag is required" })}
									>
										<option value="">Select tag</option>
										{TAGS.map((tag) => (
											<option key={tag} value={tag}>
												{tag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
											</option>
										))}
									</select>
									{errors.tag && <p className="text-error text-xs mt-1">{errors.tag.message}</p>}
								</div>
							</div>

							{/* Partition + Date side by side */}
							<div className="grid sm:grid-cols-2 gap-3">
								<div>
									<label className="label" htmlFor="split-partition">
										<span className="label-text text-sm">Paid from</span>
									</label>
									<select
										id="split-partition"
										className={`select select-bordered w-full${errors.payerSubAccountId ? " select-error" : ""}`}
										{...register("payerSubAccountId", {
											required: "Sub-account is required",
											validate: (v) => v !== "" || "Sub-account is required",
										})}
									>
										<option value="">Select sub-account</option>
										{accounts.map((account) => {
											if (account.isStandalone) {
												const defaultPartition = subAccounts.find(
													(p) => p.accountId === account.id && p.isDefault,
												);
												if (!defaultPartition) return null;
												return (
													<optgroup key={account.id.toString()} label={account.name}>
														<option value={defaultPartition.id.toString()}>{account.name}</option>
													</optgroup>
												);
											}
											const accountPartitions = subAccounts.filter(
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
									{errors.payerSubAccountId && (
										<p className="text-error text-xs mt-1">{errors.payerSubAccountId.message}</p>
									)}
								</div>
								<div>
									<label className="label" htmlFor="split-date">
										<span className="label-text text-sm">Date</span>
									</label>
									<input
										id="split-date"
										type="date"
										className="input input-bordered w-full"
										{...register("date", { required: "Date is required" })}
									/>
								</div>
							</div>

							{/* Participants */}
							<div>
								<div className="label">
									<span className="label-text text-sm">
										Split with <span className="text-base-content/30">(equal split)</span>
									</span>
								</div>
								<div className="flex flex-col gap-2">
									{participants.map((name, i) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: participants are an ordered editable list; index is the stable identity
										<div key={i} className="flex items-center gap-2">
											<input
												type="text"
												placeholder="Name"
												className="input input-bordered input-sm flex-1"
												value={name}
												onChange={(e) => updateParticipant(i, e.target.value)}
											/>
											<span className="text-xs text-base-content/40 min-w-[70px] text-right">
												{shareAmount > 0 ? formatPesos(BigInt(Math.round(shareAmount * 100))) : "—"}
											</span>
											{participants.length > 1 && (
												<button
													type="button"
													className="btn btn-ghost btn-xs btn-circle"
													onClick={() => removeParticipant(i)}
												>
													<Trash2 size={12} className="text-error/70" />
												</button>
											)}
										</div>
									))}
								</div>
								<div className="flex justify-between items-center mt-2">
									<button
										type="button"
										className="text-xs text-primary cursor-pointer"
										onClick={addParticipant}
									>
										+ Add person
									</button>
									<span className="text-xs text-base-content/40">
										Your share:{" "}
										{shareAmount > 0 ? formatPesos(BigInt(Math.round(shareAmount * 100))) : "—"}
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* Actions */}
					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
							Discard
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							className="btn btn-primary flex-1 whitespace-nowrap"
						>
							{isSubmitting && <span className="loading loading-spinner loading-xs" />}
							Create split
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
