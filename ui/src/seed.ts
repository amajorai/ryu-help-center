import { createHelpCenterDocument, getRyuBridge } from "./bridge.ts";
import type {
	ArticleDocument,
	HelpCenterDocument,
	TicketDocument,
} from "./types.ts";

export type SeedMode = "demo" | "live";

export interface SeedWorkspaceResult {
	createdDocumentIds: string[];
	documents: HelpCenterDocument[];
	mode: SeedMode;
}

const SAMPLE_ARTICLES: ArticleDocument[] = [
	{
		schemaVersion: 1,
		type: "help-center/article",
		id: "demo-article-export",
		title: "Exporting a report from Ryu",
		body: "Ryu reports can be exported from the Reports view. Choose a date range, select Export, and keep the tab open until the download is ready.",
		status: "published",
		tags: ["reports", "exports"],
		sourceTicketIds: ["demo-ticket-export"],
		createdAt: "2026-08-24T07:10:00.000Z",
		updatedAt: "2026-08-24T07:20:00.000Z",
		usageCount: 12,
	},
	{
		schemaVersion: 1,
		type: "help-center/article",
		id: "demo-article-access",
		title: "Managing workspace access in Ryu",
		body: "Workspace owners can manage access from Settings. Invite a teammate, choose their role, and review the Space permissions before saving.",
		status: "published",
		tags: ["access", "workspace"],
		sourceTicketIds: ["demo-ticket-access"],
		createdAt: "2026-08-24T07:30:00.000Z",
		updatedAt: "2026-08-24T07:40:00.000Z",
		usageCount: 8,
	},
	{
		schemaVersion: 1,
		type: "help-center/article",
		id: "demo-article-models",
		title: "Choosing a model for a Ryu task",
		body: "Start with the model recommended by Ryu for the task. You can review the selected provider, effort, and expected usage before running it.",
		status: "draft",
		tags: ["models", "tasks"],
		sourceTicketIds: ["demo-ticket-model"],
		createdAt: "2026-08-24T07:50:00.000Z",
		updatedAt: "2026-08-24T08:00:00.000Z",
		usageCount: 3,
	},
];

const SAMPLE_TICKETS: TicketDocument[] = [
	{
		schemaVersion: 1,
		type: "help-center/ticket",
		id: "demo-ticket-export",
		subject: "Cannot export a report",
		status: "open",
		priority: "urgent",
		channel: "in-app",
		requester: {
			id: "demo-user-maya",
			name: "Maya Chen",
			email: "maya@example.com",
			company: "Northstar Labs",
			avatarSeed: "maya",
		},
		assigneeId: null,
		tags: ["reports", "export"],
		createdAt: "2026-08-24T08:00:00.000Z",
		updatedAt: "2026-08-24T08:12:00.000Z",
		snoozedUntil: null,
		aiState: "suggested",
		topic: "Reports",
		sentiment: "negative",
		aiConfidence: 0.84,
		messages: [
			{
				id: "demo-message-export-1",
				author: "customer",
				authorName: "Maya Chen",
				body: "The export button spins but no report downloads.",
				createdAt: "2026-08-24T08:00:00.000Z",
				internal: false,
			},
		],
		linkedArticleIds: ["demo-article-export"],
	},
	{
		schemaVersion: 1,
		type: "help-center/ticket",
		id: "demo-ticket-access",
		subject: "Please add a teammate to our workspace",
		status: "waiting",
		priority: "normal",
		channel: "chat",
		requester: {
			id: "demo-user-jon",
			name: "Jon Bell",
			email: "jon@example.com",
			company: "Rookery Studio",
			avatarSeed: "jon",
		},
		assigneeId: "ryu-operator",
		tags: ["access", "workspace"],
		createdAt: "2026-08-23T16:20:00.000Z",
		updatedAt: "2026-08-24T07:55:00.000Z",
		snoozedUntil: null,
		aiState: "human-reviewed",
		topic: "Workspace access",
		sentiment: "neutral",
		aiConfidence: 0.62,
		messages: [
			{
				id: "demo-message-access-1",
				author: "customer",
				authorName: "Jon Bell",
				body: "Can you help me invite one teammate with editor access?",
				createdAt: "2026-08-23T16:20:00.000Z",
				internal: false,
			},
			{
				id: "demo-message-access-2",
				author: "agent",
				authorName: "Ryu operator",
				body: "I am checking the workspace role before I reply.",
				createdAt: "2026-08-24T07:55:00.000Z",
				internal: true,
			},
		],
		linkedArticleIds: ["demo-article-access"],
	},
	{
		schemaVersion: 1,
		type: "help-center/ticket",
		id: "demo-ticket-model",
		subject: "Which model should run this task?",
		status: "resolved",
		priority: "low",
		channel: "email",
		requester: {
			id: "demo-user-priya",
			name: "Priya Nair",
			email: "priya@example.com",
			company: null,
			avatarSeed: "priya",
		},
		assigneeId: "ryu-operator",
		tags: ["models", "tasks"],
		createdAt: "2026-08-23T10:00:00.000Z",
		updatedAt: "2026-08-23T10:45:00.000Z",
		snoozedUntil: null,
		aiState: "human-reviewed",
		topic: "Model selection",
		sentiment: "positive",
		aiConfidence: 0.91,
		messages: [
			{
				id: "demo-message-model-1",
				author: "customer",
				authorName: "Priya Nair",
				body: "The model recommendation worked well. Thank you!",
				createdAt: "2026-08-23T10:00:00.000Z",
				internal: false,
			},
		],
		linkedArticleIds: ["demo-article-models"],
	},
];

function cloneDocument(document: HelpCenterDocument): HelpCenterDocument {
	if (document.type === "help-center/ticket") {
		return {
			...document,
			requester: { ...document.requester },
			tags: [...document.tags],
			messages: document.messages.map((message) => ({ ...message })),
			linkedArticleIds: [...document.linkedArticleIds],
		};
	}
	return {
		...document,
		tags: [...document.tags],
		sourceTicketIds: [...document.sourceTicketIds],
	};
}

export function getSampleWorkspaceDocuments(): HelpCenterDocument[] {
	return [...SAMPLE_TICKETS, ...SAMPLE_ARTICLES].map(cloneDocument);
}

export async function seedSampleWorkspace(
	spaceId: string
): Promise<SeedWorkspaceResult> {
	const sampleDocuments = getSampleWorkspaceDocuments();
	if (!getRyuBridge()) {
		return {
			mode: "demo",
			documents: sampleDocuments,
			createdDocumentIds: [],
		};
	}
	if (spaceId.trim().length === 0) {
		throw new Error("A Help Center Space id is required to seed live data");
	}

	const sampleArticles = sampleDocuments.filter(
		(document): document is ArticleDocument =>
			document.type === "help-center/article"
	);
	const sampleTickets = sampleDocuments.filter(
		(document): document is TicketDocument =>
			document.type === "help-center/ticket"
	);
	const documentIds = new Map<string, string>();
	const createdDocuments: HelpCenterDocument[] = [];

	for (const article of sampleArticles) {
		const created = await createHelpCenterDocument(spaceId, article);
		documentIds.set(article.id, created.id);
		createdDocuments.push(created);
	}
	for (const ticket of sampleTickets) {
		const linkedArticleIds = ticket.linkedArticleIds.map(
			(articleId) => documentIds.get(articleId) ?? articleId
		);
		const created = await createHelpCenterDocument(spaceId, {
			...ticket,
			linkedArticleIds,
		});
		documentIds.set(ticket.id, created.id);
		createdDocuments.push(created);
	}

	return {
		mode: "live",
		documents: createdDocuments,
		createdDocumentIds: createdDocuments.map((document) => document.id),
	};
}
