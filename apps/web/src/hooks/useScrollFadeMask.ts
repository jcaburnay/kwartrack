import { type RefObject, useEffect, useState } from "react";

/**
 * Tracks whether `scrollRef`'s element has more content below the visible
 * area. Returns `true` while there is more to scroll to (the fade-mask should
 * be on), and `false` when the element is at the bottom or has no overflow at
 * all (fade should be off so the last row is fully visible).
 */
export function useShouldShowBottomFade<T extends HTMLElement>(
	scrollRef: RefObject<T | null>,
): boolean {
	const [show, setShow] = useState(false);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		const update = () => {
			const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
			// 1px tolerance for sub-pixel rendering rounding.
			setShow(remaining > 1);
		};

		update();
		el.addEventListener("scroll", update, { passive: true });
		const ro = new ResizeObserver(update);
		ro.observe(el);
		const inner = el.firstElementChild;
		if (inner) ro.observe(inner);

		return () => {
			el.removeEventListener("scroll", update);
			ro.disconnect();
		};
	}, [scrollRef]);

	return show;
}
