import { Activity01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MetricCard } from "../components/MetricCard.tsx";
import { deriveInsights } from "../insights.ts";
import type { ArticleDocument, TicketDocument } from "../types.ts";

export function InsightsView({
	articles,
	tickets,
}: {
	articles: ArticleDocument[];
	tickets: TicketDocument[];
}) {
	const insights = deriveInsights(tickets, articles, Date.now());
	const percentage = `${Math.round(insights.humanHandoffRate * 100)}%`;
	const resolutionTime =
		insights.averageResolutionTimeMs === null
			? "—"
			: `${Math.round(insights.averageResolutionTimeMs / 3_600_000)}h`;

	return (
		<section
			className="flex min-h-0 min-w-0 flex-1 flex-col"
			data-testid="help-center-insights"
		>
			<header className="border-border/70 border-b px-5 py-5">
				<div className="flex items-center gap-2">
					<span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<HugeiconsIcon aria-hidden="true" icon={Activity01Icon} />
					</span>
					<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
						Operational signal
					</p>
				</div>
				<h1 className="mt-3 font-semibold text-2xl tracking-tight">Insights</h1>
				<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
					A small, honest read on what your support operation is seeing.
				</p>
			</header>
			<div className="min-h-0 flex-1 overflow-y-auto p-5">
				<div className="mx-auto max-w-5xl space-y-5">
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<MetricCard
							detail="Tickets needing attention"
							title="Open tickets"
							value={String(insights.openTickets)}
						/>
						<MetricCard
							detail="Closed in this local record set"
							title="Resolved"
							value={String(insights.resolvedTickets)}
						/>
						<MetricCard
							detail="Tickets with a human review"
							title="Handoff rate"
							value={percentage}
						/>
						<MetricCard
							detail="From first message to resolution"
							title="Average time"
							value={resolutionTime}
						/>
					</div>
					<div className="grid gap-5 lg:grid-cols-2">
						<div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
							<p className="font-medium text-sm">Top topics</p>
							<div className="mt-4 space-y-3">
								{insights.topTopics.length > 0 ? (
									insights.topTopics.map((topic) => (
										<div
											className="flex items-center justify-between gap-4 text-sm"
											key={topic.topic}
										>
											<span>{topic.topic}</span>
											<span className="font-mono text-muted-foreground text-xs">
												{topic.count}
											</span>
										</div>
									))
								) : (
									<p className="text-muted-foreground text-xs">
										Topics appear as tickets are classified.
									</p>
								)}
							</div>
						</div>
						<div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
							<p className="font-medium text-sm">Knowledge usage</p>
							<div className="mt-4 space-y-3">
								{insights.articleUsage.length > 0 ? (
									insights.articleUsage.slice(0, 5).map((usage) => (
										<div
											className="flex items-center justify-between gap-4 text-sm"
											key={usage.articleId}
										>
											<span className="truncate">
												{articles.find(
													(article) => article.id === usage.articleId
												)?.title ?? usage.articleId}
											</span>
											<span className="font-mono text-muted-foreground text-xs">
												{usage.usageCount}
											</span>
										</div>
									))
								) : (
									<p className="text-muted-foreground text-xs">
										Article usage appears as the agent cites knowledge.
									</p>
								)}
							</div>
						</div>
					</div>
					<div className="rounded-2xl border border-warning/25 bg-warning/10 p-4 text-sm">
						<p className="font-medium">
							{insights.unansweredQuestions} unanswered questions need
							attention.
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							Use the Knowledge view to turn a resolved answer into an article
							draft.
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
