import { type ReactNode, useRef } from "react";
import { useShouldShowBottomFade } from "../../hooks/useScrollFadeMask";

// Tailwind v4 native mask utilities: keeps the bottom 2.5rem of the
// container as a transparent fade so users can see there's more content
// below. We pair them with `useShouldShowBottomFade` so the fade
// disappears once the user has scrolled to the end.
const FADE_CLASSES = "mask-b-from-[calc(100%-2.5rem)] mask-b-to-100%";

type Props = {
	children: ReactNode;
	className?: string;
};

/**
 * Scrollable wrapper that fades its bottom edge while there's more content
 * below the visible area — the affordance daisyUI's docs use on long lists.
 * Hook clears the fade once the bottom is reached so the last row stays
 * fully readable.
 */
export function ScrollFadeContainer({ children, className = "" }: Props) {
	const ref = useRef<HTMLDivElement>(null);
	const showFade = useShouldShowBottomFade(ref);
	return (
		<div ref={ref} className={`${className}${showFade ? ` ${FADE_CLASSES}` : ""}`}>
			{children}
		</div>
	);
}
