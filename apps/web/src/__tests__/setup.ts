import "@testing-library/jest-dom/vitest";

// Recharts' ResponsiveContainer uses ResizeObserver, which jsdom doesn't provide.
class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// jsdom doesn't implement matchMedia. Provide an inert stub so code that
// reads `prefers-color-scheme` (e.g. useTheme) doesn't blow up under tests.
if (typeof window !== "undefined" && !window.matchMedia) {
	window.matchMedia = (query: string) =>
		({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false,
		}) as unknown as MediaQueryList;
}
