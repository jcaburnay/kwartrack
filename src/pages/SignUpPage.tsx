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

export function SignUpPage() {
	const { session, isLoading, setSessionOptimistically } = useAuth();
	const navigate = useNavigate();
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [checkEmail, setCheckEmail] = useState(false);

	const {
		register,
		handleSubmit,
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
			setSubmitError(error.message);
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
						<Link to="/signin" className="btn btn-ghost btn-sm mt-2">
							Back to sign in
						</Link>
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
