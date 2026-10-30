import { describe, expect, test } from "bun:test";
import {
	parseHelpCenterSource,
	serializeHelpCenterDocument,
} from "./documents.ts";
import {
	articleDocumentSchema,
	helpCenterJsonDocumentSchema,
	ticketDocumentSchema,
} from "./schemas.ts";
import { getSampleWorkspaceDocuments } from "./seed.ts";
import { isArticleDocument, isTicketDocument } from "./types.ts";

describe("Help Center document contracts", () => {
	test("keeps additive native JSON fields and validates prototype-named values", () => {
		const ticket = getSampleWorkspaceDocuments().find(isTicketDocument);
		expect(ticket).toBeDefined();
		if (!ticket) {
			throw new Error("Sample ticket missing");
		}
		const metadata = JSON.parse(
			'{"__proto__":{"source":"native"},"overflow":1e400}'
		);
		const record = { ...ticket, metadata };
		expect(Object.is(ticketDocumentSchema.parse(record), record)).toBe(true);
		expect(
			Object.is(helpCenterJsonDocumentSchema.parse(metadata), metadata)
		).toBe(true);
		expect(
			helpCenterJsonDocumentSchema.safeParse(
				Object.fromEntries([["__proto__", () => {}]])
			).success
		).toBe(false);
		expect(
			ticketDocumentSchema.safeParse({ ...ticket, status: "closed" }).success
		).toBe(false);
	});
	test("retains legacy optional defaults, confidence clamping and message error order", () => {
		const ticket = getSampleWorkspaceDocuments().find(isTicketDocument);
		if (!ticket) {
			throw new Error("Sample ticket missing");
		}
		const source = {
			...ticket,
			aiConfidence: 4,
			assigneeId: " ",
			topic: undefined,
			messages: [null],
		};
		expect(
			parseHelpCenterSource(JSON.stringify(source), "document-id")
		).toEqual({ kind: "invalid", reason: "Invalid ticket message" });
		const parsed = parseHelpCenterSource(
			JSON.stringify({ ...source, messages: [] }),
			"document-id"
		);
		expect(parsed.kind).toBe("valid");
		if (parsed.kind !== "valid" || !isTicketDocument(parsed.document)) {
			throw new Error("Ticket did not parse");
		}
		expect(parsed.document.aiConfidence).toBe(1);
		expect(parsed.document.assigneeId).toBeNull();
		expect(parsed.document.topic).toBeNull();
		expect(parsed.document.id).toBe("document-id");
	});
	test("preserves legacy large integer usage counts and deterministic extra-field serialization", () => {
		const article = getSampleWorkspaceDocuments().find(isArticleDocument);
		if (!article) {
			throw new Error("Sample article missing");
		}
		const record = {
			...article,
			usageCount: 1e20,
			zeta: true,
			alpha: { retained: true },
			kind: "host-kind",
		};
		expect(Object.is(articleDocumentSchema.parse(record), record)).toBe(true);
		const result = parseHelpCenterSource(JSON.stringify(record), article.id);
		expect(result.kind).toBe("valid");
		if (result.kind !== "valid") {
			throw new Error("Article did not parse");
		}
		const serialized = serializeHelpCenterDocument(result.document);
		expect(serialized.indexOf('"alpha"')).toBeLessThan(
			serialized.indexOf('"zeta"')
		);
		expect(serialized).not.toContain('"host-kind"');
		expect(JSON.parse(serialized).usageCount).toBe(1e20);
	});
});
