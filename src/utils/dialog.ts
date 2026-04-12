/**
 * Safely opens a <dialog> as a modal.
 * Guards against the InvalidStateError thrown when the dialog is already
 * open as a non-modal (e.g. React 19 setting the `open` attribute before
 * the useEffect fires).
 */
export function openAsModal(dialog: HTMLDialogElement | null | undefined): void {
	if (!dialog) return;
	if (dialog.open && !dialog.matches(":modal")) dialog.close();
	if (!dialog.open) dialog.showModal();
}
