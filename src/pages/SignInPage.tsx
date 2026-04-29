import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

type SignInForm = {
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

export function SignInPage() {
	const { session, isLoading, setSessionOptimistically } = useAuth();
	const navigate = useNavigate();
	const [submitError, setSubmitError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<SignInForm>({
		defaultValues: { email: "", password: "" },
	});

	if (!isLoading && session) return <Navigate to="/" replace />;

	const onSubmit: SubmitHandler<SignInForm> = async (values) => {
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
		<main className="min-h-dvh flex items-center justify-center bg-base-200 p-6">
			<div className="card bg-base-100 shadow-md max-w-md w-full">
				<form className="card-body gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
					<h1 className="card-title text-2xl">Sign in</h1>

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
							autoComplete="current-password"
							className="input input-bordered"
							aria-invalid={Boolean(errors.password)}
							{...register("password", { required: "Password is required" })}
						/>
						{errors.password && (
							<div className="label">
								<span className="label-text-alt text-error">{errors.password.message}</span>
							</div>
						)}
					</label>

					{submitError && <div className="alert alert-error text-sm">{submitError}</div>}

					<button type="submit" className="btn btn-primary" disabled={isSubmitting}>
						{isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Sign in"}
					</button>

					<p className="text-sm text-base-content/70 text-center">
						New here?{" "}
						<Link to="/signup" className="link link-primary">
							Create an account
						</Link>
					</p>
				</form>
			</div>
		</main>
	);
}
