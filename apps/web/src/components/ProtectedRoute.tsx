import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../providers/AuthProvider";

export function ProtectedRoute({ children }: { children: ReactNode }) {
	const { session, isLoading } = useAuth();

	if (isLoading) {
		return (
			<main className="min-h-dvh flex items-center justify-center">
				<span className="loading loading-spinner loading-lg text-primary" />
			</main>
		);
	}

	if (!session) return <Navigate to="/signin" replace />;

	return <>{children}</>;
}
