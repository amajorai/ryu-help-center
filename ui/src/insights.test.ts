import { expect, test } from "bun:test";
import { deriveInsights } from "./insights.ts";
import type { ArticleDocument, TicketDocument } from "./types.ts";

function ticket(input: {
	id: string;
	status: TicketDocument["status"];
	aiState: TicketDocument["aiState"];
	topic: string | null;
	aiConfidence: number | null;
	createdAt: string;
	updatedAt: string;
}): TicketDocument {
	return {
		schemaVersion: 1,
		type: "help-center/ticket",
		id: input.id,
		subject: input.topic ?? "Uncategorized question",
		status: input.status,
		priority: "normal",
		channel: "in-app",
		requester: {
			id: `user-${input.id}`,
			name: "Ryu operator",
			email: `${input.id}@example.com`,
			company: null,
			avatarSeed: null,
		},
		assigneeId: null,
		tags: [],
		createdAt: input.createdAt,
		updatedAt: input.updatedAt,
		snoozedUntil: null,
		aiState: input.aiState,
		topic: input.topic,
		sentiment: null,
		aiConfidence: input.aiConfidence,
		messages: [],
		linkedArticleIds: [],
	};
}

function article(input: { id: string; usageCount: number }): ArticleDocument {
	return {
		schemaVersion: 1,
		type: "help-center/article",
		id: input.id,
		title: input.id,
		body: "Body",
		status: "published",
		tags: [],
		sourceTicketIds: [],
		createdAt: "2026-08-24T08:00:00.000Z",
		updatedAt: "2026-08-24T08:00:00.000Z",
		usageCount: input.usageCount,
	};
}

test("derives operational counts, resolution time, topics, and article usage", () => {
	const result = deriveInsights(
		[
			ticket({
				id: "open",
				status: "open",
				aiState: "human-reviewed",
				topic: "Billing",
				aiConfidence: 0.9,
				createdAt: "2026-08-24T07:00:00.000Z",
				updatedAt: "2026-08-24T08:00:00.000Z",
			}),
			ticket({
				id: "resolved",
				status: "resolved",
				aiState: "none",
				topic: "Billing",
				aiConfidence: 0.2,
				createdAt: "2026-08-24T06:00:00.000Z",
				updatedAt: "2026-08-24T07:00:00.000Z",
			}),
		],
		[article({ id: "article-1", usageCount: 4 })],
		"2026-08-24T08:00:00.000Z"
	);

	expect(result).toEqual({
		openTickets: 1,
		resolvedTickets: 1,
		humanHandoffRate: 0.5,
		unansweredQuestions: 1,
		averageResolutionTimeMs: 3_600_000,
		topTopics: [{ topic: "Billing", count: 2 }],
		articleUsage: [{ articleId: "article-1", usageCount: 4 }],
	});
});

test("returns finite empty metrics when records and timestamps are missing", () => {
	const result = deriveInsights([], [], "2026-08-24T08:00:00.000Z");

	expect(result.openTickets).toBe(0);
	expect(result.resolvedTickets).toBe(0);
	expect(result.humanHandoffRate).toBe(0);
	expect(result.unansweredQuestions).toBe(0);
	expect(result.averageResolutionTimeMs).toBeNull();
	expect(result.topTopics).toEqual([]);
	expect(result.articleUsage).toEqual([]);
});
