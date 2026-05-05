import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import type { Tag, TagScope } from "../../hooks/useTags";
import { Modal } from "../ui/Modal";
import { SubmitButton } from "../ui/SubmitButton";

type TagType = Exclude<TagScope, "any">;

type Form = {
	name: string;
	type: TagType;
};

type Props = {
	create: (name: string, type: TagType) => Promise<Tag | null>;
	onCreated: () => void;
	onCancel: () => void;
};

export function CreateTagModal({ create, onCreated, onCancel }: Props) {
	const [submitError, setSubmitError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<Form>({ defaultValues: { name: "", type: "expense" } });

	const onSubmit: SubmitHandler<Form> = async (values) => {
		setSubmitError(null);
		const tag = await create(values.name, values.type);
		if (!tag) {
			setSubmitError("Could not create tag — name may already be taken for this type.");
			return;
		}
		onCreated();
	};

	return (
		<Modal onClose={onCancel} size="sm">
			<Modal.Header title="New tag" />
			<form
				onSubmit={(e) => {
					e.stopPropagation();
					handleSubmit(onSubmit)(e);
				}}
				noValidate
				className="flex flex-col gap-3"
			>
				<div>
					<label className="floating-label">
						<span>Name</span>
						<input
							type="text"
							placeholder="e.g. rent"
							className="input input-bordered w-full"
							autoFocus
							{...register("name", {
								required: "Name is required",
								maxLength: { value: 50, message: "50 characters or fewer" },
								validate: (v) => v.trim().length > 0 || "Name is required",
							})}
						/>
					</label>
					{errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
				</div>
				<label className="floating-label">
					<span>Type</span>
					<select
						className="select select-bordered w-full"
						{...register("type", { required: true })}
					>
						<option value="expense">Expense</option>
						<option value="income">Income</option>
						<option value="transfer">Transfer</option>
					</select>
				</label>
				{submitError && <div className="alert alert-error text-sm">{submitError}</div>}
				<div className="-mx-4 px-4 py-3 border-t border-base-300 flex items-center justify-end gap-2">
					<button type="button" className="btn btn-ghost" onClick={onCancel}>
						Cancel
					</button>
					<SubmitButton type="submit" className="btn btn-primary" loading={isSubmitting}>
						Create
					</SubmitButton>
				</div>
			</form>
		</Modal>
	);
}
