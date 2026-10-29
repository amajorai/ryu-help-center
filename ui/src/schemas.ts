import { z } from "zod";

/** Documents are persisted as native JSON, which permits exponent overflow. */
export type HelpCenterJsonValue =
	| null
	| boolean
	| number
	| string
	| HelpCenterJsonValue[]
	| { [key: string]: HelpCenterJsonValue };
export interface HelpCenterJsonDocument {
	[key: string]: HelpCenterJsonValue;
}
export const helpCenterNumberSchema = z.union([
	z.number(),
	z.literal(Number.POSITIVE_INFINITY),
	z.literal(Number.NEGATIVE_INFINITY),
]);
const jsonFields: z.ZodType<HelpCenterJsonValue> = z.lazy(() =>
	z.union([
		z.null(),
		z.boolean(),
		helpCenterNumberSchema,
		z.string(),
		z.array(jsonFields),
		helpCenterJsonDocumentSchema,
	])
);
export const helpCenterJsonDocumentSchema = z.custom<HelpCenterJsonDocument>(
	(value) =>
		z.record(z.string(), jsonFields).safeParse(value).success &&
		Object.values(value ?? {}).every(
			(entry) => jsonFields.safeParse(entry).success
		)
);
export const helpCenterJsonValueSchema = z.custom<HelpCenterJsonValue>(
	(value) => jsonFields.safeParse(value).success
);
export const nonEmptyTextSchema = z
	.string()
	.refine((value) => value.trim().length > 0);
export const nullableTextSchema = z
	.string()
	.nullish()
	.transform((value) => (value?.trim().length ? value : null));
export const nonEmptyTextsSchema = z.array(nonEmptyTextSchema);
export const ticketStatusSchema = z.enum([
	"open",
	"waiting",
	"snoozed",
	"resolved",
]);
export const ticketPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const ticketChannelSchema = z.enum(["in-app", "email", "chat"]);
export const ticketAiStateSchema = z.enum([
	"none",
	"suggested",
	"human-reviewed",
]);
export const articleStatusSchema = z.enum(["draft", "published"]);
export const ticketSentimentSchema = z.enum([
	"positive",
	"neutral",
	"negative",
]);
export const ticketMessageAuthorSchema = z.enum([
	"customer",
	"agent",
	"ai",
	"system",
]);
export const knowledgeFilterSchema = articleStatusSchema.or(z.literal("all"));
export const helpCenterViewSchema = z.enum([
	"overview",
	"inbox",
	"tickets",
	"knowledge",
	"agent",
	"insights",
]);

const requesterFields = z
	.object({
		avatarSeed: z.string().nullable(),
		company: z.string().nullable(),
		email: nonEmptyTextSchema,
		id: nonEmptyTextSchema,
		name: nonEmptyTextSchema,
	})
	.catchall(jsonFields);
export const ticketRequesterSchema = z.custom<z.output<typeof requesterFields>>(
	(value) =>
		helpCenterJsonDocumentSchema.safeParse(value).success &&
		requesterFields.safeParse(value).success
);
const messageFields = z
	.object({
		author: ticketMessageAuthorSchema,
		authorName: nonEmptyTextSchema,
		body: nonEmptyTextSchema,
		createdAt: nonEmptyTextSchema,
		id: nonEmptyTextSchema,
		internal: z.boolean(),
	})
	.catchall(jsonFields);
export const ticketMessageSchema = z.custom<z.output<typeof messageFields>>(
	(value) =>
		helpCenterJsonDocumentSchema.safeParse(value).success &&
		messageFields.safeParse(value).success
);
const ticketFields = z
	.object({
		aiConfidence: z.number().min(0).max(1).nullable(),
		aiState: ticketAiStateSchema,
		assigneeId: z.string().nullable(),
		channel: ticketChannelSchema,
		createdAt: nonEmptyTextSchema,
		id: nonEmptyTextSchema,
		linkedArticleIds: nonEmptyTextsSchema,
		messages: z.array(ticketMessageSchema),
		priority: ticketPrioritySchema,
		requester: ticketRequesterSchema,
		schemaVersion: z.literal(1),
		sentiment: ticketSentimentSchema.nullable(),
		snoozedUntil: z.string().nullable(),
		status: ticketStatusSchema,
		subject: nonEmptyTextSchema,
		tags: nonEmptyTextsSchema,
		topic: z.string().nullable(),
		type: z.literal("help-center/ticket"),
		updatedAt: nonEmptyTextSchema,
	})
	.catchall(jsonFields);
export const ticketDocumentSchema = z.custom<z.output<typeof ticketFields>>(
	(value) =>
		helpCenterJsonDocumentSchema.safeParse(value).success &&
		ticketFields.safeParse(value).success
);
const articleFields = z
	.object({
		body: nonEmptyTextSchema,
		createdAt: nonEmptyTextSchema,
		id: nonEmptyTextSchema,
		schemaVersion: z.literal(1),
		sourceTicketIds: nonEmptyTextsSchema,
		status: articleStatusSchema,
		tags: nonEmptyTextsSchema,
		title: nonEmptyTextSchema,
		type: z.literal("help-center/article"),
		updatedAt: nonEmptyTextSchema,
		usageCount: z
			.number()
			.refine((value) => Number.isInteger(value) && value >= 0),
	})
	.catchall(jsonFields);
export const articleDocumentSchema = z.custom<z.output<typeof articleFields>>(
	(value) =>
		helpCenterJsonDocumentSchema.safeParse(value).success &&
		articleFields.safeParse(value).success
);

export const spaceSummarySchema = z.object({
	id: nonEmptyTextSchema,
	title: z.string(),
	updated_at: z.number(),
});
export const spaceSummariesSchema = z.array(
	spaceSummarySchema.nullable().catch(null)
);
export const spaceDocumentSchema = z.object({
	id: nonEmptyTextSchema,
	kind: z.string(),
	source: z.string(),
	title: z.string(),
});
export const spaceMatchSchema = z.object({
	chunk_id: nonEmptyTextSchema,
	content: z.string(),
	distance: z.number(),
	document_id: nonEmptyTextSchema,
});
export const spaceMatchesSchema = z.array(
	spaceMatchSchema.nullable().catch(null)
);

export const ticketClassificationSchema = z.object({
	confidence: z.number().transform((value) => Math.min(1, Math.max(0, value))),
	priority: ticketPrioritySchema,
	rationale: nonEmptyTextSchema.transform((value) => value.trim()),
	sentiment: ticketSentimentSchema,
	topic: nonEmptyTextSchema.transform((value) => value.trim()),
});
export const replySuggestionSchema = z.object({
	citedArticleIds: nonEmptyTextsSchema,
	reply: nonEmptyTextSchema.transform((value) => value.trim()),
	shouldEscalate: z.boolean(),
	uncertainty: nonEmptyTextSchema.transform((value) => value.trim()).nullable(),
});
