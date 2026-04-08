import { Outlet } from "react-router";
import { BottomTabBar } from "./BottomTabBar";
import { MobileHeader } from "./MobileHeader";
import { Sidebar } from "./Sidebar";

export function AppShell() {
	return (
		<div className="flex min-h-screen flex-col sm:flex-row">
			<MobileHeader />
			<Sidebar />
			<main className="flex-1 bg-base-100 pb-16 sm:pb-0">
				<Outlet />
			</main>
			<BottomTabBar />
		</div>
	);
}
