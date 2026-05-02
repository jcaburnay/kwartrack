import { createBrowserRouter, Navigate, RouterProvider, useSearchParams } from "react-router";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthPage } from "./pages/AuthPage";
import { JigsawPage } from "./pages/JigsawPage";
import { SettingsAboutPage } from "./pages/SettingsAboutPage";
import { SettingsContactsPage } from "./pages/SettingsContactsPage";
import { SettingsGroupsPage } from "./pages/SettingsGroupsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SettingsTagsPage } from "./pages/SettingsTagsPage";

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
		element: (
			<ProtectedRoute>
				<SettingsPage />
			</ProtectedRoute>
		),
		children: [
			{ index: true, element: <Navigate to="tags" replace /> },
			{ path: "tags", element: <SettingsTagsPage /> },
			{ path: "contacts", element: <SettingsContactsPage /> },
			{ path: "groups", element: <SettingsGroupsPage /> },
			{ path: "about", element: <SettingsAboutPage /> },
		],
	},
	{ path: "/signin", element: <AuthPage /> },
	{ path: "/signup", element: <AuthPage /> },
]);

export function App() {
	return <RouterProvider router={router} />;
}
