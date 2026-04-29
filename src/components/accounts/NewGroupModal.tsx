import { useState } from "react";
import { createPortal } from "react-dom";
import { type SubmitHandler, useForm } from "react-hook-form";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";

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

	return createPortal(
		<div
			className="modal modal-open"
			role="dialog"
			aria-modal="true"
			aria-labelledby="new-group-title"
		>
			<div className="modal-box max-w-sm">
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
					<h3 id="new-group-title" className="font-semibold text-lg">
						New group
					</h3>
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
					<div className="modal-action">
						<button type="button" className="btn btn-ghost" onClick={onCancel}>
							Cancel
						</button>
						<button type="submit" className="btn btn-primary" disabled={isSubmitting}>
							{isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Create"}
						</button>
					</div>
				</form>
			</div>
			<button
				type="button"
				className="modal-backdrop"
				onClick={onCancel}
				aria-label="Dismiss modal"
			/>
		</div>,
		document.body,
	);
}
