import type { AiState, TicketDocument, TicketPriority } from "./types.ts";

export type QueueView = "inbox" | "tickets";
export type QueueFilter =
	| "all"
	| "my-queue"
	| "unassigned"
	| "open"
	| "waiting"
	| "snoozed"
	| "resolved";

export interface TicketFilterOptions {
	assigneeId?: string | null;
	filter: QueueFilter;
	query?: string;
	queue: QueueView;
}

const PRIORITY_ORDER: Record<TicketPriority, number> = {
	urgent: 0,
	high: 1,
	normal: 2,
	low: 3,
};

function timestamp(value: string): number {
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function searchableTicketText(ticket: TicketDocument): string {
	return [
		ticket.id,
		ticket.subject,
		ticket.requester.name,
		ticket.requester.email,
		ticket.requester.company ?? "",
		ticket.topic ?? "",
		ticket.tags.join(" "),
		ticket.messages
			.map((message) => `${message.authorName} ${message.body}`)
			.join(" "),
	]
		.join(" ")
		.toLocaleLowerCase();
}

export function matchesTicketQuery(
	ticket: TicketDocument,
	query: string | undefined
): boolean {
	const normalizedQuery = query?.trim().toLocaleLowerCase() ?? "";
	return (
		normalizedQuery.length === 0 ||
		searchableTicketText(ticket).includes(normalizedQuery)
	);
}

export function sortTickets(tickets: TicketDocument[]): TicketDocument[] {
	return [...tickets].sort((left, right) => {
		const priorityDifference =
			PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
		if (priorityDifference !== 0) {
			return priorityDifference;
		}
		return timestamp(right.updatedAt) - timestamp(left.updatedAt);
	});
}

function matchesFilter(
	ticket: TicketDocument,
	filter: QueueFilter,
	assigneeId: string | null | undefined
): boolean {
	switch (filter) {
		case "all":
			return true;
		case "my-queue":
			return assigneeId !== undefined && ticket.assigneeId === assigneeId;
		case "unassigned":
			return ticket.assigneeId === null;
		case "open":
		case "waiting":
		case "snoozed":
		case "resolved":
			return ticket.status === filter;
	}
}

export function filterTickets(
	tickets: TicketDocument[],
	options: TicketFilterOptions
): TicketDocument[] {
	const filtered = tickets.filter((ticket) => {
		if (
			options.queue === "inbox" &&
			options.filter === "all" &&
			ticket.status === "resolved"
		) {
			return false;
		}
		return (
			matchesFilter(ticket, options.filter, options.assigneeId) &&
			matchesTicketQuery(ticket, options.query)
		);
	});
	return sortTickets(filtered);
}

export function chooseSelectedTicketId(
	selectedTicketId: string | null,
	visibleTickets: TicketDocument[]
): string | null {
	if (
		selectedTicketId &&
		visibleTickets.some((ticket) => ticket.id === selectedTicketId)
	) {
		return selectedTicketId;
	}
	return visibleTickets[0]?.id ?? null;
}

export type ResolutionStage = "ai-suggested" | "human-working" | "resolved";
export type ResolutionStepState = "complete" | "current" | "upcoming";

export interface ResolutionRibbonState {
	currentLabel: string;
	currentStage: ResolutionStage;
	description: string;
	nextAction: "Review suggestion" | "Resolve ticket" | "Reopen ticket";
	steps: Array<{
		id: ResolutionStage;
		label: string;
		state: ResolutionStepState;
	}>;
}

function stageForTicket(
	status: TicketDocument["status"],
	aiState: AiState
): ResolutionStage {
	if (status === "resolved") {
		return "resolved";
	}
	return aiState === "suggested" ? "ai-suggested" : "human-working";
}

export function getResolutionRibbonState(
	ticket: Pick<TicketDocument, "aiState" | "status">
): ResolutionRibbonState {
	const currentStage = stageForTicket(ticket.status, ticket.aiState);
	const stages: ResolutionStage[] = [
		"ai-suggested",
		"human-working",
		"resolved",
	];
	const currentIndex = stages.indexOf(currentStage);
	const steps = stages.map((stage, index) => ({
		id: stage,
		label:
			stage === "ai-suggested"
				? "AI suggested"
				: stage === "human-working"
					? "Human working"
					: "Resolved",
		state:
			index < currentIndex
				? ("complete" as const)
				: index === currentIndex
					? ("current" as const)
					: ("upcoming" as const),
	}));

	if (currentStage === "ai-suggested") {
		return {
			currentLabel: "AI suggested",
			currentStage,
			description: "Ryu prepared a suggestion for human review.",
			nextAction: "Review suggestion",
			steps,
		};
	}
	if (currentStage === "resolved") {
		return {
			currentLabel: "Resolved",
			currentStage,
			description: "This ticket is resolved in the local Help Center record.",
			nextAction: "Reopen ticket",
			steps,
		};
	}
	return {
		currentLabel: "Human working",
		currentStage,
		description: "A human operator owns the next decision.",
		nextAction: "Resolve ticket",
		steps,
	};
}
