import { Header } from "../components/Header";
import { WelcomeCard } from "../components/WelcomeCard";

export function OverviewPage() {
	return (
		<div className="min-h-dvh bg-base-200 flex flex-col">
			<Header />
			<main className="flex-1 flex items-center justify-center p-6">
				<WelcomeCard onCreateAccount={() => {}} />
			</main>
		</div>
	);
}
