import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";
import { Modal } from "../ui/Modal";
import { SubmitButton } from "../ui/SubmitButton";

type Form = { name: string };

type Props = {
	onCreated: (id: string) => void;
	onCancel: () => void;
};

export function NewGroupModal({ onCreated, onCancel }: Props) {
	const { user } = useAuth();
	const [submitError, setSubmitError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<Form>({ defaultValues: { name: "" } });

	const onSubmit: SubmitHandler<Form> = async (values) => {
		setSubmitError(null);
		if (!user) return;
		const { data, error } = await supabase
			.from("account_group")
			.insert({ user_id: user.id, name: values.name.trim() })
			.select("id")
			.single();
		if (error) {
			setSubmitError(error.message);
			return;
		}
		onCreated(data.id);
	};

	return (
		<Modal onClose={onCancel} size="sm">
			<Modal.Header title="New group" />
			<form
				onSubmit={(e) => {
					// Stop the inner form's submit from bubbling up to the surrounding
					// account form's React handler (React portals don't break event
					// propagation through the React tree).
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
							placeholder="e.g. Personal"
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
