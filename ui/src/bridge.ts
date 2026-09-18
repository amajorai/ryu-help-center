import {
	getHelpCenterDocumentTitle,
	isHelpCenterSourceEnvelope,
	MAX_SEARCH_CONTENT_LENGTH,
	parseHelpCenterSource,
	serializeHelpCenterDocument,
} from "./documents.ts";
import type { RyuBridge, RyuSpaceMatch } from "./ryu.d.ts";
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function parseSpaceSummary(value: unknown): {
	id: string;
	title: string;
	updated_at: number;
} | null {
	if (!isRecord(value)) {
		return null;
	}
	if (
		!nonEmptyString(value.id) ||
		typeof value.title !== "string" ||
		typeof value.updated_at !== "number" ||
		!Number.isFinite(value.updated_at)
	) {
		return null;
	}
	return {
		id: value.id,
		title: value.title,
		updated_at: value.updated_at,
	};
}

function parseSpaceDocument(value: unknown): {
	id: string;
	kind: string;
	source: string;
	title: string;
} | null {
	if (!isRecord(value)) {
		return null;
	}
	if (
		!nonEmptyString(value.id) ||
		typeof value.kind !== "string" ||
		typeof value.source !== "string" ||
		typeof value.title !== "string"
	) {
		return null;
	}
	return {
		id: value.id,
		kind: value.kind,
		source: value.source,
		title: value.title,
	};
}

function parseSpaceMatch(value: unknown): RyuSpaceMatch | null {
	if (!isRecord(value)) {
		return null;
	}
	if (
		!nonEmptyString(value.chunk_id) ||
		typeof value.content !== "string" ||
		typeof value.distance !== "number" ||
		!Number.isFinite(value.distance) ||
		!nonEmptyString(value.document_id)
	) {
		return null;
	}
	return {
		chunk_id: value.chunk_id,
		content: value.content.slice(0, MAX_SEARCH_CONTENT_LENGTH),
		distance: value.distance,
		document_id: value.document_id,
	};
}

export function getRyuBridge(): RyuBridge | null {
	if (typeof window === "undefined") {
		return null;
	}
	return window.ryu ?? null;
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
	const rawSummaries: unknown = await bridge.spaces.listDocs({
		space_id: spaceId,
	});
	if (!Array.isArray(rawSummaries)) {
		throw new BridgeProtocolError("spaces.listDocs returned an invalid result");
	}

	const documents: HelpCenterDocument[] = [];
	let invalidCount = 0;
	for (const rawSummary of rawSummaries) {
		const summary = parseSpaceSummary(rawSummary);
		if (!summary) {
			invalidCount += 1;
			continue;
		}
		try {
			const rawDocument: unknown = await bridge.spaces.getDoc({
				doc_id: summary.id,
			});
			const spaceDocument = parseSpaceDocument(rawDocument);
			if (!spaceDocument) {
				invalidCount += 1;
				continue;
			}
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
	const rawDocumentId: unknown = await bridge.spaces.createDoc({
		space_id: spaceId,
		title: getHelpCenterDocumentTitle(document),
	});
	const documentId = ensureDocumentId(
		typeof rawDocumentId === "string" ? rawDocumentId : ""
	);
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
	const rawMatches: unknown = await bridge.spaces.search({
		space_id: spaceId,
		query: query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH),
		limit: boundedLimit,
	});
	if (!Array.isArray(rawMatches)) {
		throw new BridgeProtocolError("spaces.search returned an invalid result");
	}
	const matches: RyuSpaceMatch[] = [];
	for (const rawMatch of rawMatches) {
		const match = parseSpaceMatch(rawMatch);
		if (match) {
			matches.push(match);
		}
		if (matches.length >= boundedLimit) {
			break;
		}
	}
	return matches;
}
