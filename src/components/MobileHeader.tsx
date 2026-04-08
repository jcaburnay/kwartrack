import { UserButton } from "@clerk/react";
import { ThemeToggle } from "./ThemeToggle";

export function MobileHeader() {
	return (
		<header className="flex items-center justify-between px-4 py-3 bg-base-200 border-b border-base-300 sm:hidden">
			<span className="text-lg font-semibold tracking-tight">Kwartrack</span>
			<div className="flex items-center gap-3">
				<ThemeToggle />
				<UserButton />
			</div>
		</header>
	);
}
