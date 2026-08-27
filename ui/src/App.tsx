import { SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@ryu/ui/components/button.tsx";
import { Spinner } from "@ryu/ui/components/spinner.tsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	createHelpCenterDocument,
	isRyuBridgeAvailable,
	loadHelpCenterDocuments,
	updateHelpCenterDocument,
} from "./bridge.ts";
import { CustomerContext } from "./components/CustomerContext.tsx";
import { getSampleWorkspaceDocuments, seedSampleWorkspace } from "./seed.ts";
import { ensureHelpCenterSpace } from "./storage.ts";
import type {
	ArticleDocument,
	HelpCenterDocument,
	TicketDocument,
} from "./types.ts";
import { isArticleDocument, isTicketDocument } from "./types.ts";
import {
	chooseSelectedTicketId,
	type QueueFilter,
	type QueueView,
} from "./ui-state.ts";
import { AgentView } from "./views/AgentView.tsx";
import { InboxView } from "./views/InboxView.tsx";
import { InsightsView } from "./views/InsightsView.tsx";
import { KnowledgeView } from "./views/KnowledgeView.tsx";
import { TicketView } from "./views/TicketView.tsx";

type HelpCenterMode = "loading" | "demo" | "live";
type AppView =
	| "overview"
	| "inbox"
	| "tickets"
	| "knowledge"
	| "agent"
	| "insights";

function contextView(): AppView | null {
	const view =
		typeof window === "undefined" ? undefined : window.ryu?.context?.view;
	return view === "overview" ||
		view === "inbox" ||
		view === "tickets" ||
		view === "knowledge" ||
		view === "agent" ||
		view === "insights"
		? view
		: null;
}

function replaceDocument(
	documents: HelpCenterDocument[],
	next: HelpCenterDocument
): HelpCenterDocument[] {
	const found = documents.some((document) => document.id === next.id);
	return found
		? documents.map((document) => (document.id === next.id ? next : document))
		: [...documents, next];
}

function createLocalTicket(): TicketDocument {
	const now = new Date().toISOString();
	return {
		aiConfidence: null,
		aiState: "none",
		assigneeId: null,
		channel: "in-app",
		createdAt: now,
		id: `local-ticket-${Date.now()}`,
		linkedArticleIds: [],
		messages: [],
		priority: "normal",
		requester: {
			avatarSeed: "new-customer",
			company: null,
			email: "customer@example.com",
			id: `local-user-${Date.now()}`,
			name: "New customer",
		},
		schemaVersion: 1,
		sentiment: null,
		snoozedUntil: null,
		status: "open",
		subject: "New support question",
		tags: ["new"],
		topic: null,
		type: "help-center/ticket",
		updatedAt: now,
	};
}

function createLocalArticle(): ArticleDocument {
	const now = new Date().toISOString();
	return {
		body: "",
		createdAt: now,
		id: `local-article-${Date.now()}`,
		schemaVersion: 1,
		sourceTicketIds: [],
		status: "draft",
		tags: [],
		title: "Untitled help article",
		type: "help-center/article",
		updatedAt: now,
		usageCount: 0,
	};
}

function ActivationState({
	error,
	onCreateTicket,
	onLoadSample,
	working,
}: {
	error: string | null;
	onCreateTicket: () => void;
	onLoadSample: () => void;
	working: boolean;
}) {
	return (
		<div className="flex min-h-0 flex-1 items-center justify-center p-6">
			<div className="max-w-md rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm">
				<span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
					<HugeiconsIcon aria-hidden="true" icon={SparklesIcon} />
				</span>
				<p className="mt-5 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
					A fresh support Space
				</p>
				<h1 className="mt-2 font-semibold text-2xl tracking-tight">
					Start your Help Center
				</h1>
				<p className="mt-3 text-muted-foreground text-sm leading-relaxed">
					Load a small sample queue to see the resolution loop, or create the
					first ticket from your own support operation.
				</p>
				<div className="mt-6 flex flex-wrap justify-center gap-2">
					<Button disabled={working} onClick={onLoadSample}>
						{working ? "Loading…" : "Load sample workspace"}
					</Button>
					<Button disabled={working} onClick={onCreateTicket} variant="outline">
						Create first ticket
					</Button>
				</div>
				{error ? (
					<p className="mt-4 text-destructive text-xs" role="alert">
						{error}
					</p>
				) : null}
			</div>
		</div>
	);
}

export function HelpCenterApp() {
	const [documents, setDocuments] = useState<HelpCenterDocument[]>([]);
	const [spaceId, setSpaceId] = useState<string | null>(null);
	const [invalidCount, setInvalidCount] = useState(0);
	const [mode, setMode] = useState<HelpCenterMode>("loading");
	const [view, setView] = useState<AppView>(() => contextView() ?? "inbox");
	const [filter, setFilter] = useState<QueueFilter>("all");
	const [query, setQuery] = useState("");
	const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [working, setWorking] = useState(false);
	const loadPromise = useRef<Promise<void> | null>(null);

	const tickets = useMemo(
		() =>
			documents.filter((document): document is TicketDocument =>
				isTicketDocument(document)
			),
		[documents]
	);
	const articles = useMemo(
		() =>
			documents.filter((document): document is ArticleDocument =>
				isArticleDocument(document)
			),
		[documents]
	);
	const selectedTicket =
		tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;

	const bootstrap = useCallback(async (): Promise<void> => {
		setError(null);
		if (!isRyuBridgeAvailable()) {
			setDocuments(getSampleWorkspaceDocuments());
			setMode("demo");
			return;
		}
		try {
			const nextSpaceId = await ensureHelpCenterSpace();
			const loaded = await loadHelpCenterDocuments(nextSpaceId);
			setSpaceId(nextSpaceId);
			setDocuments(loaded.documents);
			setInvalidCount(loaded.invalidCount);
			setMode("live");
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Could not open the Help Center Space"
			);
			setMode("live");
		}
	}, []);

	useEffect(() => {
		if (!loadPromise.current) {
			loadPromise.current = bootstrap();
		}
	}, [bootstrap]);

	useEffect(() => {
		const nextId = chooseSelectedTicketId(selectedTicketId, tickets);
		if (nextId !== selectedTicketId) {
			setSelectedTicketId(nextId);
		}
	}, [selectedTicketId, tickets]);

	const persistDocument = async (next: HelpCenterDocument): Promise<void> => {
		const previous = documents;
		setDocuments((current) => replaceDocument(current, next));
		try {
			if (mode === "live") {
				await updateHelpCenterDocument(next);
			}
		} catch (cause) {
			setDocuments(previous);
			throw cause;
		}
	};

	const createDocument = async (
		document: HelpCenterDocument
	): Promise<HelpCenterDocument> => {
		if (mode !== "live" || !spaceId) {
			setDocuments((current) => replaceDocument(current, document));
			return document;
		}
		const created = await createHelpCenterDocument(spaceId, document);
		setDocuments((current) => replaceDocument(current, created));
		return created;
	};

	const handleCreateTicket = async (): Promise<void> => {
		setWorking(true);
		setError(null);
		try {
			const created = await createDocument(createLocalTicket());
			setSelectedTicketId(created.id);
			setView("inbox");
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Could not create the ticket"
			);
		} finally {
			setWorking(false);
		}
	};

	const handleLoadSample = async (): Promise<void> => {
		setWorking(true);
		setError(null);
		try {
			const result = await seedSampleWorkspace(spaceId ?? "");
			setDocuments(result.documents);
			setMode(result.mode);
			if (result.mode === "live" && result.createdDocumentIds.length > 0) {
				setSelectedTicketId(
					result.documents.find(isTicketDocument)?.id ?? null
				);
			}
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Could not load the sample workspace"
			);
		} finally {
			setWorking(false);
		}
	};

	const handleCreateArticle = async (
		article: ArticleDocument
	): Promise<void> => {
		await createDocument(article);
	};

	const handleCreateArticleFromTicket = async (
		ticket: TicketDocument
	): Promise<void> => {
		const article = {
			...createLocalArticle(),
			body: ticket.messages.map((message) => message.body).join("\n\n"),
			sourceTicketIds: [ticket.id],
			title: ticket.subject,
			tags: ticket.tags,
		};
		await createDocument(article);
		setView("knowledge");
	};

	const currentQueue: QueueView = view === "tickets" ? "tickets" : "inbox";
	const showActivation = mode === "live" && documents.length === 0 && !error;

	return (
		<div
			className="flex h-full min-h-0 overflow-hidden bg-background"
			data-testid="help-center-app"
		>
			<main className="flex min-w-0 flex-1 flex-col">
				{mode === "loading" ? (
					<div className="flex flex-1 items-center justify-center">
						<Spinner />
					</div>
				) : showActivation ? (
					<ActivationState
						error={error}
						onCreateTicket={() => void handleCreateTicket()}
						onLoadSample={() => void handleLoadSample()}
						working={working}
					/>
				) : view === "knowledge" ? (
					<KnowledgeView
						articles={articles}
						onCreateArticle={handleCreateArticle}
						onUpdateArticle={(article) => persistDocument(article)}
					/>
				) : view === "agent" ? (
					<AgentView
						articles={articles}
						mode={mode === "demo" ? "demo" : "live"}
						spaceId={spaceId}
					/>
				) : view === "insights" || view === "overview" ? (
					<InsightsView articles={articles} tickets={tickets} />
				) : (
					<div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[304px_minmax(0,1fr)] xl:grid-cols-[304px_minmax(0,1fr)_304px]">
						<InboxView
							assigneeId="ryu-operator"
							filter={filter}
							onCreateTicket={() => void handleCreateTicket()}
							onFilterChange={setFilter}
							onQueryChange={setQuery}
							onSelect={setSelectedTicketId}
							query={query}
							queue={currentQueue}
							selectedTicketId={selectedTicketId}
							tickets={tickets}
						/>
						{selectedTicket ? (
							<TicketView
								articles={articles}
								mode={mode === "demo" ? "demo" : "live"}
								onCreateArticle={handleCreateArticleFromTicket}
								onOpenKnowledge={() => setView("knowledge")}
								onUpdate={persistDocument}
								spaceId={spaceId}
								ticket={selectedTicket}
							/>
						) : (
							<div className="hidden items-center justify-center border-border/70 border-l text-muted-foreground text-sm lg:flex">
								Select a ticket to see the conversation.
							</div>
						)}
						{selectedTicket ? (
							<CustomerContext
								relatedTicketCount={
									tickets.filter(
										(ticket) =>
											ticket.requester.email === selectedTicket.requester.email
									).length
								}
								ticket={selectedTicket}
							/>
						) : null}
					</div>
				)}
				{invalidCount > 0 ? (
					<p className="border-warning/20 border-t bg-warning/10 px-5 py-2 text-warning-foreground text-xs">
						{invalidCount} Help Center record
						{invalidCount === 1 ? " needs" : "s need"} repair before it can be
						shown.
					</p>
				) : null}
			</main>
		</div>
	);
}
