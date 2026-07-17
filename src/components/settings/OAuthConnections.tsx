import type { OAuthGrant } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export function OAuthConnections() {
	const [grants, setGrants] = useState<OAuthGrant[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [revokingId, setRevokingId] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		supabase.auth.oauth.listGrants().then(({ data, error }) => {
			if (!active) return;
			if (error) setError("Connected apps are temporarily unavailable.");
			else setGrants(data ?? []);
			setIsLoading(false);
		});
		return () => {
			active = false;
		};
	}, []);

	async function revoke(clientId: string) {
		setRevokingId(clientId);
		setError(null);
		const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
		if (error) {
			setError("Could not revoke this connection. Try again.");
			setRevokingId(null);
			return;
		}
		setGrants((current) => current.filter((grant) => grant.client.id !== clientId));
		setRevokingId(null);
	}

	return (
		<div className="rounded-box border border-base-300 bg-base-100">
			<div className="border-b border-base-300 p-4">
				<h3 className="text-sm font-semibold">Connected apps</h3>
				<p className="mt-1 text-xs text-base-content/60">
					Apps you allowed to read your Kwartrack data. Revoke access at any time.
				</p>
			</div>
			{isLoading ? (
				<div className="flex justify-center p-5">
					<span className="loading loading-spinner loading-sm text-primary" />
				</div>
			) : grants.length === 0 ? (
				<p className="p-4 text-sm text-base-content/60">
					{error ?? "No apps are connected to your account."}
				</p>
			) : (
				<ul className="divide-y divide-base-300">
					{grants.map((grant) => (
						<li key={grant.client.id} className="flex items-center justify-between gap-4 p-4">
							<div className="min-w-0">
								<p className="truncate text-sm font-medium">{grant.client.name}</p>
								<p className="mt-0.5 text-xs text-base-content/55">
									Connected {new Date(grant.granted_at).toLocaleDateString("en-PH")}
								</p>
							</div>
							<button
								type="button"
								className="btn btn-ghost btn-sm"
								disabled={revokingId !== null}
								onClick={() => revoke(grant.client.id)}
							>
								{revokingId === grant.client.id ? (
									<span className="loading loading-spinner loading-xs" />
								) : (
									"Revoke"
								)}
							</button>
						</li>
					))}
				</ul>
			)}
			{error && grants.length > 0 && <p className="px-4 pb-4 text-xs text-error">{error}</p>}
		</div>
	);
}
