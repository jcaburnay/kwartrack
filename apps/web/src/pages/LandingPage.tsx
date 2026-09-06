import { FeatureGrid } from "../components/landing/FeatureGrid";
import { FinalCta } from "../components/landing/FinalCta";
import { Hero } from "../components/landing/Hero";
import { LandingFooter } from "../components/landing/LandingFooter";
import { LandingNav } from "../components/landing/LandingNav";
import { OpenSourceSection } from "../components/landing/OpenSourceSection";
import { SelfHostSection } from "../components/landing/SelfHostSection";

export function LandingPage() {
	return (
		<div className="min-h-dvh bg-base-100 text-base-content">
			<LandingNav />
			<main>
				<Hero />
				<FeatureGrid />
				<SelfHostSection />
				<OpenSourceSection />
				<FinalCta />
			</main>
			<LandingFooter />
		</div>
	);
}
