import { type RefObject, useEffect, useRef } from "react";
import { DRAG_DISMISS_THRESHOLD, HEADER_HEIGHT_PX } from "../constants";

/**
 * Adds drag-to-dismiss behaviour to a bottom-sheet modal on mobile.
 *
 * Attach boxRef to the `.modal-box` element. Any touch that starts within the
 * top 72 px of the box (the header area) will initiate a drag. The box
 * translates downward as the user drags and calls `onDismiss` when the drag
 * exceeds 35% of the box height or the flick velocity is ≥ 0.5 px/ms.
 * Otherwise the box snaps back.
 *
 * Only activates on screens narrower than 640 px (DaisyUI's `sm:` breakpoint),
 * matching the `modal-bottom md:modal-middle` pattern used throughout the app.
 */
export function useDragToDismiss(
	boxRef: RefObject<HTMLDivElement | null>,
	onDismiss: () => void,
): void {
	// Keep onDismiss in a ref so the effect doesn't re-run when it changes.
	const onDismissRef = useRef(onDismiss);
	onDismissRef.current = onDismiss;

	useEffect(() => {
		// Desktop: centre modal, no drag needed.
		if (window.innerWidth >= 640) return;

		const box = boxRef.current;
		if (!box) return;

		let startY = 0;
		let startTime = 0;
		let isDragging = false;
		let currentDelta = 0;

		const onTouchStart = (e: TouchEvent) => {
			const relativeY = e.touches[0].clientY - box.getBoundingClientRect().top;
			if (relativeY > HEADER_HEIGHT_PX) return; // only top section initiates drag
			startY = e.touches[0].clientY;
			startTime = Date.now();
			isDragging = true;
			currentDelta = 0;
			// Disable CSS transitions while the user is actively dragging.
			box.style.transition = "none";
		};

		const onTouchMove = (e: TouchEvent) => {
			if (!isDragging) return;
			const delta = e.touches[0].clientY - startY;
			if (delta <= 0) return; // ignore upward drags
			// Prevent the page from scrolling while we're dragging the sheet.
			e.preventDefault();
			currentDelta = delta;
			box.style.transform = `translateY(${delta}px)`;
		};

		const onTouchEnd = () => {
			if (!isDragging) return;
			isDragging = false;

			const elapsed = Date.now() - startTime;
			const velocity = elapsed > 0 ? currentDelta / elapsed : 0; // px/ms
			const distanceThreshold = box.offsetHeight * DRAG_DISMISS_THRESHOLD;
			const shouldDismiss = currentDelta > distanceThreshold || velocity >= 0.5;

			if (shouldDismiss) {
				box.style.transition = "transform 0.25s ease-in";
				box.style.transform = `translateY(${box.offsetHeight}px)`;
				box.addEventListener(
					"transitionend",
					() => {
						// Call dismiss without resetting styles first — clearing the
						// transform before unmount causes a one-frame snap-back flash.
						onDismissRef.current();
					},
					{ once: true },
				);
			} else {
				// Snap back with a spring-like curve.
				box.style.transition = "transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)";
				box.style.transform = "";
				box.addEventListener(
					"transitionend",
					() => {
						box.style.transition = "";
					},
					{ once: true },
				);
			}

			currentDelta = 0;
		};

		box.addEventListener("touchstart", onTouchStart, { passive: true });
		// passive: false so we can call e.preventDefault() in onTouchMove.
		window.addEventListener("touchmove", onTouchMove, { passive: false });
		window.addEventListener("touchend", onTouchEnd);

		return () => {
			box.removeEventListener("touchstart", onTouchStart);
			window.removeEventListener("touchmove", onTouchMove);
			window.removeEventListener("touchend", onTouchEnd);
		};
	}, [boxRef]);
}
