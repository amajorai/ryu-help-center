import { getRyuBridge, searchHelpCenter } from "./bridge.ts";
import type { RyuSpaceMatch } from "./ryu.d.ts";
import { getSampleWorkspaceDocuments } from "./seed.ts";
import type {
	TicketDocument,
	TicketPriority,
	TicketSentiment,
} from "./types.ts";

const MAX_PROMPT_LENGTH = 12_000;
const MAX_CONTEXT_MATCHES = 5;
const MAX_MATCH_CONTENT_LENGTH = 900;
const MAX_TICKET_MESSAGES = 8;

export interface TicketClassification {
	confidence: number;
	priority: TicketPriority;
	rationale: string;
	sentiment: TicketSentiment;
	topic: string;
}

export interface ReplySuggestion {
	citedArticleIds: string[];
	reply: string;
	shouldEscalate: boolean;
	uncertainty: string | null;
}

export interface AgentSettings {
	guardrails?: string;
	instructions?: string;
	name?: string;
	tone?: string;
}

export interface AiContext {
	effort?: string;
	matches?: RyuSpaceMatch[];
	model?: string;
	provider?: string;
	settings?: AgentSettings;
	spaceId?: string;
}

export interface CustomerAnswer {
	answer: string;
	citedArticleIds: string[];
	mode: "demo" | "live";
	shouldEscalate: boolean;
	uncertainty: string | null;
}

export type AiErrorKind =
	| "bridge-unavailable"
	| "provider-failure"
	| "malformed-output";

export class HelpCenterAiError extends Error {
	readonly kind: AiErrorKind;

	constructor(kind: AiErrorKind, message: string) {
		super(message);
		this.name = "HelpCenterAiError";
		this.kind = kind;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(source: string, label: string): Record<string, unknown> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(source);
	} catch {
		throw new HelpCenterAiError("malformed-output", `Invalid ${label}`);
	}
	if (!isRecord(parsed)) {
		throw new HelpCenterAiError("malformed-output", `Invalid ${label}`);
	}
	return parsed;
}

function requiredText(
	record: Record<string, unknown>,
	field: string,
	label: string
): string {
	const value = record[field];
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new HelpCenterAiError(
			"malformed-output",
			`Invalid ${label}: ${field} must be non-empty text`
		);
	}
	return value.trim();
}

function parseEnum<T extends string>(
	record: Record<string, unknown>,
	field: string,
	values: readonly T[],
	label: string
): T {
	const value = record[field];
	if (typeof value !== "string") {
		throw new HelpCenterAiError(
			"malformed-output",
			`Invalid ${label}: ${field} is not supported`
		);
	}
	const match = values.find((candidate) => candidate === value);
	if (match === undefined) {
		throw new HelpCenterAiError(
			"malformed-output",
			`Invalid ${label}: ${field} is not supported`
		);
	}
	return match;
}

export function parseClassificationResponse(
	source: string
): TicketClassification {
	const record = readJson(source, "classification response");
	const confidence = record.confidence;
	if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
		throw new HelpCenterAiError(
			"malformed-output",
			"Invalid classification response: confidence must be a number"
		);
	}
	return {
		topic: requiredText(record, "topic", "classification response"),
		priority: parseEnum(
			record,
			"priority",
			["low", "normal", "high", "urgent"],
			"classification response"
		),
		sentiment: parseEnum(
			record,
			"sentiment",
			["positive", "neutral", "negative"],
			"classification response"
		),
		confidence: Math.min(1, Math.max(0, confidence)),
		rationale: requiredText(record, "rationale", "classification response"),
	};
}

export function parseReplySuggestion(source: string): ReplySuggestion {
	const record = readJson(source, "reply suggestion");
	const articleIds = record.citedArticleIds;
	if (
		!(
			Array.isArray(articleIds) &&
			articleIds.every(
				(articleId): articleId is string =>
					typeof articleId === "string" && articleId.trim().length > 0
			)
		)
	) {
		throw new HelpCenterAiError(
			"malformed-output",
			"Invalid reply suggestion: citedArticleIds must be text ids"
		);
	}
	if (typeof record.shouldEscalate !== "boolean") {
		throw new HelpCenterAiError(
			"malformed-output",
			"Invalid reply suggestion: shouldEscalate must be boolean"
		);
	}
	const uncertainty = record.uncertainty;
	if (
		uncertainty !== null &&
		(typeof uncertainty !== "string" || uncertainty.trim().length === 0)
	) {
		throw new HelpCenterAiError(
			"malformed-output",
			"Invalid reply suggestion: uncertainty must be text or null"
		);
	}
	return {
		reply: requiredText(record, "reply", "reply suggestion"),
		citedArticleIds: [...articleIds],
		shouldEscalate: record.shouldEscalate,
		uncertainty:
			typeof uncertainty === "string" ? uncertainty.trim() || null : null,
	};
}

function ticketPrompt(ticket: TicketDocument): string {
	const messages = ticket.messages
		.slice(-MAX_TICKET_MESSAGES)
		.map((message) => ({
			author: message.author,
			authorName: message.authorName,
			body: message.body.slice(0, MAX_MATCH_CONTENT_LENGTH),
			createdAt: message.createdAt,
			internal: message.internal,
		}));
	return JSON.stringify({
		id: ticket.id,
		subject: ticket.subject,
		status: ticket.status,
		priority: ticket.priority,
		channel: ticket.channel,
		requester: {
			name: ticket.requester.name,
			company: ticket.requester.company,
		},
		tags: ticket.tags,
		messages,
	});
}

function matchesPrompt(matches: RyuSpaceMatch[]): string {
	return JSON.stringify(
		matches.slice(0, MAX_CONTEXT_MATCHES).map((match) => ({
			documentId: match.document_id,
			content: match.content.slice(0, MAX_MATCH_CONTENT_LENGTH),
			distance: match.distance,
		}))
	);
}

function settingsPrompt(settings: AgentSettings | undefined): string {
	return JSON.stringify({
		name: settings?.name?.slice(0, 160) ?? "Ryu Help Center agent",
		tone: settings?.tone?.slice(0, 400) ?? "clear and helpful",
		instructions: settings?.instructions?.slice(0, 800) ?? "",
		guardrails:
			settings?.guardrails?.slice(0, 800) ??
			"Do not invent account changes or claim that a message was delivered.",
	});
}

async function getRelevantMatches(
	query: string,
	context: AiContext
): Promise<RyuSpaceMatch[]> {
	if (context.matches) {
		return context.matches.slice(0, MAX_CONTEXT_MATCHES);
	}
	if (!(context.spaceId && getRyuBridge())) {
		return [];
	}
	try {
		return await searchHelpCenter(context.spaceId, query, MAX_CONTEXT_MATCHES);
	} catch {
		throw new HelpCenterAiError(
			"provider-failure",
			"Help Center knowledge retrieval failed"
		);
	}
}

async function completeLive(
	prompt: string,
	context: AiContext
): Promise<string> {
	const bridge = getRyuBridge();
	if (!bridge) {
		throw new HelpCenterAiError(
			"bridge-unavailable",
			"AI assistance is unavailable until the Ryu host bridge connects"
		);
	}
	try {
		const raw: unknown = await bridge.model.complete({
			prompt: prompt.slice(0, MAX_PROMPT_LENGTH),
			model: context.model,
			provider: context.provider,
			effort: context.effort,
		});
		if (typeof raw !== "string") {
			throw new Error("The model returned a non-text response");
		}
		return raw;
	} catch {
		throw new HelpCenterAiError(
			"provider-failure",
			"The Ryu model provider failed to complete the request"
		);
	}
}

export async function classifyTicket(
	ticket: TicketDocument,
	context: AiContext = {}
): Promise<TicketClassification> {
	const matches = await getRelevantMatches(
		`${ticket.subject} ${ticket.tags.join(" ")}`,
		context
	);
	const prompt = [
		"Classify this Ryu Help Center ticket. Return JSON only with topic, priority, sentiment, confidence, and rationale.",
		`Ticket: ${ticketPrompt(ticket)}`,
		`Agent settings: ${settingsPrompt(context.settings)}`,
		`Relevant Help Center knowledge: ${matchesPrompt(matches)}`,
	].join("\n");
	return parseClassificationResponse(await completeLive(prompt, context));
}

export async function draftReply(
	ticket: TicketDocument,
	context: AiContext = {}
): Promise<ReplySuggestion> {
	const matches = await getRelevantMatches(
		`${ticket.subject} ${ticket.messages.at(-1)?.body ?? ""}`,
		context
	);
	const prompt = [
		"Draft a reply for this Ryu Help Center ticket. Return JSON only with reply, citedArticleIds, shouldEscalate, and uncertainty.",
		"The reply is a draft for human review. Never claim external delivery.",
		`Ticket: ${ticketPrompt(ticket)}`,
		`Agent settings: ${settingsPrompt(context.settings)}`,
		`Relevant Help Center knowledge: ${matchesPrompt(matches)}`,
	].join("\n");
	return parseReplySuggestion(await completeLive(prompt, context));
}

function demoCustomerAnswer(question: string): CustomerAnswer {
	const normalizedQuestion = question.toLowerCase();
	const articles = getSampleWorkspaceDocuments().filter(
		(document) => document.type === "help-center/article"
	);
	const article = articles.find((candidate) => {
		const haystack =
			`${candidate.title} ${candidate.body} ${candidate.tags.join(" ")}`.toLowerCase();
		return normalizedQuestion
			.split(/\s+/)
			.some((word) => word.length > 3 && haystack.includes(word));
	});
	if (article?.type !== "help-center/article") {
		return {
			answer:
				"[Demo mode] Ryu Help Center could not find a matching article. A human operator should review this question.",
			citedArticleIds: [],
			shouldEscalate: true,
			uncertainty: "No matching sample article was found.",
			mode: "demo",
		};
	}
	return {
		answer: `[Demo mode] Ryu Help Center found “${article.title}”:\n\n${article.body}`,
		citedArticleIds: [article.id],
		shouldEscalate: false,
		uncertainty: null,
		mode: "demo",
	};
}

export async function answerCustomerQuestion(
	question: string,
	context: AiContext = {}
): Promise<CustomerAnswer> {
	const trimmedQuestion = question.trim();
	if (trimmedQuestion.length === 0) {
		throw new Error("A customer question is required");
	}
	if (!getRyuBridge()) {
		return demoCustomerAnswer(trimmedQuestion);
	}
	const matches = await getRelevantMatches(trimmedQuestion, context);
	const prompt = [
		"Answer this customer question using only the selected Ryu Help Center knowledge. Return JSON only with reply, citedArticleIds, shouldEscalate, and uncertainty.",
		"This is a local preview, not an autonomous or externally delivered reply.",
		`Question: ${trimmedQuestion.slice(0, 1200)}`,
		`Agent settings: ${settingsPrompt(context.settings)}`,
		`Relevant Help Center knowledge: ${matchesPrompt(matches)}`,
	].join("\n");
	const suggestion = parseReplySuggestion(await completeLive(prompt, context));
	return {
		answer: suggestion.reply,
		citedArticleIds: suggestion.citedArticleIds,
		shouldEscalate: suggestion.shouldEscalate,
		uncertainty: suggestion.uncertainty,
		mode: "live",
	};
}
