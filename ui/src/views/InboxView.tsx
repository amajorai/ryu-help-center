import { Add01Icon, InboxIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@ryu/ui/components/button.tsx";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@ryu/ui/components/empty.tsx";
import { Input } from "@ryu/ui/components/input.tsx";
import { TicketRow } from "../components/TicketRow.tsx";
import type { TicketDocument } from "../types.ts";
import {
	filterTickets,
	type QueueFilter,
	type QueueView,
} from "../ui-state.ts";

const FILTERS: Array<{ id: QueueFilter; label: string }> = [
	{ id: "all", label: "All" },
	{ id: "my-queue", label: "My queue" },
	{ id: "unassigned", label: "Unassigned" },
	{ id: "open", label: "Open" },
	{ id: "waiting", label: "Waiting" },
	{ id: "snoozed", label: "Snoozed" },
	{ id: "resolved", label: "Resolved" },
];

export function InboxView({
	assigneeId,
	filter,
	onCreateTicket,
	onFilterChange,
	onQueryChange,
	onSelect,
	query,
	queue,
	selectedTicketId,
	tickets,
}: {
	assigneeId: string | null;
	filter: QueueFilter;
	onCreateTicket: () => void;
	onFilterChange: (filter: QueueFilter) => void;
	onQueryChange: (query: string) => void;
	onSelect: (ticketId: string) => void;
	query: string;
	queue: QueueView;
	selectedTicketId: string | null;
	tickets: TicketDocument[];
}) {
	const visibleTickets = filterTickets(tickets, {
		assigneeId,
		filter,
		query,
		queue,
	});
	const title = queue === "inbox" ? "Inbox" : "Tickets";
	const description =
		queue === "inbox"
			? "Active support work, with AI suggestions close at hand."
			: "Every ticket in the Help Center Space, including resolved history.";

	return (
		<section
			className="flex min-h-0 min-w-0 flex-1 flex-col"
			data-testid="help-center-queue"
		>
			<header className="flex flex-wrap items-start justify-between gap-4 border-border/70 border-b px-5 py-5">
				<div>
					<div className="flex items-center gap-2">
						<span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<HugeiconsIcon aria-hidden="true" icon={InboxIcon} />
						</span>
						<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
							{queue === "inbox" ? "Active queue" : "Record history"}
						</p>
					</div>
					<h1 className="mt-3 font-semibold text-2xl tracking-tight">
						{title}
					</h1>
					<p className="mt-1 max-w-xl text-muted-foreground text-sm">
						{description}
					</p>
				</div>
				<Button onClick={onCreateTicket} size="sm">
					<HugeiconsIcon aria-hidden="true" icon={Add01Icon} />
					New ticket
				</Button>
			</header>

			<div className="flex min-h-0 flex-1 flex-col">
				<div className="space-y-3 border-border/70 border-b p-4">
					<div className="relative">
						<HugeiconsIcon
							aria-hidden="true"
							className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
							icon={Search01Icon}
						/>
						<Input
							aria-label="Search Help Center tickets"
							className="pl-9"
							onChange={(event) => onQueryChange(event.target.value)}
							placeholder="Search tickets, people, or topics"
							value={query}
						/>
					</div>
					<div
						aria-label="Ticket filters"
						className="flex gap-1 overflow-x-auto"
						role="tablist"
					>
						{FILTERS.map((item) => (
							<Button
								aria-selected={filter === item.id}
								className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${filter === item.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
								key={item.id}
								onClick={() => onFilterChange(item.id)}
								role="tab"
								type="button"
							>
								{item.label}
							</Button>
						))}
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto">
					{visibleTickets.length > 0 ? (
						visibleTickets.map((ticket) => (
							<TicketRow
								key={ticket.id}
								onSelect={onSelect}
								selected={selectedTicketId === ticket.id}
								ticket={ticket}
							/>
						))
					) : (
						<Empty className="min-h-72 border-0">
							<EmptyHeader>
								<span className="mx-auto flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
									<HugeiconsIcon aria-hidden="true" icon={InboxIcon} />
								</span>
								<EmptyTitle>No tickets in this view</EmptyTitle>
								<EmptyDescription>
									Try another filter or create a ticket to start the queue.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}
				</div>
			</div>
		</section>
	);
}
