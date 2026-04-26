import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AccountsPage } from "./pages/AccountsPage";
import { BudgetPage } from "./pages/BudgetPage";
import { DebtsAndSplitsPage } from "./pages/DebtsAndSplitsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RecurringPage } from "./pages/RecurringPage";
import { SettingsContactsPage } from "./pages/SettingsContactsPage";
import { SettingsGroupsPage } from "./pages/SettingsGroupsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SettingsTagsPage } from "./pages/SettingsTagsPage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";

const router = createBrowserRouter([
	{
		path: "/",
		element: (
			<ProtectedRoute>
				<OverviewPage />
			</ProtectedRoute>
		),
	},
	{
		path: "/accounts",
		element: (
			<ProtectedRoute>
				<AccountsPage />
			</ProtectedRoute>
		),
	},
	{
		path: "/budget",
		element: (
			<ProtectedRoute>
				<BudgetPage />
			</ProtectedRoute>
		),
	},
	{
		path: "/recurring",
		element: (
			<ProtectedRoute>
				<RecurringPage />
			</ProtectedRoute>
		),
	},
	{
		path: "/debts-and-splits",
		element: (
			<ProtectedRoute>
				<DebtsAndSplitsPage />
			</ProtectedRoute>
		),
	},
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
		],
	},
	{ path: "/signin", element: <SignInPage /> },
	{ path: "/signup", element: <SignUpPage /> },
]);

export function App() {
	return <RouterProvider router={router} />;
}
