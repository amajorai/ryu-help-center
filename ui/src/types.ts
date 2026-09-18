export type TicketStatus = "open" | "waiting" | "snoozed" | "resolved";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketChannel = "in-app" | "email" | "chat";
export type AiState = "none" | "suggested" | "human-reviewed";
export type ArticleStatus = "draft" | "published";
export type TicketSentiment = "positive" | "neutral" | "negative";
export type TicketMessageAuthor = "customer" | "agent" | "ai" | "system";

export interface TicketRequester {
	avatarSeed: string | null;
	company: string | null;
	email: string;
	id: string;
	name: string;
	[key: string]: unknown;
}

export interface TicketMessage {
	author: TicketMessageAuthor;
	authorName: string;
	body: string;
	createdAt: string;
	id: string;
	internal: boolean;
	[key: string]: unknown;
}

export interface TicketDocument {
	aiConfidence: number | null;
	aiState: AiState;
	assigneeId: string | null;
	channel: TicketChannel;
	createdAt: string;
	id: string;
	linkedArticleIds: string[];
	messages: TicketMessage[];
	priority: TicketPriority;
	requester: TicketRequester;
	schemaVersion: 1;
	sentiment: TicketSentiment | null;
	snoozedUntil: string | null;
	status: TicketStatus;
	subject: string;
	tags: string[];
	topic: string | null;
	type: "help-center/ticket";
	updatedAt: string;
	[key: string]: unknown;
}

export interface ArticleDocument {
	body: string;
	createdAt: string;
	id: string;
	schemaVersion: 1;
	sourceTicketIds: string[];
	status: ArticleStatus;
	tags: string[];
	title: string;
	type: "help-center/article";
	updatedAt: string;
	usageCount: number;
	[key: string]: unknown;
}

export type HelpCenterDocument = TicketDocument | ArticleDocument;

export function isTicketDocument(
	document: HelpCenterDocument
): document is TicketDocument {
	return document.type === "help-center/ticket";
}

export function isArticleDocument(
	document: HelpCenterDocument
): document is ArticleDocument {
	return document.type === "help-center/article";
}
