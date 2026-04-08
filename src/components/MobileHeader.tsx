import { UserButton } from "@clerk/react";
import { ThemeToggle } from "./ThemeToggle";

export function MobileHeader() {
	return (
		<header className="flex items-center justify-between px-4 py-3 bg-base-200 border-b border-base-300 sm:hidden">
			<div className="flex items-center gap-2.5">
				<div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-content text-xs font-bold flex-shrink-0">
					K
				</div>
				<span className="text-lg font-semibold tracking-tight">Kwartrack</span>
			</div>
			<div className="flex items-center gap-3">
				<ThemeToggle />
				<UserButton />
			</div>
		</header>
	);
}
