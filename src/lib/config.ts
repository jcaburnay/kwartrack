export const SUPPORT_EMAIL = "jonathan@caburnay.dev";
export const RELEASES_URL = "https://github.com/jcaburnay/kwartrack/releases";
export const APPROVED_CHATGPT_CLIENT_ID = "f5d50b9f-94ce-4aa9-b598-ade3829361f9";

const approvedChatGptRedirectOrigins = new Set(["https://chatgpt.com", "https://chat.openai.com"]);

export function isApprovedChatGptRedirect(redirectUrl: string) {
	try {
		return approvedChatGptRedirectOrigins.has(new URL(redirectUrl).origin);
	} catch {
		return false;
	}
}
