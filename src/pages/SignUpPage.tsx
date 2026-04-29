import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

type SignUpForm = {
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

export function SignUpPage() {
	const { session, isLoading, setSessionOptimistically } = useAuth();
	const navigate = useNavigate();
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [checkEmail, setCheckEmail] = useState(false);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<SignUpForm>({
		defaultValues: { displayName: "", email: "", password: "" },
	});

	if (!isLoading && session) return <Navigate to="/" replace />;

	const onSubmit: SubmitHandler<SignUpForm> = async (values) => {
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
			// Seed context before navigating so ProtectedRoute doesn't bounce.
			setSessionOptimistically(data.session);
			navigate("/", { replace: true });
			return;
		}

		// Email-confirmation flow (prod) — no session yet; user must click the link.
		setCheckEmail(true);
	};

	if (checkEmail) {
		return (
			<main className="min-h-dvh flex items-center justify-center bg-base-200 p-6">
				<div className="card bg-base-100 shadow-md max-w-md w-full">
					<div className="card-body items-center text-center gap-3">
						<h2 className="card-title">Check your email</h2>
						<p className="text-base-content/70">
							We sent a confirmation link. Click it to finish signing up.
						</p>
						<div className="flex items-center gap-2 mt-2">
							<button
								type="button"
								className="btn btn-ghost btn-sm"
								onClick={() => {
									reset();
									setSubmitError(null);
									setCheckEmail(false);
								}}
							>
								Use a different email
							</button>
							<Link to="/signin" className="btn btn-ghost btn-sm">
								Back to sign in
							</Link>
						</div>
					</div>
				</div>
			</main>
		);
	}

	return (
		<main className="min-h-dvh flex items-center justify-center bg-base-200 p-6">
			<div className="card bg-base-100 shadow-md max-w-md w-full">
				<form className="card-body gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
					<h1 className="card-title text-2xl">Create your account</h1>

					<label className="form-control">
						<div className="label">
							<span className="label-text">Display name</span>
						</div>
						<input
							type="text"
							autoComplete="name"
							className="input input-bordered"
							aria-invalid={Boolean(errors.displayName)}
							{...register("displayName", {
								required: "Display name is required",
								minLength: { value: 1, message: "Display name is required" },
								maxLength: { value: 50, message: "Display name must be 50 characters or fewer" },
							})}
						/>
						{errors.displayName && (
							<div className="label">
								<span className="label-text-alt text-error">{errors.displayName.message}</span>
							</div>
						)}
					</label>

					<label className="form-control">
						<div className="label">
							<span className="label-text">Email</span>
						</div>
						<input
							type="email"
							autoComplete="email"
							className="input input-bordered"
							aria-invalid={Boolean(errors.email)}
							{...register("email", {
								required: "Email is required",
								pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
							})}
						/>
						{errors.email && (
							<div className="label">
								<span className="label-text-alt text-error">{errors.email.message}</span>
							</div>
						)}
					</label>

					<label className="form-control">
						<div className="label">
							<span className="label-text">Password</span>
						</div>
						<input
							type="password"
							autoComplete="new-password"
							className="input input-bordered"
							aria-invalid={Boolean(errors.password)}
							{...register("password", {
								required: "Password is required",
								minLength: { value: 6, message: "Password must be at least 6 characters" },
							})}
						/>
						{errors.password && (
							<div className="label">
								<span className="label-text-alt text-error">{errors.password.message}</span>
							</div>
						)}
					</label>

					{submitError && <div className="alert alert-error text-sm">{submitError}</div>}

					<button type="submit" className="btn btn-primary" disabled={isSubmitting}>
						{isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Sign up"}
					</button>

					<p className="text-sm text-base-content/70 text-center">
						Already have an account?{" "}
						<Link to="/signin" className="link link-primary">
							Sign in
						</Link>
					</p>
				</form>
			</div>
		</main>
	);
}
