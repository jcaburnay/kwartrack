import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { useAuth } from "../providers/AuthProvider";
import { initialsFrom } from "../utils/initials";
import { GlobalFab } from "./GlobalFab";
import { MobileDock } from "./MobileDock";

export function Header() {
	const { profile, signOut } = useAuth();
	const displayName = profile?.display_name ?? "…";
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		function onScroll(e: Event) {
			const t = e.target;
			if (!(t instanceof HTMLElement)) return;
			setScrolled(t.scrollTop > 24);
		}
		const opts = { capture: true, passive: true } as const;
		document.addEventListener("scroll", onScroll, opts);
		return () => document.removeEventListener("scroll", onScroll, opts as AddEventListenerOptions);
	}, []);

	return (
		<>
			<header
				className={`navbar bg-base-100 border-b border-base-300 transition-all duration-200 ${
					scrolled ? "max-lg:!min-h-9 max-lg:!py-0" : ""
				}`}
			>
				<div className="flex-1">
					<NavLink
						to="/"
						aria-label="Go to home"
						className={`text-xl font-medium px-2 rounded transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
							scrolled ? "max-lg:!text-base" : ""
						}`}
					>
						kwartrack
					</NavLink>
				</div>

				<div className="flex-none">
					<div className="dropdown dropdown-end">
						<button
							type="button"
							tabIndex={0}
							aria-label="Open account menu"
							aria-haspopup="menu"
							className="avatar avatar-placeholder cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-full"
						>
							<div className="bg-primary text-primary-content w-9 rounded-full">
								<span className="text-sm">{initialsFrom(displayName)}</span>
							</div>
						</button>
						<ul
							tabIndex={0}
							aria-label="Account menu"
							className="dropdown-content menu bg-base-100 rounded-box shadow-md z-50 w-52 p-2 mt-2"
						>
							<li className="menu-title text-xs font-normal text-base-content/60 px-3 py-1">
								{displayName}
							</li>
							<li aria-hidden="true" className="-mx-2 my-1 border-t border-base-content/10" />
							<li>
								<NavLink to="/settings">Settings</NavLink>
							</li>
							<li>
								<button type="button" onClick={() => signOut()}>
									Sign out
								</button>
							</li>
						</ul>
					</div>
				</div>
			</header>
			<MobileDock />
			<GlobalFab />
		</>
	);
}
