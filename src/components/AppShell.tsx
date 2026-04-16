import { Outlet } from "react-router";
import { BottomTabBar } from "./BottomTabBar";
import { MobileHeader } from "./MobileHeader";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { Sidebar } from "./Sidebar";

const isDesktop = () => window.innerWidth >= 768;
const storedOpen = () => localStorage.getItem("sidebar_open");

export function AppShell() {
	return (
		<div className="drawer md:drawer-open">
			<input
				id="main-drawer"
				type="checkbox"
				className="drawer-toggle"
				defaultChecked={isDesktop() ? storedOpen() !== "false" : false}
				onChange={(e) => {
					if (isDesktop()) localStorage.setItem("sidebar_open", String(e.target.checked));
				}}
			/>
			<div className="drawer-content flex flex-col min-h-screen">
				<MobileHeader />
				<main className="flex-1 bg-base-100 pb-16 md:pb-0">
					<div className="mx-auto w-full max-w-[1152px]">
						<RouteErrorBoundary>
							<Outlet />
						</RouteErrorBoundary>
					</div>
				</main>
				<BottomTabBar />
			</div>
			<div
				className="drawer-side is-drawer-close:overflow-visible z-40"
				role="dialog"
				aria-modal="true"
				aria-label="Sidebar"
			>
				<label
					htmlFor="main-drawer"
					aria-label="close sidebar"
					className="drawer-overlay md:hidden"
				/>
				<Sidebar />
			</div>
		</div>
	);
}
