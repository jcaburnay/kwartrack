import { Show } from "@clerk/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { AccountDetailPage } from "./pages/AccountDetailPage";
import { AccountsPage } from "./pages/AccountsPage";
import { BudgetPage } from "./pages/BudgetPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DebtSplitPage } from "./pages/DebtSplitPage";
import { RecurringPage } from "./pages/RecurringPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SignInPage } from "./pages/SignInPage";
import { TransactionsPage } from "./pages/TransactionsPage";

// Do NOT build a custom ProtectedRoute — use Clerk's components directly (Anti-Pattern)
// Clerk <Show> handles async loading states correctly

export default function App() {
	return (
		<BrowserRouter>
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
					<Route index element={<DashboardPage />} />
					<Route path="dashboard" element={<DashboardPage />} />
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
		</BrowserRouter>
	);
}
