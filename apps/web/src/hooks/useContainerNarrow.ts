import { useEffect, useRef, useState } from "react";

/**
 * Observes a container element's inline-size and reports whether it's below
 * `threshold` px. Used by tables that switch to a card layout in narrow
 * panels. Defaults to `false` until ResizeObserver fires so jsdom-based
 * tests, which don't trigger the observer, keep asserting against the
 * default (table) markup.
 */
export function useContainerNarrow<T extends HTMLElement>(threshold: number) {
	const ref = useRef<T>(null);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		const ro = new ResizeObserver(([entry]) => {
			setWidth(entry?.contentRect.width ?? 0);
		});
		ro.observe(node);
		return () => ro.disconnect();
	}, []);

	return { ref, isNarrow: width > 0 && width < threshold };
}
