import { describe, expect, test } from "bun:test";
import { I18nProvider } from "@ryu/i18n/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TicketDocument } from "../types.ts";
import { ResolutionRibbon } from "./ResolutionRibbon.tsx";

// Stub rows standing in for the catalog rows the coordinator generates.
const JA = {
	"{step}: {state}": "{step}：{state}",
	"A human operator owns the next decision.":
		"次の判断は担当オペレーターが行います。",
	"AI suggested": "AI が提案",
	"Completed step": "完了したステップ",
	"Current step": "現在のステップ",
	"Human working": "担当者が対応中",
	"Reopen ticket": "チケットを再開",
	Resolved: "解決済み",
	"Resolve ticket": "チケットを解決",
	"Review suggestion": "提案を確認",
	"Ryu prepared a suggestion for human review.":
		"Ryu が担当者の確認用に提案を用意しました。",
	"This ticket is resolved in the local Help Center record.":
		"このチケットはローカルのヘルプセンター記録で解決済みです。",
	"Ticket resolution status": "チケットの解決状況",
	"Upcoming step": "今後のステップ",
};
const AR = {
	"{step}: {state}": "{step}: {state}",
	"AI suggested": "اقتراح الذكاء الاصطناعي",
	"Current step": "الخطوة الحالية",
	"Completed step": "خطوة مكتملة",
	"Human working": "قيد المعالجة البشرية",
	"Reopen ticket": "إعادة فتح التذكرة",
	"Resolve ticket": "حل التذكرة",
	"Review suggestion": "مراجعة الاقتراح",
};

function ticket(
	status: TicketDocument["status"],
	aiState: TicketDocument["aiState"]
): TicketDocument {
	return {
		aiConfidence: 0.8,
		aiState,
		assigneeId: null,
		channel: "in-app",
		createdAt: "2026-01-01T00:00:00.000Z",
		id: "ticket-1",
		linkedArticleIds: [],
		messages: [],
		priority: "normal",
		requester: {
			avatarSeed: null,
			company: null,
			email: "ticket-1@example.com",
			id: "user-ticket-1",
			name: "Ryu operator",
		},
		schemaVersion: 1,
		sentiment: null,
		snoozedUntil: null,
		status,
		subject: "Billing question",
		tags: [],
		topic: null,
		type: "help-center/ticket",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};
}

function render(locale: string, target: TicketDocument): string {
	return renderToStaticMarkup(
		<I18nProvider
			initialLocale={locale}
			manageDocument={false}
			overlays={{ ar: AR, ja: JA }}
		>
			<ResolutionRibbon onAction={() => undefined} ticket={target} />
		</I18nProvider>
	);
}

function ariaLabels(html: string): string[] {
	return [...html.matchAll(/aria-label="([^"]*)"/g)].map((match) =>
		String(match[1])
	);
}

function buttonText(html: string): string {
	const button = /<button[^>]*>([\s\S]*?)<\/button>/.exec(html)?.[1] ?? "";
	return button.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "");
}

describe("ResolutionRibbon localization", () => {
	test("keeps the English button and step labels", () => {
		const html = render("en", ticket("open", "suggested"));
		expect(buttonText(html)).toBe("Review suggestion");
		expect(ariaLabels(html)).toEqual([
			"Ticket resolution status",
			"AI suggested: Current step",
			"Human working: Upcoming step",
			"Resolved: Upcoming step",
		]);
	});

	test("localizes the button and every step aria-label in Japanese", () => {
		const html = render("ja", ticket("open", "human-reviewed"));
		expect(buttonText(html)).toBe("チケットを解決");
		const labels = ariaLabels(html);
		expect(labels).toEqual([
			"チケットの解決状況",
			"AI が提案：完了したステップ",
			"担当者が対応中：現在のステップ",
			"解決済み：今後のステップ",
		]);
		for (const label of labels) {
			expect(label).not.toMatch(/[A-Za-z]{3,}/);
		}
		expect(html).toContain("次の判断は担当オペレーターが行います。");
		expect(html).not.toContain("Resolve ticket");
	});

	test("localizes the Arabic button for each next action", () => {
		const suggested = render("ar", ticket("open", "suggested"));
		expect(buttonText(suggested)).toBe("مراجعة الاقتراح");
		expect(ariaLabels(suggested)).toContain(
			"اقتراح الذكاء الاصطناعي: الخطوة الحالية"
		);
		const working = render("ar", ticket("open", "human-reviewed"));
		expect(buttonText(working)).toBe("حل التذكرة");
		expect(ariaLabels(working)).toContain(
			"اقتراح الذكاء الاصطناعي: خطوة مكتملة"
		);
		expect(buttonText(render("ar", ticket("resolved", "suggested")))).toBe(
			"إعادة فتح التذكرة"
		);
	});
});
