import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, RouterProvider, useSearchParams } from "react-router";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { JigsawPage } from "./pages/JigsawPage";

const AuthPage = lazy(() => import("./pages/AuthPage").then((m) => ({ default: m.AuthPage })));
const SettingsPage = lazy(() =>
	import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const SettingsAboutPage = lazy(() =>
	import("./pages/SettingsAboutPage").then((m) => ({ default: m.SettingsAboutPage })),
);
const SettingsContactsPage = lazy(() =>
	import("./pages/SettingsContactsPage").then((m) => ({ default: m.SettingsContactsPage })),
);
const SettingsGroupsPage = lazy(() =>
	import("./pages/SettingsGroupsPage").then((m) => ({ default: m.SettingsGroupsPage })),
);
const SettingsTagsPage = lazy(() =>
	import("./pages/SettingsTagsPage").then((m) => ({ default: m.SettingsTagsPage })),
);

function PageFallback() {
	return (
		<div className="flex h-screen items-center justify-center">
			<span className="loading loading-spinner loading-lg text-primary" />
		</div>
	);
}

function lazyRoute(node: React.ReactNode) {
	return <Suspense fallback={<PageFallback />}>{node}</Suspense>;
}

function RecurringRedirect() {
	const [params] = useSearchParams();
	const id = params.get("id");
	if (id) return <Navigate to={`/?modal=edit-recurring&id=${id}`} replace />;
	return <Navigate to="/?focus=recurring" replace />;
}

const router = createBrowserRouter([
	{
		path: "/",
		element: (
			<ProtectedRoute>
				<JigsawPage />
			</ProtectedRoute>
		),
	},
	// Legacy per-feature routes redirect to the jigsaw
	{ path: "/accounts", element: <Navigate to="/" replace /> },
	{ path: "/budget", element: <Navigate to="/" replace /> },
	{ path: "/recurring", element: <RecurringRedirect /> },
	{ path: "/debts-and-splits", element: <Navigate to="/" replace /> },
	{
		path: "/settings",
		element: lazyRoute(
			<ProtectedRoute>
				<SettingsPage />
			</ProtectedRoute>,
		),
		children: [
			{ index: true, element: <Navigate to="tags" replace /> },
			{ path: "tags", element: lazyRoute(<SettingsTagsPage />) },
			{ path: "contacts", element: lazyRoute(<SettingsContactsPage />) },
			{ path: "groups", element: lazyRoute(<SettingsGroupsPage />) },
			{ path: "about", element: lazyRoute(<SettingsAboutPage />) },
		],
	},
	{ path: "/signin", element: lazyRoute(<AuthPage />) },
	{ path: "/signup", element: lazyRoute(<AuthPage />) },
]);

export function App() {
	return <RouterProvider router={router} />;
}
