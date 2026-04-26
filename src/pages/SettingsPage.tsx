import { NavLink, Outlet } from "react-router";
import { Header } from "../components/Header";

const SECTIONS: { slug: string; label: string; enabled: boolean }[] = [
	{ slug: "profile", label: "Profile", enabled: false },
	{ slug: "appearance", label: "Appearance", enabled: false },
	{ slug: "tags", label: "Tags", enabled: true },
	{ slug: "contacts", label: "Contacts", enabled: true },
	{ slug: "groups", label: "Groups", enabled: true },
	{ slug: "export", label: "Data export", enabled: false },
	{ slug: "about", label: "Help & about", enabled: false },
];

export function SettingsPage() {
	return (
		<div className="min-h-dvh bg-base-200 flex flex-col">
			<Header />
			<main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto flex flex-col gap-5">
				<h1 className="text-2xl font-semibold">Settings</h1>
				<div className="grid grid-cols-1 md:grid-cols-[14rem_1fr] gap-6">
					<nav>
						<ul className="menu bg-base-100 rounded-box p-2">
							{SECTIONS.map((s) =>
								s.enabled ? (
									<li key={s.slug}>
										<NavLink
											to={`/settings/${s.slug}`}
											className={({ isActive }) => (isActive ? "active" : "")}
										>
											{s.label}
										</NavLink>
									</li>
								) : (
									<li key={s.slug}>
										<span className="opacity-50 cursor-not-allowed" title="Coming in a later slice">
											{s.label}
										</span>
									</li>
								),
							)}
						</ul>
					</nav>
					<section className="bg-base-100 rounded-box p-5 min-h-[14rem]">
						<Outlet />
					</section>
				</div>
			</main>
		</div>
	);
}
