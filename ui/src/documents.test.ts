import { expect, test } from "bun:test";
import {
	parseHelpCenterSource,
	serializeHelpCenterDocument,
} from "./documents.ts";

test("round-trips a ticket and reconciles the Space document id", () => {
	const result = parseHelpCenterSource(
		JSON.stringify({
			schemaVersion: 1,
			type: "help-center/ticket",
			id: "source-id",
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
		}),
		"doc-1"
	);

	expect(result.kind).toBe("valid");
	if (result.kind === "valid") {
		expect(result.document.id).toBe("doc-1");
		expect(JSON.parse(serializeHelpCenterDocument(result.document)).id).toBe(
			"doc-1"
		);
	}
});

test("rejects invalid JSON and unsupported document versions", () => {
	expect(parseHelpCenterSource("not json", "doc-1").kind).toBe("invalid");
	expect(
		parseHelpCenterSource(
			JSON.stringify({ schemaVersion: 99, type: "help-center/ticket" }),
			"doc-1"
		).kind
	).toBe("invalid");
});

test("preserves future fields while applying safe optional defaults", () => {
	const result = parseHelpCenterSource(
		JSON.stringify({
			schemaVersion: 1,
			type: "help-center/article",
			id: "source-id",
			title: "Export reports",
			body: "Reports can be exported from the Reports view.",
			status: "published",
			tags: ["reports"],
			sourceTicketIds: [],
			createdAt: "2026-08-24T08:00:00.000Z",
			updatedAt: "2026-08-24T08:01:00.000Z",
			usageCount: 2,
			futureField: { keep: true },
			kind: "core-document-kind",
		}),
		"doc-article"
	);

	expect(result.kind).toBe("valid");
	if (
		result.kind === "valid" &&
		result.document.type === "help-center/article"
	) {
		expect(result.document.id).toBe("doc-article");
		expect(result.document.futureField).toEqual({ keep: true });
		expect(JSON.parse(serializeHelpCenterDocument(result.document))).toEqual({
			schemaVersion: 1,
			type: "help-center/article",
			id: "doc-article",
			title: "Export reports",
			body: "Reports can be exported from the Reports view.",
			status: "published",
			tags: ["reports"],
			sourceTicketIds: [],
			createdAt: "2026-08-24T08:00:00.000Z",
			updatedAt: "2026-08-24T08:01:00.000Z",
			usageCount: 2,
			futureField: { keep: true },
		});
	}
});

test("rejects invalid enum values and non-array ticket messages", () => {
	const result = parseHelpCenterSource(
		JSON.stringify({
			schemaVersion: 1,
			type: "help-center/ticket",
			id: "ticket-1",
			subject: "A ticket",
			status: "closed",
			priority: "normal",
			channel: "in-app",
			requester: {
				id: "usr-1",
				name: "Maya Chen",
				email: "maya@example.com",
			},
			tags: [],
			createdAt: "2026-08-24T08:00:00.000Z",
			updatedAt: "2026-08-24T08:01:00.000Z",
			aiState: "none",
			messages: {},
			linkedArticleIds: [],
		}),
		"ticket-1"
	);

	expect(result.kind).toBe("invalid");
});
