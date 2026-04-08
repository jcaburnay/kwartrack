import { SignIn } from "@clerk/react";

export function SignInPage() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-base-100">
			<div className="w-full max-w-[400px]">
				<SignIn
					routing="path"
					path="/sign-in"
					appearance={{
						elements: {
							// Minimal appearance override — use Clerk defaults, keep consistent with DaisyUI
							// Full appearance customization is Claude's discretion (CONTEXT.md)
							rootBox: "w-full",
						},
					}}
				/>
			</div>
		</div>
	);
}
