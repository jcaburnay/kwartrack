import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";

type SignUpFormValues = {
	displayName: string;
	email: string;
	password: string;
};

function detectTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Manila";
	} catch {
		return "Asia/Manila";
	}
}

function mapAuthError(message: string): string {
	const m = message.toLowerCase();
	if (m.includes("already registered") || m.includes("user already")) {
		return "An account already exists for this email. Try signing in instead.";
	}
	if (m.includes("password") && (m.includes("weak") || m.includes("short"))) {
		return "That password is too weak. Use at least 6 characters.";
	}
	if (m.includes("rate limit") || m.includes("too many")) {
		return "Too many attempts. Wait a moment and try again.";
	}
	if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch")) {
		return "Couldn't reach the server. Check your connection and try again.";
	}
	return "Something went wrong. Try again.";
}

type Props = {
	/** Notify the parent that sign-up succeeded but the user needs to confirm
	 *  their email before a session is granted. The parent can then swap the
	 *  card to a "Check your email" view. */
	onCheckEmail: () => void;
};

export function SignUpForm({ onCheckEmail }: Props) {
	const { setSessionOptimistically } = useAuth();
	const navigate = useNavigate();
	const [submitError, setSubmitError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<SignUpFormValues>({
		defaultValues: { displayName: "", email: "", password: "" },
	});

	const onSubmit: SubmitHandler<SignUpFormValues> = async (values) => {
		setSubmitError(null);
		const { data, error } = await supabase.auth.signUp({
			email: values.email,
			password: values.password,
			options: {
				data: {
					display_name: values.displayName.trim(),
					timezone: detectTimezone(),
				},
			},
		});

		if (error) {
			// biome-ignore lint/suspicious/noConsole: keep raw Supabase message for debugging while showing a friendly mapped error to the user.
			console.warn("supabase signUp:", error.message);
			setSubmitError(mapAuthError(error.message));
			return;
		}

		if (data.session) {
			setSessionOptimistically(data.session);
			navigate("/", { replace: true });
			return;
		}

		// Email-confirmation flow (prod) — no session yet; user must click the link.
		onCheckEmail();
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
			<div className="flex flex-col gap-1">
				<label className="floating-label">
					<span>Display name</span>
					<input
						type="text"
						placeholder="Display name: John Doe"
						autoComplete="name"
						className="input input-bordered w-full"
						aria-invalid={Boolean(errors.displayName)}
						{...register("displayName", {
							required: "Display name is required",
							minLength: { value: 1, message: "Display name is required" },
							maxLength: {
								value: 50,
								message: "Display name must be 50 characters or fewer",
							},
						})}
					/>
				</label>
				{errors.displayName && (
					<span className="text-xs text-error px-1">{errors.displayName.message}</span>
				)}
			</div>

			<div className="flex flex-col gap-1">
				<label className="floating-label">
					<span>Email</span>
					<input
						type="email"
						placeholder="Email: you@example.com"
						autoComplete="email"
						className="input input-bordered w-full"
						aria-invalid={Boolean(errors.email)}
						{...register("email", {
							required: "Email is required",
							pattern: {
								value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
								message: "Enter a valid email",
							},
						})}
					/>
				</label>
				{errors.email && <span className="text-xs text-error px-1">{errors.email.message}</span>}
			</div>

			<div className="flex flex-col gap-1">
				<label className="floating-label">
					<span>Password</span>
					<input
						type="password"
						placeholder="Password: at least 6 characters"
						autoComplete="new-password"
						className="input input-bordered w-full"
						aria-invalid={Boolean(errors.password)}
						{...register("password", {
							required: "Password is required",
							minLength: { value: 6, message: "Password must be at least 6 characters" },
						})}
					/>
				</label>
				{errors.password && (
					<span className="text-xs text-error px-1">{errors.password.message}</span>
				)}
			</div>

			{submitError && <div className="alert alert-error text-sm">{submitError}</div>}

			<button type="submit" className="btn btn-cta" disabled={isSubmitting}>
				{isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Sign up"}
			</button>
		</form>
	);
}
