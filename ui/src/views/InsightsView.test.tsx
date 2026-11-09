import { describe, expect, test } from "bun:test";
import { I18nProvider } from "@ryu/i18n/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TicketDocument } from "../types.ts";
import { InsightsView } from "./InsightsView.tsx";

const UNANSWERED =
	"{count, plural, one {# unanswered question needs attention.} other {# unanswered questions need attention.}}";

// Stub rows standing in for the catalog rows the coordinator generates.
const DE = {
	[UNANSWERED]:
		"{count, plural, one {# unbeantwortete Frage braucht Aufmerksamkeit.} other {# unbeantwortete Fragen brauchen Aufmerksamkeit.}}",
};
const AR = {
	[UNANSWERED]:
		"{count, plural, zero {لا أسئلة دون إجابة.} one {سؤال واحد دون إجابة يحتاج إلى متابعة.} two {سؤالان دون إجابة يحتاجان إلى متابعة.} few {# أسئلة دون إجابة تحتاج إلى متابعة.} many {# سؤالًا دون إجابة يحتاج إلى متابعة.} other {# سؤال دون إجابة يحتاج إلى متابعة.}}",
};

function lowConfidenceTicket(index: number): TicketDocument {
	const id = `ticket-${index}`;
	return {
		aiConfidence: 0.2,
		aiState: "suggested",
		assigneeId: null,
		channel: "in-app",
		createdAt: "2026-01-01T00:00:00.000Z",
		id,
		linkedArticleIds: [],
		messages: [],
		priority: "normal",
		requester: {
			avatarSeed: null,
			company: null,
			email: `${id}@example.com`,
			id: `user-${id}`,
			name: "Ryu operator",
		},
		schemaVersion: 1,
		sentiment: null,
		snoozedUntil: null,
		status: "open",
		subject: "Billing question",
		tags: [],
		topic: null,
		type: "help-center/ticket",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};
}

function render(locale: string, unanswered: number): string {
	const tickets = Array.from({ length: unanswered }, (_, index) =>
		lowConfidenceTicket(index)
	);
	return renderToStaticMarkup(
		<I18nProvider
			initialLocale={locale}
			manageDocument={false}
			overlays={{ ar: AR, de: DE }}
		>
			<InsightsView articles={[]} tickets={tickets} />
		</I18nProvider>
	);
}

describe("InsightsView unanswered questions", () => {
	test("uses the English singular and plural forms", () => {
		expect(render("en", 1)).toContain("1 unanswered question needs attention.");
		expect(render("en", 2)).toContain("2 unanswered questions need attention.");
	});

	test("selects the German singular and plural forms", () => {
		const one = render("de", 1);
		expect(one).toContain("1 unbeantwortete Frage braucht Aufmerksamkeit.");
		expect(one).not.toContain("unanswered");
		expect(render("de", 11)).toContain(
			"11 unbeantwortete Fragen brauchen Aufmerksamkeit."
		);
	});

	test("selects distinct Arabic forms for 1, 2 and 11", () => {
		expect(render("ar", 1)).toContain("سؤال واحد دون إجابة يحتاج إلى متابعة.");
		expect(render("ar", 2)).toContain("سؤالان دون إجابة يحتاجان إلى متابعة.");
		expect(render("ar", 11)).toContain("11 سؤالًا دون إجابة يحتاج إلى متابعة.");
	});
});
