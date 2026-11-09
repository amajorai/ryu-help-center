import { describe, expect, test } from "bun:test";
import { formatMessage, type LiteralMessage } from "@ryu/i18n";
import { createLocalArticle, createLocalTicket } from "./local-drafts.ts";
import { ticketDocumentSchema } from "./schemas.ts";

const GERMAN: Record<string, string> = {
	"New customer": "Neuer Kunde",
	"New support question": "Neue Supportanfrage",
	"Untitled help article": "Unbenannter Hilfeartikel",
};
const german: LiteralMessage = (source, values) =>
	formatMessage(GERMAN[source] ?? source, values ?? {});
const english: LiteralMessage = (source, values) =>
	formatMessage(source, values ?? {});

describe("createLocalTicket", () => {
	test("names the requester and subject in the creator's language", () => {
		const ticket = createLocalTicket(german);
		expect(ticket.requester.name).toBe("Neuer Kunde");
		expect(ticket.subject).toBe("Neue Supportanfrage");
		expect(ticketDocumentSchema.safeParse(ticket).success).toBe(true);
	});

	test("keeps the English defaults", () => {
		const ticket = createLocalTicket(english);
		expect(ticket.requester.name).toBe("New customer");
		expect(ticket.subject).toBe("New support question");
	});
});

describe("createLocalArticle", () => {
	test("titles a new article in the creator's language", () => {
		const article = createLocalArticle(german);
		expect(article.title).toBe("Unbenannter Hilfeartikel");
		expect(article.status).toBe("draft");
		expect(article.body).toBe("");
	});

	test("keeps the English default title", () => {
		expect(createLocalArticle(english).title).toBe("Untitled help article");
	});
});
