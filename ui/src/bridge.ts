import {
	getHelpCenterDocumentTitle,
	isHelpCenterSourceEnvelope,
	MAX_SEARCH_CONTENT_LENGTH,
	parseHelpCenterSource,
	serializeHelpCenterDocument,
} from "./documents.ts";
import type { RyuBridge, RyuSpaceMatch } from "./ryu.d.ts";
import {
	nonEmptyTextSchema,
	spaceDocumentSchema,
	spaceMatchesSchema,
	spaceSummariesSchema,
} from "./schemas.ts";
import type { HelpCenterDocument } from "./types.ts";

const MAX_SEARCH_MATCHES = 24;
const MAX_SEARCH_QUERY_LENGTH = 240;

export class BridgeUnavailableError extends Error {
	readonly kind = "bridge-unavailable" as const;

	constructor(message = "The Help Center host bridge is not connected") {
		super(message);
		this.name = "BridgeUnavailableError";
	}
}

export class BridgeProtocolError extends Error {
	readonly kind = "bridge-protocol" as const;

	constructor(message: string) {
		super(message);
		this.name = "BridgeProtocolError";
	}
}

export interface LoadedHelpCenterDocuments {
	documents: HelpCenterDocument[];
	invalidCount: number;
}

function nonEmptyString(value: string): boolean {
	return nonEmptyTextSchema.safeParse(value).success;
}

export function getRyuBridge(): RyuBridge | null {
	return globalThis.window?.ryu ?? null;
}

export function requireRyuBridge(): RyuBridge {
	const bridge = getRyuBridge();
	if (!bridge) {
		throw new BridgeUnavailableError();
	}
	return bridge;
}

export function isRyuBridgeAvailable(): boolean {
	return getRyuBridge() !== null;
}

export async function loadHelpCenterDocuments(
	spaceId: string
): Promise<LoadedHelpCenterDocuments> {
	if (!nonEmptyString(spaceId)) {
		throw new BridgeProtocolError("A Help Center Space id is required");
	}
	const bridge = requireRyuBridge();
	const rawSummaries = await bridge.spaces.listDocs({
		space_id: spaceId,
	});
	const summaries = spaceSummariesSchema.safeParse(rawSummaries);
	if (!summaries.success) {
		throw new BridgeProtocolError("spaces.listDocs returned an invalid result");
	}

	const documents: HelpCenterDocument[] = [];
	let invalidCount = 0;
	for (const summary of summaries.data) {
		if (!summary) {
			invalidCount += 1;
			continue;
		}
		try {
			const rawDocument = await bridge.spaces.getDoc({
				doc_id: summary.id,
			});
			const parsedSpaceDocument = spaceDocumentSchema.safeParse(rawDocument);
			if (!parsedSpaceDocument.success) {
				invalidCount += 1;
				continue;
			}
			const spaceDocument = parsedSpaceDocument.data;
			const parsed = parseHelpCenterSource(
				spaceDocument.source,
				spaceDocument.id
			);
			if (parsed.kind === "valid") {
				documents.push(parsed.document);
				continue;
			}
			if (isHelpCenterSourceEnvelope(spaceDocument.source)) {
				invalidCount += 1;
			}
		} catch {
			invalidCount += 1;
		}
	}
	return { documents, invalidCount };
}

function ensureDocumentId(documentId: string): string {
	if (!nonEmptyString(documentId)) {
		throw new BridgeProtocolError(
			"The Space bridge did not return a document id"
		);
	}
	return documentId;
}

export async function createHelpCenterDocument(
	spaceId: string,
	document: HelpCenterDocument
): Promise<HelpCenterDocument> {
	const bridge = requireRyuBridge();
	const rawDocumentId = await bridge.spaces.createDoc({
		space_id: spaceId,
		title: getHelpCenterDocumentTitle(document),
	});
	const createdId = nonEmptyTextSchema.safeParse(rawDocumentId);
	const documentId = ensureDocumentId(createdId.success ? createdId.data : "");
	const createdDocument: HelpCenterDocument = { ...document, id: documentId };
	try {
		await bridge.spaces.updateDoc({
			doc_id: documentId,
			title: getHelpCenterDocumentTitle(createdDocument),
			source: serializeHelpCenterDocument(createdDocument),
		});
	} catch (error) {
		await bridge.spaces
			.deleteDoc({ doc_id: documentId })
			.catch(() => undefined);
		throw error;
	}
	return createdDocument;
}

export async function saveHelpCenterDocument(
	document: HelpCenterDocument
): Promise<void> {
	const bridge = requireRyuBridge();
	await bridge.spaces.updateDoc({
		doc_id: document.id,
		title: getHelpCenterDocumentTitle(document),
		source: serializeHelpCenterDocument(document),
	});
}

export async function updateHelpCenterDocument(
	document: HelpCenterDocument
): Promise<void> {
	await saveHelpCenterDocument(document);
}

export async function deleteHelpCenterDocument(
	documentId: string
): Promise<void> {
	const bridge = requireRyuBridge();
	await bridge.spaces.deleteDoc({ doc_id: ensureDocumentId(documentId) });
}

export async function searchHelpCenter(
	spaceId: string,
	query: string,
	limit = 12
): Promise<RyuSpaceMatch[]> {
	if (!(nonEmptyString(spaceId) && nonEmptyString(query))) {
		return [];
	}
	const bridge = requireRyuBridge();
	const boundedLimit = Math.min(
		MAX_SEARCH_MATCHES,
		Math.max(1, Math.trunc(Number.isFinite(limit) ? limit : 12))
	);
	const rawMatches = await bridge.spaces.search({
		space_id: spaceId,
		query: query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH),
		limit: boundedLimit,
	});
	const parsedMatches = spaceMatchesSchema.safeParse(rawMatches);
	if (!parsedMatches.success) {
		throw new BridgeProtocolError("spaces.search returned an invalid result");
	}
	const matches: RyuSpaceMatch[] = [];
	for (const match of parsedMatches.data) {
		if (match) {
			matches.push({
				...match,
				content: match.content.slice(0, MAX_SEARCH_CONTENT_LENGTH),
			});
		}
		if (matches.length >= boundedLimit) {
			break;
		}
	}
	return matches;
}
