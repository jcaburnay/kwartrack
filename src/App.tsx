import { Show } from "@clerk/react";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { useClerkIdentityLink } from "./hooks/useClerkIdentityLink";

const AccountDetailPage = lazy(() =>
	import("./pages/AccountDetailPage").then((m) => ({ default: m.AccountDetailPage })),
);
const AccountsPage = lazy(() =>
	import("./pages/AccountsPage").then((m) => ({ default: m.AccountsPage })),
);
const BudgetPage = lazy(() =>
	import("./pages/BudgetPage").then((m) => ({ default: m.BudgetPage })),
);
const OverviewPage = lazy(() =>
	import("./pages/OverviewPage").then((m) => ({ default: m.OverviewPage })),
);
const DebtSplitPage = lazy(() =>
	import("./pages/DebtSplitPage").then((m) => ({ default: m.DebtSplitPage })),
);
const RecurringPage = lazy(() =>
	import("./pages/RecurringPage").then((m) => ({ default: m.RecurringPage })),
);
const SettingsPage = lazy(() =>
	import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const SignInPage = lazy(() =>
	import("./pages/SignInPage").then((m) => ({ default: m.SignInPage })),
);
const TransactionsPage = lazy(() =>
	import("./pages/TransactionsPage").then((m) => ({ default: m.TransactionsPage })),
);

// Do NOT build a custom ProtectedRoute — use Clerk's components directly (Anti-Pattern)
// Clerk <Show> handles async loading states correctly

export default function App() {
	useClerkIdentityLink();
	return (
		<BrowserRouter>
			<Suspense>
				<Routes>
					{/* Public routes */}
					<Route path="/sign-in" element={<SignInPage />} />
					{/* Protected routes: / and all nested paths */}
					<Route
						path="/"
						element={
							<>
								<Show when="signed-in">
									<AppShell />
								</Show>
								<Show when="signed-out">
									<Navigate to="/sign-in" replace />
								</Show>
							</>
						}
					>
						<Route index element={<OverviewPage />} />
						<Route path="overview" element={<OverviewPage />} />
						<Route path="accounts" element={<AccountsPage />} />
						<Route path="accounts/:id" element={<AccountDetailPage />} />
						<Route path="recurring" element={<RecurringPage />} />
						<Route path="transactions" element={<TransactionsPage />} />
						<Route path="budget" element={<BudgetPage />} />
						<Route path="debts" element={<DebtSplitPage />} />
						<Route path="settings" element={<SettingsPage />} />
					</Route>

					{/* Catch-all: redirect to home */}
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</Suspense>
		</BrowserRouter>
	);
}
