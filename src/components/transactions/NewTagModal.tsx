import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import type { Tag, TagScope } from "../../hooks/useTags";
import { Modal } from "../ui/Modal";

type Form = { name: string };

type Props = {
	scope: Exclude<TagScope, "any">;
	create: (name: string, type: Exclude<TagScope, "any">) => Promise<Tag | null>;
	onCreated: (tag: Tag) => void;
	onCancel: () => void;
};

export function NewTagModal({ scope, create, onCreated, onCancel }: Props) {
	const [submitError, setSubmitError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<Form>({ defaultValues: { name: "" } });

	const onSubmit: SubmitHandler<Form> = async (values) => {
		setSubmitError(null);
		const tag = await create(values.name, scope);
		if (!tag) {
			setSubmitError("Could not create tag — name may already be taken.");
			return;
		}
		onCreated(tag);
	};

	return (
		<Modal onClose={onCancel} size="sm">
			<Modal.Header title={`New ${scope} tag`} />
			<form
				onSubmit={(e) => {
					e.stopPropagation();
					handleSubmit(onSubmit)(e);
				}}
				noValidate
				className="flex flex-col gap-3"
			>
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
							validate: (v) => v.trim().length > 0 || "Name is required",
						})}
					/>
					{errors.name && (
						<div className="label">
							<span className="label-text-alt text-error">{errors.name.message}</span>
						</div>
					)}
				</label>
				{submitError && <div className="alert alert-error text-sm">{submitError}</div>}
				<div className="flex items-center justify-end gap-2 pt-2 mt-3">
					<button type="button" className="btn btn-ghost" onClick={onCancel}>
						Cancel
					</button>
					<button type="submit" className="btn btn-primary" disabled={isSubmitting}>
						{isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Create"}
					</button>
				</div>
			</form>
		</Modal>
	);
}
