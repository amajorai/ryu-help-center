import { describe, expect, test } from "bun:test";
import type { TicketDocument } from "./types.ts";
import {
	chooseSelectedTicketId,
	filterTickets,
	getResolutionRibbonState,
} from "./ui-state.ts";

function makeTicket(
	overrides: Partial<TicketDocument> & Pick<TicketDocument, "id" | "subject">
): TicketDocument {
	const { id, subject, ...restOverrides } = overrides;
	return {
		aiConfidence: null,
		aiState: "none",
		assigneeId: null,
		channel: "in-app",
		createdAt: "2026-08-24T08:00:00.000Z",
		id,
		linkedArticleIds: [],
		messages: [
			{
				author: "customer",
				authorName: "Maya Chen",
				body: "A customer message about exports",
				createdAt: "2026-08-24T08:00:00.000Z",
				id: `${overrides.id}-message`,
				internal: false,
			},
		],
		priority: "normal",
		requester: {
			avatarSeed: "maya",
			company: "Northstar Labs",
			email: "maya@example.com",
			id: "user-maya",
			name: "Maya Chen",
		},
		schemaVersion: 1,
		sentiment: null,
		snoozedUntil: null,
		status: "open",
		subject,
		tags: ["exports"],
		topic: "Reports",
		type: "help-center/ticket",
		updatedAt: "2026-08-24T08:10:00.000Z",
		...restOverrides,
	};
}

describe("Help Center ticket UI state", () => {
	test("Inbox excludes resolved tickets by default", () => {
		const tickets = [
			makeTicket({ id: "open-1", subject: "Open question" }),
			makeTicket({
				id: "resolved-1",
				status: "resolved",
				subject: "Resolved question",
			}),
		];

		const visible = filterTickets(tickets, {
			filter: "all",
			queue: "inbox",
		});
		expect(visible).toHaveLength(1);
		expect(visible[0]?.id).toBe("open-1");
	});

	test("Tickets includes resolved and reopened records", () => {
		const resolved = makeTicket({
			id: "resolved-1",
			status: "resolved",
			subject: "Resolved question",
		});
		const reopened = makeTicket({
			id: "reopened-1",
			status: "open",
			subject: "Reopened question",
		});

		const visibleIds = filterTickets([resolved, reopened], {
			filter: "all",
			queue: "tickets",
		}).map((ticket) => ticket.id);

		expect(visibleIds).toHaveLength(2);
		expect(visibleIds).toContain("resolved-1");
		expect(visibleIds).toContain("reopened-1");
	});

	test("search matches subject, requester, tags, and message text", () => {
		const subjectMatch = makeTicket({
			id: "subject",
			subject: "Export is blocked",
		});
		const requesterMatch = makeTicket({
			id: "requester",
			subject: "Workspace question",
			requester: {
				avatarSeed: "jon",
				company: "Rookery Studio",
				email: "jon@example.com",
				id: "user-jon",
				name: "Jon Bell",
			},
		});
		const tagMatch = makeTicket({
			id: "tag",
			subject: "Workspace question",
			tags: ["permissions"],
		});
		const messageMatch = makeTicket({
			id: "message",
			subject: "Workspace question",
			messages: [
				{
					author: "customer",
					authorName: "Maya Chen",
					body: "The report export spins forever",
					createdAt: "2026-08-24T08:00:00.000Z",
					id: "message-1",
					internal: false,
				},
			],
		});

		expect(
			filterTickets([subjectMatch], {
				filter: "all",
				queue: "tickets",
				query: "blocked",
			})
		).toHaveLength(1);
		expect(
			filterTickets([requesterMatch], {
				filter: "all",
				queue: "tickets",
				query: "jon@example.com",
			})
		).toHaveLength(1);
		expect(
			filterTickets([tagMatch], {
				filter: "all",
				queue: "tickets",
				query: "permissions",
			})
		).toHaveLength(1);
		expect(
			filterTickets([messageMatch], {
				filter: "all",
				queue: "tickets",
				query: "spins forever",
			})
		).toHaveLength(1);
	});

	test("urgent priority sorts before normal priority, then newest update", () => {
		const urgentOld = makeTicket({
			id: "urgent-old",
			priority: "urgent",
			subject: "Older urgent",
			updatedAt: "2026-08-24T08:05:00.000Z",
		});
		const urgentNew = makeTicket({
			id: "urgent-new",
			priority: "urgent",
			subject: "Newer urgent",
			updatedAt: "2026-08-24T08:15:00.000Z",
		});
		const normal = makeTicket({
			id: "normal",
			subject: "Normal question",
			updatedAt: "2026-08-24T08:30:00.000Z",
		});

		expect(
			filterTickets([normal, urgentOld, urgentNew], {
				filter: "all",
				queue: "tickets",
			}).map((ticket) => ticket.id)
		).toEqual(["urgent-new", "urgent-old", "normal"]);
	});

	test("resolution ribbon reflects ai state and ticket status", () => {
		const suggested = getResolutionRibbonState(
			makeTicket({
				id: "suggested",
				subject: "Suggested",
				aiState: "suggested",
			})
		);
		const resolved = getResolutionRibbonState(
			makeTicket({ id: "resolved", subject: "Resolved", status: "resolved" })
		);

		expect(suggested.currentStage).toBe("ai-suggested");
		expect(suggested.nextAction).toBe("Review suggestion");
		expect(resolved.currentStage).toBe("resolved");
		expect(resolved.nextAction).toBe("Reopen ticket");
	});

	test("empty selection chooses the first visible ticket", () => {
		const visible = [
			makeTicket({ id: "first", subject: "First" }),
			makeTicket({ id: "second", subject: "Second" }),
		];

		expect(chooseSelectedTicketId(null, visible)).toBe("first");
		expect(chooseSelectedTicketId("missing", visible)).toBe("first");
		expect(chooseSelectedTicketId("second", visible)).toBe("second");
		expect(chooseSelectedTicketId("second", [])).toBeNull();
	});
});
