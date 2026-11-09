// Local drafts the Help Center creates for a new ticket or help article.
//
// Their names are user-editable, so they are written in the creator's UI
// language at creation time (like any name a person types) rather than as fixed
// English placeholders.

import type { LiteralMessage } from "@ryu/i18n";
import type { ArticleDocument, TicketDocument } from "./types.ts";

export function createLocalTicket(tl: LiteralMessage): TicketDocument {
	const now = new Date().toISOString();
	return {
		aiConfidence: null,
		aiState: "none",
		assigneeId: null,
		channel: "in-app",
		createdAt: now,
		id: `local-ticket-${Date.now()}`,
		linkedArticleIds: [],
		messages: [],
		priority: "normal",
		requester: {
			avatarSeed: "new-customer",
			company: null,
			email: "customer@example.com",
			id: `local-user-${Date.now()}`,
			name: tl("New customer"),
		},
		schemaVersion: 1,
		sentiment: null,
		snoozedUntil: null,
		status: "open",
		subject: tl("New support question"),
		tags: ["new"],
		topic: null,
		type: "help-center/ticket",
		updatedAt: now,
	};
}

export function createLocalArticle(tl: LiteralMessage): ArticleDocument {
	const now = new Date().toISOString();
	return {
		body: "",
		createdAt: now,
		id: `local-article-${Date.now()}`,
		schemaVersion: 1,
		sourceTicketIds: [],
		status: "draft",
		tags: [],
		title: tl("Untitled help article"),
		type: "help-center/article",
		updatedAt: now,
		usageCount: 0,
	};
}
