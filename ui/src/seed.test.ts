import { afterEach, expect, test } from "bun:test";
import type { RyuBridge } from "./ryu.d.ts";
import { seedSampleWorkspace } from "./seed.ts";

function setBridge(bridge: RyuBridge): void {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: { ryu: bridge },
	});
}

afterEach(() => {
	Reflect.deleteProperty(globalThis, "window");
});

test("returns deterministic in-memory sample records in Demo mode without a bridge", async () => {
	Reflect.deleteProperty(globalThis, "window");

	const result = await seedSampleWorkspace("demo-space");

	expect(result.mode).toBe("demo");
	expect(result.documents).toHaveLength(6);
	expect(
		result.documents.filter(
			(document) => document.type === "help-center/ticket"
		)
	).toHaveLength(3);
	expect(
		result.documents.filter(
			(document) => document.type === "help-center/article"
		)
	).toHaveLength(3);
});

test("writes every deterministic sample record through the Space bridge", async () => {
	const calls: string[] = [];
	let nextId = 0;
	const bridge: RyuBridge = {
		spaces: {
			ensureSpace: () => Promise.resolve("space-1"),
			listDocs: () => Promise.resolve([]),
			getDoc: () => Promise.resolve(null),
			createDoc: ({ title }) => {
				calls.push(`create:${title}`);
				nextId += 1;
				return Promise.resolve(`doc-${nextId}`);
			},
			updateDoc: ({ doc_id }) => {
				calls.push(`update:${doc_id}`);
				return Promise.resolve();
			},
			deleteDoc: () => Promise.resolve(),
			search: () => Promise.resolve([]),
		},
		storage: { get: () => Promise.resolve(null), set: () => Promise.resolve() },
		model: { complete: () => Promise.resolve("") },
	};
	setBridge(bridge);

	const result = await seedSampleWorkspace("space-1");

	expect(result.mode).toBe("live");
	expect(result.documents).toHaveLength(6);
	expect(calls.filter((call) => call.startsWith("create:"))).toHaveLength(6);
	expect(calls.filter((call) => call.startsWith("update:"))).toHaveLength(6);
});
