import type { OAuthAuthorizationDetails } from "@supabase/supabase-js";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { APPROVED_CHATGPT_CLIENT_ID, isApprovedChatGptRedirect } from "../lib/config";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

const scopeDescriptions: Record<string, string> = {
	openid: "Verify your Kwartrack identity",
	email: "See the email address on your account",
	profile: "See your basic Kwartrack profile",
};

function displayOrigin(value: string) {
	try {
		return new URL(value).origin;
	} catch {
		return "an unverified destination";
	}
}

export function OAuthAuthorizationPage() {
	const { session, isLoading: isAuthLoading } = useAuth();
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const authorizationId = searchParams.get("authorization_id");
	const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [decision, setDecision] = useState<"approve" | "deny" | null>(null);

	useEffect(() => {
		if (isAuthLoading) return;
		if (!session || !authorizationId) {
			setIsLoading(false);
			return;
		}
		let active = true;
		supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
			if (!active) return;
			if (error || !data) {
				setError(error?.message ?? "This authorization request is no longer valid.");
				setIsLoading(false);
				return;
			}
			if ("redirect_url" in data) {
				if (!isApprovedChatGptRedirect(data.redirect_url)) {
					setError("An existing authorization tried to redirect to an unapproved application.");
					setIsLoading(false);
					return;
				}
				window.location.assign(data.redirect_url);
				return;
			}
			setDetails(data);
			setIsLoading(false);
		});
		return () => {
			active = false;
		};
	}, [authorizationId, isAuthLoading, session]);

	async function decide(action: "approve" | "deny") {
		if (!authorizationId) return;
		setDecision(action);
		setError(null);
		const response =
			action === "approve"
				? await supabase.auth.oauth.approveAuthorization(authorizationId, {
						skipBrowserRedirect: true,
					})
				: await supabase.auth.oauth.denyAuthorization(authorizationId, {
						skipBrowserRedirect: true,
					});
		if (response.error || !response.data) {
			setError(response.error?.message ?? "Could not complete the authorization request.");
			setDecision(null);
			return;
		}
		window.location.assign(response.data.redirect_url);
	}

	if (isAuthLoading || isLoading) {
		return (
			<main className="flex min-h-dvh items-center justify-center bg-base-200 p-6">
				<span className="loading loading-spinner loading-lg text-primary" />
			</main>
		);
	}

	if (!authorizationId) {
		return (
			<AuthorizationMessage title="Invalid request" message="The authorization ID is missing." />
		);
	}

	if (!session) {
		const next = `${location.pathname}${location.search}`;
		return (
			<AuthorizationMessage
				title="Connect Kwartrack"
				message="Sign in to review ChatGPT's request to access your Kwartrack data."
			>
				<Link className="btn btn-primary" to={`/signin?next=${encodeURIComponent(next)}`}>
					Sign in to continue
				</Link>
			</AuthorizationMessage>
		);
	}

	if (error || !details) {
		return (
			<AuthorizationMessage
				title="Couldn't connect Kwartrack"
				message={error ?? "This authorization request is no longer valid."}
			/>
		);
	}

	if (details.client.id !== APPROVED_CHATGPT_CLIENT_ID) {
		return (
			<AuthorizationMessage
				title="Unapproved application"
				message={`${details.client.name || "An unknown application"} is not approved to read Kwartrack data. Its registered redirect destination is ${displayOrigin(details.redirect_uri)}.`}
			>
				<button
					type="button"
					className="btn btn-primary"
					disabled={decision !== null}
					onClick={() => decide("deny")}
				>
					{decision === "deny" ? (
						<span className="loading loading-spinner loading-sm" />
					) : (
						"Deny request"
					)}
				</button>
			</AuthorizationMessage>
		);
	}

	const scopes = details.scope.split(/\s+/).filter(Boolean);
	const clientOrigin = displayOrigin(details.client.uri);
	const redirectOrigin = displayOrigin(details.redirect_uri);
	return (
		<main className="flex min-h-dvh items-center justify-center bg-base-200 p-6">
			<div className="card w-full max-w-md bg-base-100 shadow-md">
				<div className="card-body gap-5">
					<div className="flex items-start gap-3">
						<div className="rounded-xl bg-primary/10 p-3 text-primary">
							<ShieldCheck aria-hidden="true" className="size-6" />
						</div>
						<div>
							<h1 className="card-title">Connect {details.client.name || "ChatGPT"}</h1>
							<p className="mt-1 text-sm text-base-content/65">
								Review the access requested for {details.user.email}.
							</p>
							<p className="mt-1 text-xs text-base-content/50">
								Requested by {clientOrigin} · Returns to {redirectOrigin}
							</p>
						</div>
					</div>

					<div className="rounded-xl border border-base-300 p-4">
						<p className="mb-3 text-sm font-semibold">This connection can:</p>
						<ul className="space-y-2 text-sm text-base-content/75">
							{scopes.map((scope) => (
								<li key={scope} className="flex gap-2">
									<span aria-hidden="true" className="text-success">
										✓
									</span>
									<span>{scopeDescriptions[scope] ?? scope}</span>
								</li>
							))}
							<li className="flex gap-2">
								<span aria-hidden="true" className="text-success">
									✓
								</span>
								<span>Read your accounts, transactions, budgets, recurrings, and debts</span>
							</li>
						</ul>
					</div>

					<p className="text-xs text-base-content/55">
						This integration is read-only. It cannot create, edit, or delete financial data.
					</p>
					{error && <div className="alert alert-error text-sm">{error}</div>}
					<div className="card-actions grid grid-cols-2 gap-3">
						<button
							type="button"
							className="btn btn-ghost"
							disabled={decision !== null}
							onClick={() => decide("deny")}
						>
							{decision === "deny" ? (
								<span className="loading loading-spinner loading-sm" />
							) : (
								"Cancel"
							)}
						</button>
						<button
							type="button"
							className="btn btn-primary"
							disabled={decision !== null}
							onClick={() => decide("approve")}
						>
							{decision === "approve" ? (
								<span className="loading loading-spinner loading-sm" />
							) : (
								"Allow access"
							)}
						</button>
					</div>
				</div>
			</div>
		</main>
	);
}

function AuthorizationMessage({
	title,
	message,
	children,
}: {
	title: string;
	message: string;
	children?: React.ReactNode;
}) {
	return (
		<main className="flex min-h-dvh items-center justify-center bg-base-200 p-6">
			<div className="card w-full max-w-md bg-base-100 shadow-md">
				<div className="card-body items-center gap-4 text-center">
					<h1 className="card-title">{title}</h1>
					<p className="text-base-content/70">{message}</p>
					{children}
				</div>
			</div>
		</main>
	);
}
