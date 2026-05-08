import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../providers/AuthProvider";
import { SignInForm } from "./auth/SignInForm";
import { SignUpForm } from "./auth/SignUpForm";

type Mode = "signin" | "signup";

export function AuthPage() {
	const { session, isLoading } = useAuth();
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const [checkEmail, setCheckEmail] = useState(false);

	if (!isLoading && session) return <Navigate to="/" replace />;

	const mode: Mode = pathname === "/signup" ? "signup" : "signin";

	function selectMode(next: Mode) {
		if (next === mode) return;
		navigate(next === "signup" ? "/signup" : "/signin", { replace: true });
	}

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
								onClick={() => setCheckEmail(false)}
							>
								Use a different email
							</button>
							<Link
								to="/signin"
								className="btn btn-ghost btn-sm"
								onClick={() => setCheckEmail(false)}
							>
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
				<div className="card-body gap-4">
					<div role="tablist" aria-label="Authentication mode" className="tabs tabs-box w-full">
						<button
							type="button"
							role="tab"
							aria-selected={mode === "signin"}
							className={`tab flex-1 font-medium ${mode === "signin" ? "tab-active" : ""}`}
							onClick={() => selectMode("signin")}
						>
							Sign in
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={mode === "signup"}
							className={`tab flex-1 font-medium ${mode === "signup" ? "tab-active" : ""}`}
							onClick={() => selectMode("signup")}
						>
							Sign up
						</button>
					</div>

					{mode === "signin" ? (
						<SignInForm />
					) : (
						<SignUpForm onCheckEmail={() => setCheckEmail(true)} />
					)}
				</div>
			</div>
		</main>
	);
}
