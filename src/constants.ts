/**
 * Top-of-modal header height (px). Used by useDragToDismiss to restrict
 * drag initiation to the title row. Matches the modal's visual title area
 * plus DaisyUI's top padding.
 */
export const HEADER_HEIGHT_PX = 72;

/**
 * Interval at which the Clerk JWT is refreshed in the client. 55 minutes —
 * a 5-minute safety margin before Clerk's 1-hour JWT expiry to tolerate
 * clock skew and refresh latency.
 */
export const CLERK_TOKEN_REFRESH_MS = 55 * 60 * 1000;

/**
 * Fraction of the modal-box height past which a downward drag dismisses
 * the sheet (useDragToDismiss). Consumed as `box.offsetHeight * this`.
 */
export const DRAG_DISMISS_THRESHOLD = 0.35;
