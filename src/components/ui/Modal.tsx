/**
 * Modal primitive — compound API: <Modal> + <Modal.Header> / <Modal.Body> /
 * <Modal.Footer>. Owns chrome (modal-box, sizing), dismissal (ESC + backdrop
 * click), portal to document.body, and a11y plumbing (role, aria-labelledby,
 * initial focus).
 *
 * Usage:
 *   <Modal onClose={cancel} size="md">
 *     <Modal.Header title="New transaction" subtitle="..." />
 *     <Modal.Body>{fields}</Modal.Body>
 *     <Modal.Footer>{buttons}</Modal.Footer>
 *   </Modal>
 *
 * For loading-only overlays (no header, body, or footer), use
 * <Modal.LoadingShell />.
 *
 * Visibility: the primitive renders whenever it is mounted. Consumers control
 * the lifecycle via conditional rendering ({open && <Modal …/>}).
 */

import { createContext, type ReactNode, useContext, useEffect, useId, useRef } from "react";
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

	return createPortal(
		<div className="modal modal-open" role="dialog" aria-modal="true" {...labelProps}>
			<div ref={boxRef} className={`modal-box ${sizeClass[size]}`}>
				<ModalContext.Provider value={{ titleId }}>{children}</ModalContext.Provider>
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
		<div className="mb-4">
			<h3 id={titleId} className="text-lg font-semibold">
				{title}
			</h3>
			{subtitle != null && <p className="text-xs text-base-content/60 mt-1">{subtitle}</p>}
		</div>
	);
}

type BodyProps = { children: ReactNode };

function ModalBody({ children }: BodyProps) {
	return <div className="flex flex-col gap-3">{children}</div>;
}

type FooterProps = { children: ReactNode };

function ModalFooter({ children }: FooterProps) {
	return <div className="flex items-center justify-end gap-2 pt-2 mt-3">{children}</div>;
}

type LoadingShellProps = {
	onClose: () => void;
	ariaLabel?: string;
};

function ModalLoadingShell({ onClose, ariaLabel = "Loading" }: LoadingShellProps) {
	return (
		<ModalRoot onClose={onClose} size="sm" ariaLabel={ariaLabel}>
			<div className="flex justify-center py-8">
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
