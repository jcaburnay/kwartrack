import { Minus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Timestamp } from "spacetimedb";
import { useReducer, useTable } from "spacetimedb/react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { reducers, tables } from "../module_bindings";
import { formatPesos } from "../utils/currency";
import { openAsModal } from "../utils/dialog";
import { getVisibleTags } from "../utils/tagConfig";
import { Input } from "./Input";

type SplitMethod = "equal" | "exact" | "percentage" | "shares";

interface ParticipantInput {
	participantId: bigint;
	name: string;
	shareAmount: string;
	sharePercentage: string;
	shareCount: number;
}

interface EditTarget {
	splitEvent: {
		id: bigint;
		description: string;
		totalAmountCentavos: bigint;
		payerSubAccountId: bigint;
		tag: string;
		date: { microsSinceUnixEpoch: bigint };
		splitMethod?: string;
	};
	participants: {
		participantId: bigint;
		name: string;
		shareAmountCentavos: bigint;
		shareCount: number;
	}[];
}

interface SplitFormValues {
	description: string;
	totalAmount: string;
	tag: string;
	payerSubAccountId: string;
	date: string;
}

interface SplitModalProps {
	onClose: () => void;
	editTarget?: EditTarget;
}

function toDateInputValue(ts: { microsSinceUnixEpoch: bigint }): string {
	return new Date(Number(ts.microsSinceUnixEpoch / 1000n)).toISOString().slice(0, 10);
}

export function SplitModal({ onClose, editTarget }: SplitModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		openAsModal(ref.current);
	}, []);

	const createSplit = useReducer(reducers.createSplit);
	const editSplit = useReducer(reducers.editSplit);
	const [accounts] = useTable(tables.my_accounts);
	const [subAccounts] = useTable(tables.my_sub_accounts);
	const [tagConfigs] = useTable(tables.my_tag_configs);
	const expenseTags = getVisibleTags("expense", tagConfigs);

	const isEditMode = !!editTarget;
	const initialMethod: SplitMethod =
		(editTarget?.splitEvent.splitMethod as SplitMethod | undefined) ?? "equal";

	const [splitMethod, setSplitMethod] = useState<SplitMethod>(initialMethod);
	const [participants, setParticipants] = useState<ParticipantInput[]>(
		editTarget
			? editTarget.participants.map((p) => ({
					participantId: p.participantId,
					name: p.name,
					shareAmount: (Number(p.shareAmountCentavos) / 100).toFixed(2),
					sharePercentage: "",
					shareCount: p.shareCount > 0 ? p.shareCount : 1,
				}))
			: [{ participantId: 0n, name: "", shareAmount: "", sharePercentage: "", shareCount: 1 }],
	);
	const [participantsError, setParticipantsError] = useState<string | null>(null);

	const today = new Date().toISOString().slice(0, 10);
	const {
		register,
		handleSubmit,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<SplitFormValues>({
		defaultValues: {
			description: editTarget?.splitEvent.description ?? "",
			totalAmount: editTarget
				? (Number(editTarget.splitEvent.totalAmountCentavos) / 100).toFixed(2)
				: "",
			tag: editTarget?.splitEvent.tag ?? "",
			payerSubAccountId: editTarget?.splitEvent.payerSubAccountId.toString() ?? "",
			date: editTarget ? toDateInputValue(editTarget.splitEvent.date) : today,
		},
	});

	const totalAmountFloat = parseFloat(watch("totalAmount") || "0");
	const totalCentavos = BigInt(Math.round(totalAmountFloat * 100));

	// Compute total shares (for "shares" mode)
	const totalShares = participants.reduce((s, p) => s + p.shareCount, 0) + 1;

	// "Your share" display value
	function yourShareCentavos(): bigint {
		const validParticipants = participants.filter((p) => p.name.trim());
		const count = validParticipants.length + 1;
		if (splitMethod === "equal") return totalCentavos / BigInt(count);
		if (splitMethod === "exact") {
			const sum = validParticipants.reduce(
				(s, p) => s + BigInt(Math.round(parseFloat(p.shareAmount || "0") * 100)),
				0n,
			);
			return totalCentavos - sum;
		}
		if (splitMethod === "percentage") {
			const sumPct = validParticipants.reduce(
				(s, p) => s + parseFloat(p.sharePercentage || "0"),
				0,
			);
			return BigInt(Math.round(((100 - sumPct) / 100) * Number(totalCentavos)));
		}
		// shares
		return BigInt(Math.round((1 / totalShares) * Number(totalCentavos)));
	}

	function getParticipantShareCentavos(p: ParticipantInput): bigint {
		const count = participants.filter((pp) => pp.name.trim()).length + 1;
		if (splitMethod === "equal") return totalCentavos / BigInt(count);
		if (splitMethod === "exact") return BigInt(Math.round(parseFloat(p.shareAmount || "0") * 100));
		if (splitMethod === "percentage")
			return BigInt(
				Math.round((parseFloat(p.sharePercentage || "0") / 100) * Number(totalCentavos)),
			);
		// shares
		return BigInt(Math.round((p.shareCount / totalShares) * Number(totalCentavos)));
	}

	// Validation helpers
	function validateShares(): string | null {
		const valid = participants.filter((p) => p.name.trim());
		if (valid.length === 0) return "At least one participant name is required";
		if (splitMethod === "exact") {
			const sum = valid.reduce(
				(s, p) => s + BigInt(Math.round(parseFloat(p.shareAmount || "0") * 100)),
				0n,
			);
			if (sum > totalCentavos) return "Participant shares exceed the total amount";
		}
		if (splitMethod === "percentage") {
			const sum = valid.reduce((s, p) => s + parseFloat(p.sharePercentage || "0"), 0);
			if (sum > 100) return "Participant percentages exceed 100%";
		}
		return null;
	}

	const addParticipant = () =>
		setParticipants((prev) => [
			...prev,
			{ participantId: 0n, name: "", shareAmount: "", sharePercentage: "", shareCount: 1 },
		]);
	const removeParticipant = (index: number) =>
		setParticipants((prev) => prev.filter((_, i) => i !== index));
	const updateParticipant = (index: number, patch: Partial<ParticipantInput>) => {
		setParticipants((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
		setParticipantsError(null);
	};

	const onSubmit = async (values: SplitFormValues) => {
		const error = validateShares();
		if (error) {
			setParticipantsError(error);
			return;
		}

		const totalAmountCentavos = BigInt(Math.round(parseFloat(values.totalAmount) * 100));
		const payerSubAccountId = BigInt(values.payerSubAccountId);
		const dateTimestamp = Timestamp.fromDate(new Date(values.date));
		const validParticipants = participants.filter((p) => p.name.trim());

		const participantNames = validParticipants.map((p) => p.name.trim());
		const participantShares = validParticipants.map((p) => getParticipantShareCentavos(p));
		const participantShareCounts = validParticipants.map((p) =>
			splitMethod === "shares" ? p.shareCount : 0,
		);

		if (isEditMode && editTarget) {
			await editSplit({
				splitEventId: editTarget.splitEvent.id,
				description: values.description.trim(),
				totalAmountCentavos,
				payerSubAccountId,
				tag: values.tag,
				date: dateTimestamp,
				splitMethod,
				participantIds: validParticipants.map((p) => p.participantId),
				participantNames,
				participantShares,
				participantShareCounts,
			});
		} else {
			await createSplit({
				description: values.description.trim(),
				totalAmountCentavos,
				payerSubAccountId,
				tag: values.tag,
				date: dateTimestamp,
				splitMethod,
				participantNames,
				participantShares,
				participantShareCounts,
			});
		}
		onClose();
	};

	useDragToDismiss(boxRef, onClose);

	const SPLIT_METHODS: { key: SplitMethod; label: string }[] = [
		{ key: "equal", label: "Equal" },
		{ key: "exact", label: "Exact" },
		{ key: "percentage", label: "%" },
		{ key: "shares", label: "Shares" },
	];

	// Sub-account selector — shared between create and edit
	function SubAccountSelect({ fieldName }: { fieldName: "payerSubAccountId" }) {
		return (
			<div>
				<label className="label" htmlFor="split-partition">
					<span className="label-text text-sm">Paid from</span>
				</label>
				<select
					id="split-partition"
					className={`select select-bordered w-full${errors[fieldName] ? " select-error" : ""}`}
					{...register(fieldName, {
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
				{errors[fieldName] && (
					<p className="text-error text-xs mt-1">{errors[fieldName]?.message}</p>
				)}
			</div>
		);
	}

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
			<div className="modal-box flex flex-col" ref={boxRef}>
				<div className="flex items-center justify-between mb-4">
					<h3 className="font-semibold text-sm">{isEditMode ? "Edit split" : "New split"}</h3>
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

							{/* Total + Tag */}
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
										{expenseTags.map((tag) => (
											<option key={tag} value={tag}>
												{tag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
											</option>
										))}
									</select>
									{errors.tag && <p className="text-error text-xs mt-1">{errors.tag.message}</p>}
								</div>
							</div>

							{/* Partition + Date */}
							<div className="grid sm:grid-cols-2 gap-3">
								<SubAccountSelect fieldName="payerSubAccountId" />
								<div>
									<label className="label" htmlFor="split-date">
										<span className="label-text text-sm">Date</span>
									</label>
									<input
										id="split-date"
										type="date"
										className={`input input-bordered w-full${errors.date ? " input-error" : ""}`}
										{...register("date", { required: "Date is required" })}
									/>
									{errors.date && <p className="text-error text-xs mt-1">{errors.date.message}</p>}
								</div>
							</div>

							{/* Split method tabs */}
							<div>
								<div className="label">
									<span className="label-text text-sm">Split method</span>
								</div>
								<div className="flex gap-1 bg-base-200/60 rounded-lg p-1">
									{SPLIT_METHODS.map(({ key, label }) => (
										<button
											key={key}
											type="button"
											className={`flex-1 btn btn-xs rounded-md ${splitMethod === key ? "btn-primary" : "btn-ghost"}`}
											onClick={() => setSplitMethod(key)}
										>
											{label}
										</button>
									))}
								</div>
							</div>

							{/* Participants */}
							<div>
								<div className="label">
									<span className="label-text text-sm">Split with</span>
								</div>
								<div className="flex flex-col gap-2">
									{participants.map((p, i) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: ordered editable list
										<div key={i} className="flex items-center gap-2">
											<input
												type="text"
												placeholder="Name"
												className="input input-bordered input-sm flex-1"
												value={p.name}
												onChange={(e) => updateParticipant(i, { name: e.target.value })}
											/>

											{splitMethod === "exact" && (
												<input
													type="number"
													step="0.01"
													min="0"
													placeholder="Amount"
													className="input input-bordered input-sm w-24"
													value={p.shareAmount}
													onChange={(e) => updateParticipant(i, { shareAmount: e.target.value })}
												/>
											)}
											{splitMethod === "percentage" && (
												<input
													type="number"
													step="0.1"
													min="0"
													max="100"
													placeholder="%"
													className="input input-bordered input-sm w-16"
													value={p.sharePercentage}
													onChange={(e) =>
														updateParticipant(i, { sharePercentage: e.target.value })
													}
												/>
											)}
											{splitMethod === "shares" && (
												<div className="flex items-center gap-1">
													<button
														type="button"
														className="btn btn-ghost btn-xs btn-circle"
														onClick={() =>
															updateParticipant(i, {
																shareCount: Math.max(1, p.shareCount - 1),
															})
														}
													>
														<Minus size={10} />
													</button>
													<input
														type="number"
														min="1"
														placeholder="Shares"
														className="input input-bordered input-sm w-14 text-center"
														value={p.shareCount}
														onChange={(e) =>
															updateParticipant(i, {
																shareCount: Math.max(1, parseInt(e.target.value, 10) || 1),
															})
														}
													/>
													<button
														type="button"
														className="btn btn-ghost btn-xs btn-circle"
														onClick={() => updateParticipant(i, { shareCount: p.shareCount + 1 })}
													>
														<Plus size={10} />
													</button>
												</div>
											)}

											{/* Computed share display for non-exact methods */}
											{splitMethod !== "exact" && (
												<span className="text-xs text-base-content/40 min-w-[70px] text-right">
													{totalCentavos > 0n && p.name.trim()
														? formatPesos(getParticipantShareCentavos(p))
														: "—"}
												</span>
											)}

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
										Your share: {totalCentavos > 0n ? formatPesos(yourShareCentavos()) : "—"}
									</span>
								</div>
								{participantsError && (
									<p className="text-error text-xs mt-1">{participantsError}</p>
								)}
							</div>
						</div>
					</div>

					{/* Actions */}
					<div className="flex gap-2 mt-4">
						<button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							className="btn btn-primary flex-1 whitespace-nowrap"
						>
							{isSubmitting && <span className="loading loading-spinner loading-xs" />}
							{isEditMode ? "Save changes" : "Create split"}
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
