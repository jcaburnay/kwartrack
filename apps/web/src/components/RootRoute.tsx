import { JigsawPage } from "../pages/JigsawPage";
import { LandingPage } from "../pages/LandingPage";
import { useAuth } from "../providers/AuthProvider";

export function RootRoute() {
	const { session, isLoading } = useAuth();

	if (isLoading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<span className="loading loading-spinner loading-lg text-primary" />
			</div>
		);
	}

	return session ? <JigsawPage /> : <LandingPage />;
}
