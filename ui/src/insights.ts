import type { ArticleDocument, TicketDocument } from "./types.ts";

export interface TopicInsight {
	count: number;
	topic: string;
}

export interface ArticleUsageInsight {
	articleId: string;
	usageCount: number;
}

export interface HelpCenterInsights {
	articleUsage: ArticleUsageInsight[];
	averageResolutionTimeMs: number | null;
	humanHandoffRate: number;
	openTickets: number;
	resolvedTickets: number;
	topTopics: TopicInsight[];
	unansweredQuestions: number;
}

function timestamp(value: string): number | null {
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function deriveInsights(
	tickets: TicketDocument[],
	articles: ArticleDocument[],
	now: string | number | Date
): HelpCenterInsights {
	void now;
	const resolvedTickets = tickets.filter(
		(ticket) => ticket.status === "resolved"
	);
	const handoffCount = tickets.filter(
		(ticket) => ticket.aiState === "human-reviewed"
	).length;
	const unansweredQuestions = tickets.filter(
		(ticket) => ticket.aiConfidence !== null && ticket.aiConfidence < 0.5
	).length;

	const resolutionDurations = resolvedTickets.flatMap((ticket) => {
		const createdAt = timestamp(ticket.createdAt);
		const updatedAt = timestamp(ticket.updatedAt);
		if (createdAt === null || updatedAt === null || updatedAt < createdAt) {
			return [];
		}
		return [updatedAt - createdAt];
	});

	const topics = new Map<string, number>();
	for (const ticket of tickets) {
		if (ticket.topic) {
			topics.set(ticket.topic, (topics.get(ticket.topic) ?? 0) + 1);
		}
	}

	return {
		openTickets: tickets.filter((ticket) => ticket.status !== "resolved")
			.length,
		resolvedTickets: resolvedTickets.length,
		humanHandoffRate: tickets.length === 0 ? 0 : handoffCount / tickets.length,
		unansweredQuestions,
		averageResolutionTimeMs:
			resolutionDurations.length === 0
				? null
				: resolutionDurations.reduce((sum, duration) => sum + duration, 0) /
					resolutionDurations.length,
		topTopics: [...topics.entries()]
			.sort(
				(left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
			)
			.map(([topic, count]) => ({ topic, count })),
		articleUsage: articles
			.filter(
				(article) =>
					Number.isFinite(article.usageCount) && article.usageCount >= 0
			)
			.sort(
				(left, right) =>
					right.usageCount - left.usageCount || left.id.localeCompare(right.id)
			)
			.map((article) => ({
				articleId: article.id,
				usageCount: article.usageCount,
			})),
	};
}
