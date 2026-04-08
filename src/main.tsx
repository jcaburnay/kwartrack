import { ClerkProvider } from "@clerk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ClerkTokenProvider } from "./providers/ClerkTokenProvider";
import { SpacetimeDBProvider } from "./providers/SpacetimeDBProvider";
import "./index.css";

// Provider nesting order is MANDATORY (D-10):
// ClerkProvider (outer) → ClerkTokenProvider (middle) → SpacetimeDBProvider (inner)
// ClerkProvider must be outermost so useAuth() works inside ClerkTokenProvider
// ClerkTokenProvider must wrap SpacetimeDBProvider so token is available when building connection
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ClerkProvider
			publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
			afterSignOutUrl="/sign-in"
		>
			<ClerkTokenProvider>
				<SpacetimeDBProvider>
					<App />
				</SpacetimeDBProvider>
			</ClerkTokenProvider>
		</ClerkProvider>
	</StrictMode>,
);
