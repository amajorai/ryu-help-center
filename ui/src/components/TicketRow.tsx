import { Button } from "@ryu/ui/components/button.tsx";
import type { TicketDocument } from "../types.ts";
import { ChannelPill, PriorityPill, StatusPill } from "./StatusPill.tsx";

function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) {
		return "?";
	}
	return parts
		.slice(0, 2)
		.map((part) => part[0]?.toLocaleUpperCase() ?? "")
		.join("");
}

function relativeTime(value: string): string {
	const timestamp = Date.parse(value);
	if (!Number.isFinite(timestamp)) {
		return "Recently";
	}
	const deltaSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
	if (deltaSeconds < 60) {
		return "Just now";
	}
	if (deltaSeconds < 3600) {
		return `${Math.round(deltaSeconds / 60)}m ago`;
	}
	if (deltaSeconds < 86_400) {
		return `${Math.round(deltaSeconds / 3600)}h ago`;
	}
	return `${Math.round(deltaSeconds / 86_400)}d ago`;
}

export interface TicketRowProps {
	onSelect: (ticketId: string) => void;
	selected: boolean;
	ticket: TicketDocument;
}

export function TicketRow({ onSelect, selected, ticket }: TicketRowProps) {
	const latestMessage = ticket.messages.at(-1);
	const needsResponse =
		latestMessage?.author === "customer" && ticket.status !== "resolved";
	return (
		<Button
			aria-current={selected ? "true" : undefined}
			aria-label={`${ticket.subject}, ${ticket.requester.name}, ${ticket.status}`}
			className={`help-center-ticket-row group flex w-full items-start gap-3 border-border/70 border-b px-3 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${selected ? "bg-primary/8" : ""}`}
			data-selected={selected ? "true" : "false"}
			data-testid="help-center-ticket-row"
			data-ticket-id={ticket.id}
			onClick={() => onSelect(ticket.id)}
			type="button"
		>
			<span
				aria-hidden="true"
				className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 font-medium text-primary text-xs ring-1 ring-primary/15"
			>
				{initials(ticket.requester.name)}
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex items-start justify-between gap-2">
					<span className="min-w-0 truncate font-medium text-sm">
						{ticket.requester.name}
					</span>
					<time
						className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums"
						dateTime={ticket.updatedAt}
					>
						{relativeTime(ticket.updatedAt)}
					</time>
				</span>
				<span className="mt-0.5 block truncate font-medium text-foreground/90 text-xs">
					{ticket.subject}
				</span>
				<span className="mt-1 line-clamp-2 block text-muted-foreground text-xs leading-4">
					{latestMessage?.body ?? "No messages yet."}
				</span>
				<span className="mt-2 flex flex-wrap items-center gap-1.5">
					<StatusPill status={ticket.status} />
					<PriorityPill priority={ticket.priority} />
					<ChannelPill channel={ticket.channel} />
					{needsResponse ? (
						<span className="inline-flex items-center gap-1 text-[10px] text-primary">
							<span
								aria-hidden="true"
								className="size-1.5 rounded-full bg-primary"
							/>
							Needs reply
						</span>
					) : null}
				</span>
			</span>
		</Button>
	);
}
