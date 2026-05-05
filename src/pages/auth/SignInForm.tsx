import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";

type SignInFormValues = {
	email: string;
	password: string;
};

function mapAuthError(message: string): string {
	const m = message.toLowerCase();
	if (m.includes("invalid login") || m.includes("invalid credentials")) {
		return "Email or password is incorrect.";
	}
	if (m.includes("email not confirmed")) {
		return "Confirm your email before signing in. Check your inbox for the link.";
	}
	if (m.includes("rate limit") || m.includes("too many")) {
		return "Too many attempts. Wait a moment and try again.";
	}
	if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch")) {
		return "Couldn't reach the server. Check your connection and try again.";
	}
	return "Something went wrong. Try again.";
}

export function SignInForm() {
	const { setSessionOptimistically } = useAuth();
	const navigate = useNavigate();
	const [submitError, setSubmitError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<SignInFormValues>({
		defaultValues: { email: "", password: "" },
	});

	const onSubmit: SubmitHandler<SignInFormValues> = async (values) => {
		setSubmitError(null);
		const { data, error } = await supabase.auth.signInWithPassword({
			email: values.email,
			password: values.password,
		});

		if (error) {
			// biome-ignore lint/suspicious/noConsole: keep raw Supabase message for debugging while showing a friendly mapped error to the user.
			console.warn("supabase signInWithPassword:", error.message);
			setSubmitError(mapAuthError(error.message));
			return;
		}

		if (data.session) {
			setSessionOptimistically(data.session);
			navigate("/", { replace: true });
		}
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
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
						placeholder="Password: ••••••••"
						autoComplete="current-password"
						className="input input-bordered w-full"
						aria-invalid={Boolean(errors.password)}
						{...register("password", { required: "Password is required" })}
					/>
				</label>
				{errors.password && (
					<span className="text-xs text-error px-1">{errors.password.message}</span>
				)}
			</div>

			{submitError && <div className="alert alert-error text-sm">{submitError}</div>}

			<button type="submit" className="btn btn-cta" disabled={isSubmitting}>
				{isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Sign in"}
			</button>
		</form>
	);
}
