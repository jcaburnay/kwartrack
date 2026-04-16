import { ClerkProvider, useAuth } from "@clerk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
import { ClerkTokenProvider, useClerkIdentity } from "./providers/ClerkTokenProvider";
import { SpacetimeDBProvider } from "./providers/SpacetimeDBProvider";
import { ToastProvider } from "./providers/ToastProvider";
import "./index.css";

// Gate: only render SpacetimeDBProvider (and App) once Clerk identity is available.
// This eliminates the race condition where SpacetimeDB connects before Clerk resolves.
// On sign-out, clerkUserId becomes undefined → gate unmounts SpacetimeDBProvider →
// WebSocket disconnects → sign in again → fresh connection with correct identity.
// When signed out or Clerk is still loading, pass through so sign-in/sign-up routes work.
function SpacetimeDBGate({ children }: { children: React.ReactNode }) {
	const { isLoaded, isSignedIn } = useAuth();
	const { clerkUserId } = useClerkIdentity();

	// Clerk still loading — show spinner
	if (!isLoaded) {
		return (
			<div className="flex items-center justify-center h-screen">
				<span className="loading loading-spinner loading-lg" />
			</div>
		);
	}

	// Signed out — pass through so sign-in page renders
	if (!isSignedIn) {
		return <>{children}</>;
	}

	// Signed in but identity not yet resolved — show spinner
	if (!clerkUserId) {
		return (
			<div className="flex items-center justify-center h-screen">
				<span className="loading loading-spinner loading-lg" />
			</div>
		);
	}

	return <>{children}</>;
}

// Provider nesting order is MANDATORY (D-10):
// ClerkProvider (outer) → ClerkTokenProvider → SpacetimeDBGate → SpacetimeDBProvider → ToastProvider (inner)
// ClerkProvider must be outermost so useAuth() works inside ClerkTokenProvider
// ClerkTokenProvider must wrap SpacetimeDBGate so identity is available for the gate check
// SpacetimeDBGate blocks SpacetimeDBProvider until Clerk has resolved the user
// ToastProvider wraps ConnectionStatus + App so both can call useToast
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ClerkProvider
			publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
			afterSignOutUrl="/sign-in"
		>
			<ClerkTokenProvider>
				<SpacetimeDBGate>
					<SpacetimeDBProvider>
						<ToastProvider>
							<ConnectionStatus />
							<RootErrorBoundary>
								<App />
							</RootErrorBoundary>
						</ToastProvider>
					</SpacetimeDBProvider>
				</SpacetimeDBGate>
			</ClerkTokenProvider>
		</ClerkProvider>
	</StrictMode>,
);
