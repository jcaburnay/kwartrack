import { useState } from "react";
import { supabase } from "../../lib/supabase";

// Renders /public/icons/google.svg as a CSS mask so the icon inherits the
// button's currentColor — keeps the SVG file as the source of truth while
// adapting to light and dark themes without needing two icon files.
const googleMaskStyle = {
	WebkitMask: "url('/icons/google.svg') center / contain no-repeat",
	mask: "url('/icons/google.svg') center / contain no-repeat",
} as const;

type Props = {
	/** Hook back into the parent form's submitError state so the same alert
	 *  box used for email/password errors also surfaces OAuth failures. */
	setError: (message: string | null) => void;
};

export function SocialAuthButtons({ setError }: Props) {
	const [isLoading, setIsLoading] = useState(false);

	async function handleGoogle() {
		setError(null);
		setIsLoading(true);
		const { error } = await supabase.auth.signInWithOAuth({
			provider: "google",
			options: { redirectTo: `${window.location.origin}/` },
		});
		if (error) {
			// biome-ignore lint/suspicious/noConsole: keep raw Supabase message for debugging while showing a friendly mapped error to the user.
			console.warn("supabase signInWithOAuth(google):", error.message);
			setError("Google sign-in failed. Try again or use email and password.");
			setIsLoading(false);
			return;
		}
		// On success, signInWithOAuth navigates the browser to Google. Nothing
		// further to do — when we return, AuthProvider picks up the session via
		// onAuthStateChange and AuthPage redirects to "/".
	}

	return (
		<>
			<button
				type="button"
				className="btn btn-outline w-full"
				onClick={handleGoogle}
				disabled={isLoading}
			>
				{isLoading ? (
					<span className="loading loading-spinner loading-sm" />
				) : (
					<>
						<span aria-hidden="true" className="w-5 h-5 bg-current" style={googleMaskStyle} />
						Continue with Google
					</>
				)}
			</button>
			<div className="divider text-xs text-base-content/60 my-1">or</div>
		</>
	);
}
