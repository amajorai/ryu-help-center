import { RyuAppListItem } from "@ryu/blocks/companion/app-ui";
import type { TicketDocument } from "../types.ts";
import { ChannelPill, PriorityPill, StatusPill } from "./StatusPill.tsx";
import styles from "./ticket-row.module.css";

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
		<RyuAppListItem
			aria-label={`${ticket.subject}, ${ticket.requester.name}, ${ticket.status}`}
			className={styles.row}
			data-testid="help-center-ticket-row"
			data-ticket-id={ticket.id}
			icon={
				<span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 font-medium text-primary text-xs ring-1 ring-primary/15">
					{initials(ticket.requester.name)}
				</span>
			}
			onClick={() => onSelect(ticket.id)}
			selected={selected}
			subtitle={
				<span className={styles.subtitle}>
					<span
						className={styles.requester}
						data-testid="help-center-ticket-requester"
					>
						{ticket.requester.name} ·{" "}
						{latestMessage?.body ?? "No messages yet."}
					</span>
					<span
						className={`ryu-app-list__item-accessories ${styles.accessories}`}
					>
						<time
							className={`font-mono text-muted-foreground text-xs tabular-nums ${styles.nowrap}`}
							dateTime={ticket.updatedAt}
						>
							{relativeTime(ticket.updatedAt)}
						</time>
						<StatusPill status={ticket.status} />
						<PriorityPill priority={ticket.priority} />
						<span className={styles.nowrap}>
							<ChannelPill channel={ticket.channel} />
						</span>
						{needsResponse ? (
							<span
								className={`inline-flex items-center gap-1 text-primary text-xs ${styles.nowrap}`}
							>
								<span
									aria-hidden="true"
									className="size-1.5 rounded-full bg-primary"
								/>
								Needs reply
							</span>
						) : null}
					</span>
				</span>
			}
			title={ticket.subject}
		/>
	);
}
