import { z } from "zod";
import {
	articleDocumentSchema,
	type HelpCenterJsonDocument,
	type HelpCenterJsonValue,
	helpCenterJsonDocumentSchema,
	helpCenterJsonValueSchema,
	nonEmptyTextSchema,
	nonEmptyTextsSchema,
	nullableTextSchema,
	ticketDocumentSchema,
} from "./schemas.ts";
import type {
	AiState,
	ArticleDocument,
	ArticleStatus,
	HelpCenterDocument,
	TicketChannel,
	TicketDocument,
	TicketMessage,
	TicketMessageAuthor,
	TicketPriority,
	TicketRequester,
	TicketSentiment,
	TicketStatus,
} from "./types.ts";

export const HELP_CENTER_SCHEMA_VERSION = 1;
export const MAX_MESSAGE_BODY_LENGTH = 4000;
export const MAX_ARTICLE_BODY_LENGTH = 12_000;
export const MAX_SEARCH_CONTENT_LENGTH = 1200;

const PROTECTED_KEYS = new Set([
	"kind",
	"pluginId",
	"plugin_id",
	"spaceId",
	"space_id",
]);

export type ParsedDocument =
	| { kind: "valid"; document: HelpCenterDocument }
	| { kind: "invalid"; reason: string };

class DocumentParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DocumentParseError";
	}
}

function isRecord(
	value: HelpCenterJsonValue | undefined
): value is HelpCenterJsonDocument {
	return helpCenterJsonDocumentSchema.safeParse(value).success;
}

function readRequiredString(
	record: HelpCenterJsonDocument,
	field: string
): string {
	const parsed = nonEmptyTextSchema.safeParse(record[field]);
	if (!parsed.success) {
		throw new DocumentParseError(`Missing or invalid ${field}`);
	}
	return parsed.data;
}

function readNullableString(
	record: HelpCenterJsonDocument,
	field: string
): string | null {
	const parsed = nullableTextSchema.safeParse(record[field]);
	if (!parsed.success) {
		throw new DocumentParseError(`Invalid ${field}`);
	}
	return parsed.data;
}

function readStringArray(
	record: HelpCenterJsonDocument,
	field: string
): string[] {
	const parsed = nonEmptyTextsSchema.safeParse(record[field]);
	if (!parsed.success) {
		throw new DocumentParseError(`Missing or invalid ${field}`);
	}
	return parsed.data;
}
function isNonEmptyString(
	value: HelpCenterJsonValue | undefined
): value is string {
	return nonEmptyTextSchema.safeParse(value).success;
}

function readEnum<T extends string>(
	record: HelpCenterJsonDocument,
	field: string,
	values: readonly T[]
): T {
	const parsed = z.enum(values).safeParse(record[field]);
	if (!parsed.success) {
		throw new DocumentParseError(`Missing or invalid ${field}`);
	}
	return parsed.data;
}
function readNullableEnum<T extends string>(
	record: HelpCenterJsonDocument,
	field: string,
	values: readonly T[]
): T | null {
	const value = record[field];
	if (value === undefined || value === null) {
		return null;
	}
	const parsed = z.enum(values).safeParse(value);
	if (!parsed.success) {
		throw new DocumentParseError(`Invalid ${field}`);
	}
	return parsed.data;
}

function readNullableConfidence(
	record: HelpCenterJsonDocument,
	field: string
): number | null {
	const value = record[field];
	if (value === undefined || value === null) {
		return null;
	}
	const parsed = z.number().safeParse(value);
	if (!parsed.success) {
		throw new DocumentParseError(`Invalid ${field}`);
	}
	return Math.min(1, Math.max(0, parsed.data));
}

function readMessages(record: HelpCenterJsonDocument): TicketMessage[] {
	const value = record.messages;
	const rows = z.array(helpCenterJsonValueSchema).safeParse(value);
	if (!rows.success) {
		throw new DocumentParseError("Missing or invalid messages");
	}
	return rows.data.map((rawMessage) => {
		if (!isRecord(rawMessage)) {
			throw new DocumentParseError("Invalid ticket message");
		}
		const author = readEnum<TicketMessageAuthor>(rawMessage, "author", [
			"customer",
			"agent",
			"ai",
			"system",
		]);
		const internal = z.boolean().safeParse(rawMessage.internal);
		if (!internal.success) {
			throw new DocumentParseError("Invalid message internal flag");
		}
		return {
			...rawMessage,
			id: readRequiredString(rawMessage, "id"),
			author,
			authorName: readRequiredString(rawMessage, "authorName"),
			body: readRequiredString(rawMessage, "body"),
			createdAt: readRequiredString(rawMessage, "createdAt"),
			internal: internal.data,
		};
	});
}

function readRequester(record: HelpCenterJsonDocument): TicketRequester {
	const rawRequester = record.requester;
	if (!isRecord(rawRequester)) {
		throw new DocumentParseError("Missing or invalid requester");
	}
	return {
		...rawRequester,
		id: readRequiredString(rawRequester, "id"),
		name: readRequiredString(rawRequester, "name"),
		email: readRequiredString(rawRequester, "email"),
		company: readNullableString(rawRequester, "company"),
		avatarSeed: readNullableString(rawRequester, "avatarSeed"),
	};
}

function parseTicket(
	record: HelpCenterJsonDocument,
	spaceDocId: string
): TicketDocument {
	return {
		...record,
		schemaVersion: HELP_CENTER_SCHEMA_VERSION,
		type: "help-center/ticket",
		id: spaceDocId,
		subject: readRequiredString(record, "subject"),
		status: readEnum<TicketStatus>(record, "status", [
			"open",
			"waiting",
			"snoozed",
			"resolved",
		]),
		priority: readEnum<TicketPriority>(record, "priority", [
			"low",
			"normal",
			"high",
			"urgent",
		]),
		channel: readEnum<TicketChannel>(record, "channel", [
			"in-app",
			"email",
			"chat",
		]),
		requester: readRequester(record),
		assigneeId: readNullableString(record, "assigneeId"),
		tags: readStringArray(record, "tags"),
		createdAt: readRequiredString(record, "createdAt"),
		updatedAt: readRequiredString(record, "updatedAt"),
		snoozedUntil: readNullableString(record, "snoozedUntil"),
		aiState: readEnum<AiState>(record, "aiState", [
			"none",
			"suggested",
			"human-reviewed",
		]),
		topic: readNullableString(record, "topic"),
		sentiment: readNullableEnum<TicketSentiment>(record, "sentiment", [
			"positive",
			"neutral",
			"negative",
		]),
		aiConfidence: readNullableConfidence(record, "aiConfidence"),
		messages: readMessages(record),
		linkedArticleIds: readStringArray(record, "linkedArticleIds"),
	};
}

function parseArticle(
	record: HelpCenterJsonDocument,
	spaceDocId: string
): ArticleDocument {
	const usageCount = z
		.number()
		.refine((value) => Number.isInteger(value) && value >= 0)
		.safeParse(record.usageCount);
	if (!usageCount.success) {
		throw new DocumentParseError("Missing or invalid usageCount");
	}
	return {
		...record,
		schemaVersion: HELP_CENTER_SCHEMA_VERSION,
		type: "help-center/article",
		id: spaceDocId,
		title: readRequiredString(record, "title"),
		body: readRequiredString(record, "body"),
		status: readEnum<ArticleStatus>(record, "status", ["draft", "published"]),
		tags: readStringArray(record, "tags"),
		sourceTicketIds: readStringArray(record, "sourceTicketIds"),
		createdAt: readRequiredString(record, "createdAt"),
		updatedAt: readRequiredString(record, "updatedAt"),
		usageCount: usageCount.data,
	};
}

export function parseHelpCenterSource(
	source: string,
	spaceDocId: string
): ParsedDocument {
	if (!isNonEmptyString(spaceDocId)) {
		return { kind: "invalid", reason: "Missing Space document id" };
	}
	let parsed: HelpCenterJsonValue;
	try {
		parsed = helpCenterJsonValueSchema.parse(JSON.parse(source));
	} catch {
		return { kind: "invalid", reason: "Invalid JSON" };
	}
	if (!isRecord(parsed)) {
		return { kind: "invalid", reason: "Document source must be an object" };
	}
	if (parsed.schemaVersion !== HELP_CENTER_SCHEMA_VERSION) {
		return { kind: "invalid", reason: "Unsupported document schema version" };
	}
	try {
		if (parsed.type === "help-center/ticket") {
			readRequiredString(parsed, "id");
			return {
				kind: "valid",
				document: ticketDocumentSchema.parse(parseTicket(parsed, spaceDocId)),
			};
		}
		if (parsed.type === "help-center/article") {
			readRequiredString(parsed, "id");
			return {
				kind: "valid",
				document: articleDocumentSchema.parse(parseArticle(parsed, spaceDocId)),
			};
		}
		return { kind: "invalid", reason: "Unsupported document type" };
	} catch (error) {
		if (error instanceof DocumentParseError) {
			return { kind: "invalid", reason: error.message };
		}
		return { kind: "invalid", reason: "Invalid document source" };
	}
}

function safeExtras(
	record: HelpCenterJsonDocument,
	knownKeys: ReadonlySet<string>
): HelpCenterJsonDocument {
	const extras: HelpCenterJsonDocument = {};
	for (const key of Object.keys(record).sort()) {
		if (!(knownKeys.has(key) || PROTECTED_KEYS.has(key))) {
			const value = record[key];
			if (value !== undefined) {
				extras[key] = value;
			}
		}
	}
	return extras;
}

function orderedObject(
	knownEntries: ReadonlyArray<readonly [string, HelpCenterJsonValue]>,
	record: HelpCenterJsonDocument
): HelpCenterJsonDocument {
	const result: HelpCenterJsonDocument = {};
	const knownKeys = new Set<string>();
	for (const [key, value] of knownEntries) {
		knownKeys.add(key);
		result[key] = value;
	}
	Object.assign(result, safeExtras(record, knownKeys));
	return result;
}

function serializeRequester(
	requester: TicketRequester
): HelpCenterJsonDocument {
	return orderedObject(
		[
			["id", requester.id],
			["name", requester.name],
			["email", requester.email],
			["company", requester.company],
			["avatarSeed", requester.avatarSeed],
		],
		requester
	);
}

function serializeMessage(message: TicketMessage): HelpCenterJsonDocument {
	return orderedObject(
		[
			["id", message.id],
			["author", message.author],
			["authorName", message.authorName],
			["body", message.body.slice(0, MAX_MESSAGE_BODY_LENGTH)],
			["createdAt", message.createdAt],
			["internal", message.internal],
		],
		message
	);
}

export function serializeHelpCenterDocument(
	document: HelpCenterDocument
): string {
	if (document.type === "help-center/ticket") {
		return JSON.stringify(
			orderedObject(
				[
					["schemaVersion", HELP_CENTER_SCHEMA_VERSION],
					["type", "help-center/ticket"],
					["id", document.id],
					["subject", document.subject],
					["status", document.status],
					["priority", document.priority],
					["channel", document.channel],
					["requester", serializeRequester(document.requester)],
					["assigneeId", document.assigneeId],
					["tags", [...document.tags]],
					["createdAt", document.createdAt],
					["updatedAt", document.updatedAt],
					["snoozedUntil", document.snoozedUntil],
					["aiState", document.aiState],
					["topic", document.topic],
					["sentiment", document.sentiment],
					["aiConfidence", document.aiConfidence],
					["messages", document.messages.map(serializeMessage)],
					["linkedArticleIds", [...document.linkedArticleIds]],
				],
				document
			)
		);
	}
	return JSON.stringify(
		orderedObject(
			[
				["schemaVersion", HELP_CENTER_SCHEMA_VERSION],
				["type", "help-center/article"],
				["id", document.id],
				["title", document.title],
				["body", document.body.slice(0, MAX_ARTICLE_BODY_LENGTH)],
				["status", document.status],
				["tags", [...document.tags]],
				["sourceTicketIds", [...document.sourceTicketIds]],
				["createdAt", document.createdAt],
				["updatedAt", document.updatedAt],
				["usageCount", document.usageCount],
			],
			document
		)
	);
}

export function isHelpCenterSourceEnvelope(source: string): boolean {
	try {
		const parsed = helpCenterJsonValueSchema.parse(JSON.parse(source));
		if (!isRecord(parsed)) {
			return false;
		}
		return (
			parsed.type === "help-center/ticket" ||
			parsed.type === "help-center/article"
		);
	} catch {
		return false;
	}
}

export function getHelpCenterDocumentTitle(
	document: HelpCenterDocument
): string {
	return document.type === "help-center/ticket"
		? document.subject
		: document.title;
}
