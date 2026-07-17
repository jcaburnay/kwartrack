import { NavLink, Outlet } from "react-router";
import { Header } from "../components/Header";

type Section = { slug: string; label: string };
type Group = { label: string; items: Section[] };

const GROUPS: Group[] = [
	{
		label: "Account",
		items: [
			{ slug: "profile", label: "Profile" },
			{ slug: "appearance", label: "Appearance" },
		],
	},
	{
		label: "Library",
		items: [
			{ slug: "tags", label: "Tags" },
			{ slug: "contacts", label: "Contacts" },
			{ slug: "groups", label: "Groups" },
		],
	},
	{
		label: "Data",
		items: [
			{ slug: "export", label: "Export" },
			{ slug: "about", label: "Help & about" },
		],
	},
];

const FLAT_ITEMS: Section[] = GROUPS.flatMap((g) => g.items);

export function SettingsPage() {
	return (
		<div className="min-h-dvh bg-base-200 flex flex-col">
			<Header />
			<main className="flex-1 pt-4 sm:pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6 max-w-6xl w-full mx-auto flex flex-col gap-5 px-0 sm:px-6">
				<h1 className="text-2xl font-semibold px-4 sm:px-0">Settings</h1>
				<div className="grid grid-cols-1 md:grid-cols-[14rem_1fr] gap-4 md:gap-6">
					{/* Mobile: ghost chip strip that scrolls horizontally. Desktop: grouped sidebar. */}
					<nav>
						{/* Mobile chip strip */}
						<div className="md:hidden bg-base-100 rounded-none mx-0">
							<ul className="flex flex-row gap-1 overflow-x-auto whitespace-nowrap p-2">
								{FLAT_ITEMS.map((s) => (
									<li key={s.slug} className="shrink-0">
										<NavLink
											to={`/settings/${s.slug}`}
											className={({ isActive }) =>
												`btn btn-sm ${isActive ? "btn-primary" : "btn-ghost"}`
											}
										>
											{s.label}
										</NavLink>
									</li>
								))}
							</ul>
						</div>
						{/* Desktop grouped sidebar */}
						<div className="hidden md:flex md:flex-col md:gap-4 md:bg-base-100 md:rounded-box md:p-3">
							{GROUPS.map((group) => (
								<div key={group.label} className="flex flex-col gap-1">
									<div className="text-xs font-semibold uppercase tracking-wide text-base-content/50 px-3 py-1">
										{group.label}
									</div>
									<ul className="flex flex-col gap-0.5">
										{group.items.map((s) => (
											<li key={s.slug}>
												<NavLink
													to={`/settings/${s.slug}`}
													className={({ isActive }) =>
														`block px-3 py-1.5 rounded-md text-sm transition-colors ${
															isActive
																? "bg-base-200 text-base-content font-medium"
																: "text-base-content/70 hover:bg-base-200 hover:text-base-content"
														}`
													}
												>
													{s.label}
												</NavLink>
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
					</nav>
					<section className="bg-base-100 px-4 py-4 sm:p-5 lg:rounded-box min-h-[14rem]">
						<Outlet />
					</section>
				</div>
			</main>
		</div>
	);
}
