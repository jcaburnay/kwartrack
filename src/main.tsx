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

function LoadingSpinner() {
	return (
		<div className="flex items-center justify-center h-screen">
			<span className="loading loading-spinner loading-lg" />
		</div>
	);
}

function SignedInTree() {
	return (
		<SpacetimeDBProvider>
			<ToastProvider>
				<ConnectionStatus />
				<RootErrorBoundary>
					<App />
				</RootErrorBoundary>
			</ToastProvider>
		</SpacetimeDBProvider>
	);
}

function SignedOutTree() {
	return (
		<ToastProvider>
			<RootErrorBoundary>
				<App />
			</RootErrorBoundary>
		</ToastProvider>
	);
}

// Gate: SpacetimeDBProvider is only mounted when a Clerk identity is available.
// On sign-out, we switch to SignedOutTree so React unmounts SpacetimeDBProvider
// and the WebSocket closes. The next sign-in mounts a fresh provider — a
// different Clerk user cannot inherit the previous user's live connection.
function AppGate() {
	const { isLoaded, isSignedIn } = useAuth();
	const { clerkUserId } = useClerkIdentity();

	if (!isLoaded) return <LoadingSpinner />;
	if (!isSignedIn) return <SignedOutTree />;
	if (!clerkUserId) return <LoadingSpinner />;
	return <SignedInTree />;
}

// Provider nesting order is MANDATORY (D-10):
// ClerkProvider (outer) → ClerkTokenProvider → AppGate → SpacetimeDBProvider → ToastProvider (inner)
// ClerkProvider must be outermost so useAuth() works inside ClerkTokenProvider
// ClerkTokenProvider must wrap AppGate so identity is available for the gate check
// AppGate swaps trees on sign-in/out so SpacetimeDBProvider mounts/unmounts with the session
// ToastProvider wraps ConnectionStatus + App so both can call useToast
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ClerkProvider
			publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
			afterSignOutUrl="/sign-in"
		>
			<ClerkTokenProvider>
				<AppGate />
			</ClerkTokenProvider>
		</ClerkProvider>
	</StrictMode>,
);
