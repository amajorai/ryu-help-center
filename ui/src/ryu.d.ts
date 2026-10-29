export interface RyuSpaceMatch {
	chunk_id: string;
	content: string;
	distance: number;
	document_id: string;
}

export interface RyuSpaceDocumentSummary {
	id: string;
	title: string;
	updated_at: number;
}

export interface RyuSpaceDocument {
	id: string;
	kind: string;
	source: string;
	title: string;
}

export interface RyuBridge {
	context?: { view?: string } | null;
	model: {
		complete(input: {
			prompt: string;
			system?: string;
			model?: string;
			provider?: string;
			model_pref_key?: string;
			effort?: string;
		}): Promise<string>;
	};
	spaces: {
		ensureSpace(input: {
			name: string;
			description?: string | null;
		}): Promise<string>;
		search(input: {
			space_id: string;
			query: string;
			limit?: number;
		}): Promise<RyuSpaceMatch[]>;
		createDoc(input: { space_id: string; title: string }): Promise<string>;
		getDoc(input: { doc_id: string }): Promise<RyuSpaceDocument | null>;
		updateDoc(input: {
			doc_id: string;
			title?: string;
			source: string;
		}): Promise<void>;
		listDocs(input: { space_id: string }): Promise<RyuSpaceDocumentSummary[]>;
		deleteDoc(input: { doc_id: string }): Promise<void>;
	};
	storage: {
		get(input: { key: string }): Promise<string | null>;
		set(input: { key: string; value: string }): Promise<void>;
	};
}

declare global {
	interface Window {
		ryu?: RyuBridge;
	}
}
