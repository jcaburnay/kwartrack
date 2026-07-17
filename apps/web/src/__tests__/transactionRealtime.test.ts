import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (payload: unknown) => void;
type ListenerConfig = {
	event: string;
	schema: string;
	table: string;
	filter: string;
};

const listeners: Array<{ config: ListenerConfig; handler: Handler }> = [];
const subscribe = vi.fn();
const removeChannel = vi.fn();
const channelFactory = vi.fn();

type ChannelMock = {
	on: (event: string, config: ListenerConfig, handler: Handler) => ChannelMock;
	subscribe: () => ChannelMock;
};

function makeChannel(): ChannelMock {
	const ch: ChannelMock = {
		on(_event, config, handler) {
			listeners.push({ config, handler });
			return ch;
		},
		subscribe() {
			subscribe();
			return ch;
		},
	};
	return ch;
}

vi.mock("../lib/supabase", () => ({
	supabase: {
		channel: (name: string) => {
			channelFactory(name);
			return makeChannel();
		},
		removeChannel: (ch: unknown) => removeChannel(ch),
	},
}));

const { subscribeTransactionRealtime } = await import("../hooks/useTransactionRealtime");
const { useTransactionVersion } = await import("../hooks/useTransactionVersion");

describe("subscribeTransactionRealtime", () => {
	beforeEach(() => {
		listeners.length = 0;
		channelFactory.mockClear();
		subscribe.mockClear();
		removeChannel.mockClear();
	});

	it("opens one channel scoped to the user and registers transaction + account listeners", () => {
		subscribeTransactionRealtime("u1");
		expect(channelFactory).toHaveBeenCalledTimes(1);
		expect(channelFactory).toHaveBeenCalledWith("transactions:u1");
		expect(subscribe).toHaveBeenCalledTimes(1);

		const tables = listeners.map((l) => l.config.table).sort();
		expect(tables).toEqual(["account", "transaction"]);

		for (const l of listeners) {
			expect(l.config.event).toBe("*");
			expect(l.config.schema).toBe("public");
			expect(l.config.filter).toBe("user_id=eq.u1");
		}
	});

	it("bumps the transaction version when an inbound event fires", () => {
		const probe = renderHook(() => useTransactionVersion());
		const before = probe.result.current;

		subscribeTransactionRealtime("u1");
		act(() => {
			listeners[0].handler({ eventType: "INSERT" });
		});
		expect(probe.result.current).toBe(before + 1);

		act(() => {
			listeners[1].handler({ eventType: "UPDATE" });
		});
		expect(probe.result.current).toBe(before + 2);
	});

	it("returns a teardown that removes the channel", () => {
		const off = subscribeTransactionRealtime("u1");
		expect(removeChannel).not.toHaveBeenCalled();
		off();
		expect(removeChannel).toHaveBeenCalledTimes(1);
	});

	it("filters events by the supplied user id", () => {
		subscribeTransactionRealtime("u-abc");
		expect(listeners.every((l) => l.config.filter === "user_id=eq.u-abc")).toBe(true);
	});
});
