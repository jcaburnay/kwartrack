import { useAuth } from "../providers/AuthProvider";

function initialsFrom(name: string | null | undefined): string {
	if (!name) return "?";
	const parts = name.trim().split(/\s+/).slice(0, 2);
	return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function Header() {
	const { profile, signOut } = useAuth();
	const displayName = profile?.display_name ?? "…";

	return (
		<header className="navbar bg-base-100 border-b border-base-300">
			<div className="flex-1">
				<span className="text-xl font-semibold px-2">kwartrack</span>
			</div>
			<div className="flex-none gap-3">
				<div className="flex items-center gap-2">
					<div className="avatar avatar-placeholder">
						<div className="bg-primary text-primary-content w-9 rounded-full">
							<span className="text-sm">{initialsFrom(profile?.display_name)}</span>
						</div>
					</div>
					<span className="hidden sm:inline text-sm text-base-content/80">{displayName}</span>
				</div>
				<button type="button" className="btn btn-ghost btn-sm" onClick={() => signOut()}>
					Sign out
				</button>
			</div>
		</header>
	);
}
