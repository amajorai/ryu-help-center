import { afterEach, describe, expect, test } from "bun:test";
import {
	createHelpCenterDocument,
	getRyuBridge,
	loadHelpCenterDocuments,
	searchHelpCenter,
} from "./bridge.ts";
import type { RyuBridge } from "./ryu.d.ts";
import { ensureHelpCenterSpace } from "./storage.ts";
import type { TicketDocument } from "./types.ts";

function setBridge(bridge: RyuBridge): void {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: { ryu: bridge },
	});
}

function clearBridge(): void {
	Reflect.deleteProperty(globalThis, "window");
}

function ticket(id: string): TicketDocument {
	return {
		schemaVersion: 1,
		type: "help-center/ticket",
		id,
		subject: "Cannot export a report",
		status: "open",
		priority: "high",
		channel: "in-app",
		requester: {
			id: "usr-1",
			name: "Maya Chen",
			email: "maya@example.com",
			company: null,
			avatarSeed: null,
		},
		assigneeId: null,
		tags: ["reports"],
		createdAt: "2026-08-24T08:00:00.000Z",
		updatedAt: "2026-08-24T08:01:00.000Z",
		snoozedUntil: null,
		aiState: "none",
		topic: null,
		sentiment: null,
		aiConfidence: null,
		messages: [],
		linkedArticleIds: [],
	};
}

afterEach(clearBridge);

describe("bridge availability", () => {
	test("reports an unavailable bridge without inventing a fallback", () => {
		clearBridge();
		expect(getRyuBridge()).toBeNull();
	});
});

test("loads valid Space documents and counts malformed Help Center records", async () => {
	const valid = ticket("doc-1");
	const calls: string[] = [];
	const bridge: RyuBridge = {
		spaces: {
			ensureSpace: () => Promise.resolve("space-1"),
			listDocs: () => {
				calls.push("listDocs");
				return Promise.resolve([
					{ id: "doc-1", title: valid.subject, updated_at: 1 },
					{ id: "doc-2", title: "Broken", updated_at: 2 },
					{ id: "other", title: "Other", updated_at: 3 },
				]);
			},
			getDoc: ({ doc_id }) => {
				calls.push(`getDoc:${doc_id}`);
				if (doc_id === "doc-1") {
					return Promise.resolve({
						id: doc_id,
						kind: "document",
						source: JSON.stringify(valid),
						title: valid.subject,
					});
				}
				if (doc_id === "doc-2") {
					return Promise.resolve({
						id: doc_id,
						kind: "document",
						source: JSON.stringify({
							schemaVersion: 1,
							type: "help-center/ticket",
							id: doc_id,
						}),
						title: "Broken",
					});
				}
				return Promise.resolve({
					id: doc_id,
					kind: "document",
					source: JSON.stringify({ schemaVersion: 1, type: "notes/note" }),
					title: "Other",
				});
			},
			createDoc: () => Promise.resolve("new-doc"),
			updateDoc: () => Promise.resolve(),
			deleteDoc: () => Promise.resolve(),
			search: () => Promise.resolve([]),
		},
		storage: {
			get: () => Promise.resolve(null),
			set: () => Promise.resolve(),
		},
		model: { complete: () => Promise.resolve("") },
	};
	setBridge(bridge);

	const loaded = await loadHelpCenterDocuments("space-1");

	expect(loaded.documents).toHaveLength(1);
	expect(loaded.documents[0]?.id).toBe("doc-1");
	expect(loaded.invalidCount).toBe(1);
	expect(calls).toEqual([
		"listDocs",
		"getDoc:doc-1",
		"getDoc:doc-2",
		"getDoc:other",
	]);
});

test("ensures storage identity before creating a Help Center Space", async () => {
	const calls: string[] = [];
	const bridge: RyuBridge = {
		spaces: {
			ensureSpace: (input) => {
				calls.push(`ensure:${input.name}`);
				return Promise.resolve("space-created");
			},
			listDocs: () => Promise.resolve([]),
			getDoc: () => Promise.resolve(null),
			createDoc: () => Promise.resolve("doc-1"),
			updateDoc: () => Promise.resolve(),
			deleteDoc: () => Promise.resolve(),
			search: () => Promise.resolve([]),
		},
		storage: {
			get: () => {
				calls.push("storage.get");
				return Promise.resolve(null);
			},
			set: ({ key, value }) => {
				calls.push(`storage.set:${key}:${value}`);
				return Promise.resolve();
			},
		},
		model: { complete: () => Promise.resolve("") },
	};
	setBridge(bridge);

	expect(await ensureHelpCenterSpace()).toBe("space-created");
	expect(calls).toEqual([
		"storage.get",
		"ensure:Help Center",
		"storage.set:help-center.space_id:space-created",
	]);
});

test("cleans up a created Space document when its update fails", async () => {
	const calls: string[] = [];
	const bridge: RyuBridge = {
		spaces: {
			ensureSpace: () => Promise.resolve("space-1"),
			listDocs: () => Promise.resolve([]),
			getDoc: () => Promise.resolve(null),
			createDoc: () => {
				calls.push("createDoc");
				return Promise.resolve("doc-created");
			},
			updateDoc: () => {
				calls.push("updateDoc");
				return Promise.reject(new Error("update failed"));
			},
			deleteDoc: ({ doc_id }) => {
				calls.push(`deleteDoc:${doc_id}`);
				return Promise.resolve();
			},
			search: () => Promise.resolve([]),
		},
		storage: { get: () => Promise.resolve(null), set: () => Promise.resolve() },
		model: { complete: () => Promise.resolve("") },
	};
	setBridge(bridge);

	await expect(
		createHelpCenterDocument("space-1", ticket("draft"))
	).rejects.toThrow("update failed");
	expect(calls).toEqual(["createDoc", "updateDoc", "deleteDoc:doc-created"]);
});

test("validates and bounds Space search matches", async () => {
	const bridge: RyuBridge = {
		spaces: {
			ensureSpace: () => Promise.resolve("space-1"),
			listDocs: () => Promise.resolve([]),
			getDoc: () => Promise.resolve(null),
			createDoc: () => Promise.resolve("doc-1"),
			updateDoc: () => Promise.resolve(),
			deleteDoc: () => Promise.resolve(),
			search: () =>
				Promise.resolve([
					{
						chunk_id: "chunk-1",
						content: "x".repeat(2000),
						distance: 0.1,
						document_id: "doc-1",
					},
					{
						chunk_id: "bad",
						content: "not a distance",
						distance: Number.NaN,
						document_id: "doc-2",
					},
				]),
		},
		storage: { get: () => Promise.resolve(null), set: () => Promise.resolve() },
		model: { complete: () => Promise.resolve("") },
	};
	setBridge(bridge);

	const matches = await searchHelpCenter("space-1", "export", 4);

	expect(matches).toHaveLength(1);
	expect(matches[0]?.content).toHaveLength(1200);
});
