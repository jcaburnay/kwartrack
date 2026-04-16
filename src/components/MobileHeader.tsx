import { UserButton } from "@clerk/react";

export function MobileHeader() {
	return (
		<header className="flex items-center justify-between px-4 py-3 bg-base-200 border-b border-base-300 md:hidden">
			<span className="text-lg font-semibold tracking-tight">kwartrack</span>
			<div className="flex items-center gap-3">
				<UserButton />
			</div>
		</header>
	);
}
