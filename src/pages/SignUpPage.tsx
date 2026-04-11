import { SignUp } from "@clerk/react";

export function SignUpPage() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-base-100">
			<div className="flex justify-center w-full max-w-[400px]">
				<SignUp
					routing="path"
					path="/sign-up"
					signInUrl="/sign-in"
					appearance={{
						elements: {
							rootBox: "w-full",
						},
					}}
				/>
			</div>
		</div>
	);
}
