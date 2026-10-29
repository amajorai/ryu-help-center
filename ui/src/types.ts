import type { z } from "zod";
import type {
	articleDocumentSchema,
	articleStatusSchema,
	ticketAiStateSchema,
	ticketChannelSchema,
	ticketDocumentSchema,
	ticketMessageAuthorSchema,
	ticketMessageSchema,
	ticketPrioritySchema,
	ticketRequesterSchema,
	ticketSentimentSchema,
	ticketStatusSchema,
} from "./schemas.ts";

export type TicketStatus = z.output<typeof ticketStatusSchema>;
export type TicketPriority = z.output<typeof ticketPrioritySchema>;
export type TicketChannel = z.output<typeof ticketChannelSchema>;
export type AiState = z.output<typeof ticketAiStateSchema>;
export type ArticleStatus = z.output<typeof articleStatusSchema>;
export type TicketSentiment = z.output<typeof ticketSentimentSchema>;
export type TicketMessageAuthor = z.output<typeof ticketMessageAuthorSchema>;

export type TicketRequester = z.output<typeof ticketRequesterSchema>;
export type TicketMessage = z.output<typeof ticketMessageSchema>;
export type TicketDocument = z.output<typeof ticketDocumentSchema>;
export type ArticleDocument = z.output<typeof articleDocumentSchema>;

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
