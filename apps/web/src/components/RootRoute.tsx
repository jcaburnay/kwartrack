import { lazy, Suspense } from "react";
import { LandingPage } from "../pages/LandingPage";
import { useAuth } from "../providers/AuthProvider";

const JigsawPage = lazy(() =>
	import("../pages/JigsawPage").then((module) => ({ default: module.JigsawPage })),
);

function PageFallback() {
	return (
		<div className="flex h-screen items-center justify-center">
			<span className="loading loading-spinner loading-lg text-primary" />
		</div>
	);
}

export function RootRoute() {
	const { session, isLoading } = useAuth();

	if (isLoading) {
		return <PageFallback />;
	}

	return session ? (
		<Suspense fallback={<PageFallback />}>
			<JigsawPage />
		</Suspense>
	) : (
		<LandingPage />
	);
}
