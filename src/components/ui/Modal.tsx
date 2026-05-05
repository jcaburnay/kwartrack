/**
 * Modal primitive — compound API: <Modal> + <Modal.Header> / <Modal.Body> /
 * <Modal.Footer>. Owns chrome (modal-box, sizing), dismissal (ESC + backdrop
 * click), portal to document.body, and a11y plumbing (role, aria-labelledby,
 * initial focus).
 *
 * Chrome aligns with the redesigned panels (RecurringPanel et al.):
 *   - Modal.Header is an eyebrow band (h-9, border-b, text-xs uppercase
 *     tracking-wide muted) — same h-9 strip as the panels.
 *   - Modal.Footer is a bookend band (border-t, full-bleed) so the body sits
 *     between two horizontal dividers like a panel section.
 *   - modal-box has its default padding stripped; body content is auto-wrapped
 *     in `px-4 py-4` so dividers can extend edge-to-edge.
 *
 * Usage:
 *   <Modal onClose={cancel} size="md">
 *     <Modal.Header title="New transaction" subtitle="..." />
 *     <Modal.Body>{fields}</Modal.Body>
 *     <Modal.Footer>{buttons}</Modal.Footer>
 *   </Modal>
 *
 * Forms that own their own footer (TransactionForm/RecurringForm/SplitForm,
 * etc.) render directly as Modal children (not inside Modal.Body). The
 * primitive detects there's no top-level Modal.Footer and switches the body
 * wrapper to `px-4 pt-4` (no bottom padding), so the form's own footer can
 * flush against modal-box bottom. Those form footers use
 * `-mx-4 px-4 py-3 border-t border-base-300 …` to bleed left/right
 * back to the modal-box edges.
 *
 * For loading-only overlays, use <Modal.LoadingShell />.
 *
 * Visibility: the primitive renders whenever it is mounted. Consumers control
 * the lifecycle via conditional rendering ({open && <Modal …/>}).
 */

import {
	Children,
	createContext,
	isValidElement,
	type ReactNode,
	useContext,
	useEffect,
	useId,
	useRef,
} from "react";
import { createPortal } from "react-dom";

type Size = "sm" | "md" | "lg";

const sizeClass: Record<Size, string> = {
	sm: "max-w-sm",
	md: "max-w-md",
	lg: "max-w-lg",
};

type ModalContextValue = { titleId: string };
const ModalContext = createContext<ModalContextValue | null>(null);

function useModalContext() {
	const ctx = useContext(ModalContext);
	if (!ctx) throw new Error("Modal subcomponents must be used inside <Modal>");
	return ctx;
}

type ModalProps = {
	onClose: () => void;
	size?: Size;
	children: ReactNode;
	/** Pass to label the dialog with an existing element id (e.g. a custom title). */
	labelledBy?: string;
	/** Pass when the dialog has no title element (e.g. a loading shell). */
	ariaLabel?: string;
};

function ModalRoot({ onClose, size = "md", children, labelledBy, ariaLabel }: ModalProps) {
	const titleId = useId();
	const boxRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	useEffect(() => {
		const node = boxRef.current;
		if (!node) return;
		const focusable = node.querySelector<HTMLElement>(
			"input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])",
		);
		focusable?.focus();
	}, []);

	const labelProps: Record<string, string> = ariaLabel
		? { "aria-label": ariaLabel }
		: { "aria-labelledby": labelledBy ?? titleId };

	// Separate Modal.Header / Modal.Footer from body content so body can be
	// wrapped in `px-4` while header/footer go full-bleed (their own
	// `px-4` padding sits inside the wrapped band). When Modal.Footer is
	// present, the body wrapper has top + bottom padding (`py-4`) so the
	// body breathes above the footer divider. When the consumer brings its
	// own form footer (form-owned), the wrapper has only top padding
	// (`pt-4`), so the form's footer band flushes with the modal-box bottom.
	const childArray = Children.toArray(children);
	const header = childArray.find((c) => isValidElement(c) && c.type === ModalHeader);
	const footer = childArray.find((c) => isValidElement(c) && c.type === ModalFooter);
	const body = childArray.filter((c) => c !== header && c !== footer);
	const bodyWrapperClass = footer ? "px-4 py-4" : "px-4 pt-4";

	return createPortal(
		<div className="modal modal-open" role="dialog" aria-modal="true" {...labelProps}>
			<div
				ref={boxRef}
				className={`modal-box ${sizeClass[size]} p-0 rounded-box overflow-hidden flex flex-col`}
			>
				<ModalContext.Provider value={{ titleId }}>
					{header}
					{body.length > 0 && <div className={bodyWrapperClass}>{body}</div>}
					{footer}
				</ModalContext.Provider>
			</div>
			<button
				type="button"
				className="modal-backdrop"
				onClick={onClose}
				aria-label="Dismiss modal"
			/>
		</div>,
		document.body,
	);
}

type HeaderProps = {
	title: string;
	subtitle?: ReactNode;
};

function ModalHeader({ title, subtitle }: HeaderProps) {
	const { titleId } = useModalContext();
	return (
		<div className="h-9 flex items-center px-4 border-b border-base-300 shrink-0">
			<div className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold text-base-content/50 min-w-0">
				<span id={titleId} className="truncate">
					{title}
				</span>
				{subtitle != null && (
					<span className="text-base-content/40 normal-case tracking-normal truncate">
						· {subtitle}
					</span>
				)}
			</div>
		</div>
	);
}

type BodyProps = { children: ReactNode };

function ModalBody({ children }: BodyProps) {
	return <div className="flex flex-col gap-3">{children}</div>;
}

type FooterProps = { children: ReactNode };

function ModalFooter({ children }: FooterProps) {
	return (
		<div className="px-4 py-3 border-t border-base-300 flex items-center justify-end gap-2 shrink-0">
			{children}
		</div>
	);
}

type LoadingShellProps = {
	onClose: () => void;
	ariaLabel?: string;
};

function ModalLoadingShell({ onClose, ariaLabel = "Loading" }: LoadingShellProps) {
	return (
		<ModalRoot onClose={onClose} size="sm" ariaLabel={ariaLabel}>
			<div className="flex justify-center py-4">
				<span className="loading loading-spinner loading-md text-primary" />
			</div>
		</ModalRoot>
	);
}

export const Modal = Object.assign(ModalRoot, {
	Header: ModalHeader,
	Body: ModalBody,
	Footer: ModalFooter,
	LoadingShell: ModalLoadingShell,
});
