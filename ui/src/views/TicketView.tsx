import {
	Add01Icon,
	ArrowRight01Icon,
	File01Icon,
	SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@ryu/ui/components/badge.tsx";
import { Button } from "@ryu/ui/components/button.tsx";
import { Textarea } from "@ryu/ui/components/textarea.tsx";
import { useState } from "react";
import type { AgentSettings } from "../ai.ts";
import { classifyTicket, draftReply } from "../ai.ts";
import { ResolutionRibbon } from "../components/ResolutionRibbon.tsx";
import { PriorityPill, StatusPill } from "../components/StatusPill.tsx";
import type { ArticleDocument, TicketDocument } from "../types.ts";

function formatTimestamp(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? "Unknown time"
		: date.toLocaleString(undefined, {
				dateStyle: "medium",
				timeStyle: "short",
			});
}

function demoDraft(ticket: TicketDocument): string {
	if (ticket.topic === "Reports") {
		return "Thanks for flagging this. I’m checking the report export path now and will keep this ticket open while we confirm the download is ready.";
	}
	return "Thanks for reaching out. I’m reviewing the details now and will follow up with the next step here in the Help Center record.";
}

export function TicketView({
	articles,
	mode,
	onCreateArticle,
	onOpenKnowledge,
	onUpdate,
	spaceId,
	ticket,
}: {
	articles: ArticleDocument[];
	mode: "demo" | "live";
	onCreateArticle: (ticket: TicketDocument) => Promise<void>;
	onOpenKnowledge: () => void;
	onUpdate: (ticket: TicketDocument) => Promise<void>;
	spaceId: string | null;
	ticket: TicketDocument;
}) {
	const [composerText, setComposerText] = useState("");
	const [internal, setInternal] = useState(false);
	const [busy, setBusy] = useState<"draft" | "classify" | "save" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const settings: AgentSettings = {
		name: "Ryu Help Center agent",
		tone: "clear and helpful",
		guardrails: "Do not invent account changes or claim external delivery.",
	};

	const update = async (next: TicketDocument): Promise<void> => {
		setError(null);
		setBusy("save");
		try {
			await onUpdate(next);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Could not update ticket"
			);
		} finally {
			setBusy(null);
		}
	};

	const addMessage = async (): Promise<void> => {
		const body = composerText.trim();
		if (!body) {
			return;
		}
		const next: TicketDocument = {
			...ticket,
			aiState: internal ? ticket.aiState : "human-reviewed",
			messages: [
				...ticket.messages,
				{
					author: internal ? "system" : "agent",
					authorName: "Ryu operator",
					body,
					createdAt: new Date().toISOString(),
					id: `local-message-${Date.now()}`,
					internal,
				},
			],
			updatedAt: new Date().toISOString(),
		};
		await update(next);
		setComposerText("");
	};

	const runDraft = async (): Promise<void> => {
		setError(null);
		setBusy("draft");
		try {
			const suggestion =
				mode === "demo"
					? {
							reply: demoDraft(ticket),
							citedArticleIds: [],
							shouldEscalate: false,
							uncertainty: null,
						}
					: await draftReply(ticket, {
							settings,
							spaceId: spaceId ?? undefined,
						});
			setComposerText(suggestion.reply);
			setInternal(false);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Could not draft a reply"
			);
		} finally {
			setBusy(null);
		}
	};

	const runClassification = async (): Promise<void> => {
		setError(null);
		setBusy("classify");
		try {
			const classification =
				mode === "demo"
					? {
							confidence: ticket.aiConfidence ?? 0.72,
							priority: ticket.priority,
							rationale: "Demo triage uses the sample ticket context.",
							sentiment: ticket.sentiment ?? "neutral",
							topic: ticket.topic ?? "General support",
						}
					: await classifyTicket(ticket, {
							settings,
							spaceId: spaceId ?? undefined,
						});
			await update({
				...ticket,
				aiConfidence: classification.confidence,
				aiState: "suggested",
				priority: classification.priority,
				sentiment: classification.sentiment,
				topic: classification.topic,
				updatedAt: new Date().toISOString(),
			});
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Could not classify ticket"
			);
		} finally {
			setBusy(null);
		}
	};

	const handleRibbonAction = async (): Promise<void> => {
		if (ticket.status === "resolved") {
			await update({
				...ticket,
				status: "open",
				updatedAt: new Date().toISOString(),
			});
			return;
		}
		await update({
			...ticket,
			aiState:
				ticket.aiState === "suggested" ? "human-reviewed" : ticket.aiState,
			status: ticket.aiState === "suggested" ? ticket.status : "resolved",
			updatedAt: new Date().toISOString(),
		});
	};

	return (
		<section
			className="flex min-h-0 min-w-0 flex-1 flex-col"
			data-testid="help-center-conversation"
		>
			<header className="flex flex-wrap items-start justify-between gap-4 border-border/70 border-b px-5 py-4">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-mono text-[10px] text-muted-foreground">
							#{ticket.id.slice(0, 12)}
						</span>
						<StatusPill status={ticket.status} />
						<PriorityPill priority={ticket.priority} />
					</div>
					<h1 className="mt-2 truncate font-semibold text-xl tracking-tight">
						{ticket.subject}
					</h1>
					<p className="mt-1 text-muted-foreground text-xs">
						Updated {formatTimestamp(ticket.updatedAt)}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						disabled={busy !== null}
						onClick={runClassification}
						size="sm"
						variant="outline"
					>
						<HugeiconsIcon aria-hidden="true" icon={SparklesIcon} />
						{busy === "classify" ? "Triaging…" : "Run triage"}
					</Button>
				</div>
			</header>

			<ResolutionRibbon
				onAction={() => void handleRibbonAction()}
				ticket={ticket}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
				<div className="mx-auto flex max-w-3xl flex-col gap-4">
					{ticket.messages.map((message) => (
						<article
							className={`flex ${message.author === "customer" ? "justify-start" : "justify-end"}`}
							key={message.id}
						>
							<div
								className={`max-w-[85%] rounded-2xl border px-4 py-3 ${message.author === "customer" ? "border-border/70 bg-card" : message.internal ? "border-warning/30 bg-warning/10" : "border-primary/20 bg-primary/5"}`}
							>
								<div className="flex items-center justify-between gap-4">
									<p className="font-medium text-xs">{message.authorName}</p>
									<time
										className="font-mono text-[10px] text-muted-foreground"
										dateTime={message.createdAt}
									>
										{formatTimestamp(message.createdAt)}
									</time>
								</div>
								<p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
									{message.body}
								</p>
								{message.internal ? (
									<Badge className="mt-2" variant="outline">
										Internal note
									</Badge>
								) : null}
							</div>
						</article>
					))}

					{error ? (
						<p
							className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive text-xs"
							role="alert"
						>
							{error}
						</p>
					) : null}

					<div
						className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
						data-testid="help-center-composer"
					>
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-1">
								<Button
									className={`rounded-lg px-2.5 py-1.5 text-xs ${internal ? "text-muted-foreground hover:bg-muted" : "bg-primary/10 font-medium text-primary"}`}
									onClick={() => setInternal(false)}
									type="button"
								>
									Reply
								</Button>
								<Button
									className={`rounded-lg px-2.5 py-1.5 text-xs ${internal ? "bg-warning/10 font-medium text-warning-foreground" : "text-muted-foreground hover:bg-muted"}`}
									onClick={() => setInternal(true)}
									type="button"
								>
									Internal note
								</Button>
							</div>
							<Button
								disabled={busy !== null}
								onClick={() => void runDraft()}
								size="sm"
								variant="ghost"
							>
								<HugeiconsIcon aria-hidden="true" icon={SparklesIcon} />
								{busy === "draft" ? "Drafting…" : "Draft with AI"}
							</Button>
						</div>
						<Textarea
							aria-label={internal ? "Internal note" : "Local reply"}
							className="mt-3 min-h-28 resize-y"
							onChange={(event) => setComposerText(event.target.value)}
							placeholder={
								internal
									? "Leave a note for the team…"
									: "Write a reply for the local ticket record…"
							}
							value={composerText}
						/>
						<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
							<p className="text-muted-foreground text-xs">
								{internal
									? "Only operators will see this note."
									: "This adds a local reply record; it does not contact a customer."}
							</p>
							<Button
								disabled={!composerText.trim() || busy !== null}
								onClick={() => void addMessage()}
								size="sm"
							>
								<HugeiconsIcon aria-hidden="true" icon={Add01Icon} />
								{busy === "save"
									? "Saving…"
									: internal
										? "Add note"
										: "Add reply"}
							</Button>
						</div>
					</div>

					<div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="font-medium text-sm">
									Knowledge close to the conversation
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									{articles.length} article{articles.length === 1 ? "" : "s"}{" "}
									available in this Help Center Space.
								</p>
							</div>
							<div className="flex items-center gap-2">
								<Button
									onClick={() => void onCreateArticle(ticket)}
									size="sm"
									variant="outline"
								>
									<HugeiconsIcon aria-hidden="true" icon={File01Icon} />
									Create article draft
								</Button>
								<Button onClick={onOpenKnowledge} size="sm" variant="ghost">
									Browse
									<HugeiconsIcon aria-hidden="true" icon={ArrowRight01Icon} />
								</Button>
							</div>
						</div>
						{ticket.linkedArticleIds.length > 0 ? (
							<div className="mt-3 grid gap-2 sm:grid-cols-2">
								{articles
									.filter((article) =>
										ticket.linkedArticleIds.includes(article.id)
									)
									.map((article) => (
										<Button
											className="flex items-center gap-2 rounded-xl border border-border/70 bg-card p-3 text-left text-xs hover:border-primary/40"
											key={article.id}
											onClick={onOpenKnowledge}
											type="button"
										>
											<HugeiconsIcon aria-hidden="true" icon={File01Icon} />
											<span className="truncate">{article.title}</span>
										</Button>
									))}
							</div>
						) : null}
					</div>
				</div>
			</div>
		</section>
	);
}
