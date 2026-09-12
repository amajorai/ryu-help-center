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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(
	record: Record<string, unknown>,
	field: string
): string {
	const value = record[field];
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new DocumentParseError(`Missing or invalid ${field}`);
	}
	return value;
}

function readNullableString(
	record: Record<string, unknown>,
	field: string
): string | null {
	const value = record[field];
	if (value === undefined || value === null) {
		return null;
	}
	if (typeof value !== "string") {
		throw new DocumentParseError(`Invalid ${field}`);
	}
	return value.trim().length > 0 ? value : null;
}

function readStringArray(
	record: Record<string, unknown>,
	field: string
): string[] {
	const value = record[field];
	if (!(Array.isArray(value) && value.every(isNonEmptyString))) {
		throw new DocumentParseError(`Missing or invalid ${field}`);
	}
	return [...value];
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function readEnum<T extends string>(
	record: Record<string, unknown>,
	field: string,
	values: readonly T[]
): T {
	const value = record[field];
	if (typeof value !== "string") {
		throw new DocumentParseError(`Missing or invalid ${field}`);
	}
	const match = values.find((candidate) => candidate === value);
	if (match === undefined) {
		throw new DocumentParseError(`Missing or invalid ${field}`);
	}
	return match;
}

function readNullableEnum<T extends string>(
	record: Record<string, unknown>,
	field: string,
	values: readonly T[]
): T | null {
	const value = record[field];
	if (value === undefined || value === null) {
		return null;
	}
	if (typeof value !== "string") {
		throw new DocumentParseError(`Invalid ${field}`);
	}
	const match = values.find((candidate) => candidate === value);
	if (match === undefined) {
		throw new DocumentParseError(`Invalid ${field}`);
	}
	return match;
}

function readNullableConfidence(
	record: Record<string, unknown>,
	field: string
): number | null {
	const value = record[field];
	if (value === undefined || value === null) {
		return null;
	}
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new DocumentParseError(`Invalid ${field}`);
	}
	return Math.min(1, Math.max(0, value));
}

function readMessages(record: Record<string, unknown>): TicketMessage[] {
	const value = record.messages;
	if (!Array.isArray(value)) {
		throw new DocumentParseError("Missing or invalid messages");
	}
	return value.map((rawMessage) => {
		if (!isRecord(rawMessage)) {
			throw new DocumentParseError("Invalid ticket message");
		}
		const author = readEnum<TicketMessageAuthor>(rawMessage, "author", [
			"customer",
			"agent",
			"ai",
			"system",
		]);
		if (typeof rawMessage.internal !== "boolean") {
			throw new DocumentParseError("Invalid message internal flag");
		}
		return {
			...rawMessage,
			id: readRequiredString(rawMessage, "id"),
			author,
			authorName: readRequiredString(rawMessage, "authorName"),
			body: readRequiredString(rawMessage, "body"),
			createdAt: readRequiredString(rawMessage, "createdAt"),
			internal: rawMessage.internal,
		};
	});
}

function readRequester(record: Record<string, unknown>): TicketRequester {
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
	record: Record<string, unknown>,
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
	record: Record<string, unknown>,
	spaceDocId: string
): ArticleDocument {
	const usageCount = record.usageCount;
	if (
		typeof usageCount !== "number" ||
		!Number.isInteger(usageCount) ||
		usageCount < 0
	) {
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
		usageCount,
	};
}

export function parseHelpCenterSource(
	source: string,
	spaceDocId: string
): ParsedDocument {
	if (!isNonEmptyString(spaceDocId)) {
		return { kind: "invalid", reason: "Missing Space document id" };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(source);
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
				document: parseTicket(parsed, spaceDocId),
			};
		}
		if (parsed.type === "help-center/article") {
			readRequiredString(parsed, "id");
			return {
				kind: "valid",
				document: parseArticle(parsed, spaceDocId),
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
	record: Record<string, unknown>,
	knownKeys: ReadonlySet<string>
): Record<string, unknown> {
	const extras: Record<string, unknown> = {};
	for (const key of Object.keys(record).sort()) {
		if (!(knownKeys.has(key) || PROTECTED_KEYS.has(key))) {
			extras[key] = record[key];
		}
	}
	return extras;
}

function orderedObject(
	knownEntries: ReadonlyArray<readonly [string, unknown]>,
	record: Record<string, unknown>
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
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
): Record<string, unknown> {
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

function serializeMessage(message: TicketMessage): Record<string, unknown> {
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
		const parsed: unknown = JSON.parse(source);
		if (!isRecord(parsed) || typeof parsed.type !== "string") {
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
