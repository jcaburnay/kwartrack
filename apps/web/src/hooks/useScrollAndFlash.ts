import { useEffect } from "react";

/**
 * Scrolls the row marked with `data-row-id={targetId}` into view and adds a
 * brief flash highlight. `ready` should flip true once the data feeding the
 * row list is loaded — querying the DOM before then finds nothing and the
 * effect bails.
 */
export function useScrollAndFlash(targetId: string | null, ready: boolean): void {
	useEffect(() => {
		if (!targetId || !ready) return;
		const el = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(targetId)}"]`);
		if (!el) return;
		el.scrollIntoView({ behavior: "smooth", block: "center" });
		el.classList.add("row-flash");
		const t = window.setTimeout(() => el.classList.remove("row-flash"), 1500);
		return () => window.clearTimeout(t);
	}, [targetId, ready]);
}
