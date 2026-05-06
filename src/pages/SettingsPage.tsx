import { NavLink, Outlet } from "react-router";
import { Header } from "../components/Header";

const SECTIONS: { slug: string; label: string; enabled: boolean }[] = [
	{ slug: "profile", label: "Profile", enabled: false },
	{ slug: "appearance", label: "Appearance", enabled: false },
	{ slug: "tags", label: "Tags", enabled: true },
	{ slug: "contacts", label: "Contacts", enabled: true },
	{ slug: "groups", label: "Groups", enabled: true },
	{ slug: "export", label: "Data export", enabled: false },
	{ slug: "about", label: "Help & about", enabled: true },
];

export function SettingsPage() {
	return (
		<div className="min-h-dvh bg-base-200 flex flex-col">
			<Header />
			<main className="flex-1 px-4 sm:px-6 pt-4 sm:pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6 max-w-6xl w-full mx-auto flex flex-col gap-5">
				<h1 className="text-2xl font-semibold">Settings</h1>
				<div className="grid grid-cols-1 md:grid-cols-[14rem_1fr] gap-4 md:gap-6">
					{/* Mobile: horizontal scrolling tab strip; desktop: vertical sidebar. */}
					<nav>
						<ul
							className="
								flex flex-row gap-1 overflow-x-auto whitespace-nowrap
								bg-base-100 rounded-box p-1
								md:menu md:flex-col md:p-2
							"
						>
							{SECTIONS.map((s) =>
								s.enabled ? (
									<li key={s.slug} className="shrink-0">
										<NavLink
											to={`/settings/${s.slug}`}
											className={({ isActive }) =>
												`block px-3 py-2 rounded-md text-sm md:w-full ${
													isActive
														? "bg-primary text-primary-content md:bg-base-200 md:text-base-content md:font-medium"
														: "hover:bg-base-200"
												}`
											}
										>
											{s.label}
										</NavLink>
									</li>
								) : (
									<li key={s.slug} className="shrink-0">
										<span
											className="block px-3 py-2 text-sm opacity-50 cursor-not-allowed"
											title="Coming in a later slice"
										>
											{s.label}
										</span>
									</li>
								),
							)}
						</ul>
					</nav>
					<section className="bg-base-100 rounded-box p-4 sm:p-5 min-h-[14rem]">
						<Outlet />
					</section>
				</div>
			</main>
		</div>
	);
}
