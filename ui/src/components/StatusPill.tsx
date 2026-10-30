import {
	AlertCircleIcon,
	CheckmarkCircle02Icon,
	Clock01Icon,
	InboxIcon,
	SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useLiteralMessages } from "@ryu/i18n/react";
import { Badge } from "@ryu/ui/components/badge.tsx";
import type { TicketChannel, TicketPriority, TicketStatus } from "../types.ts";

const STATUS_COPY = {
	open: {
		iconTone: "text-status-info",
		icon: InboxIcon,
		label: "Open",
	},
	waiting: {
		iconTone: "text-status-warning",
		icon: Clock01Icon,
		label: "Waiting",
	},
	snoozed: {
		iconTone: "text-primary",
		icon: Clock01Icon,
		label: "Snoozed",
	},
	resolved: {
		iconTone: "text-status-success",
		icon: CheckmarkCircle02Icon,
		label: "Resolved",
	},
} satisfies Record<
	TicketStatus,
	{ icon: IconSvgElement; label: string; iconTone: string }
>;

const PRIORITY_COPY = {
	urgent: {
		iconTone: "text-status-destructive",
		icon: AlertCircleIcon,
		label: "Urgent",
	},
	high: {
		iconTone: "text-status-warning",
		icon: AlertCircleIcon,
		label: "High",
	},
	normal: {
		iconTone: "text-muted-foreground",
		icon: InboxIcon,
		label: "Normal",
	},
	low: {
		iconTone: "text-muted-foreground",
		icon: SparklesIcon,
		label: "Low",
	},
} satisfies Record<
	TicketPriority,
	{ icon: IconSvgElement; label: string; iconTone: string }
>;

const CHANNEL_LABELS = {
	"in-app": "In app",
	email: "Email",
	chat: "Chat",
} satisfies Record<TicketChannel, string>;

export function StatusPill({ status }: { status: TicketStatus }) {
	const tl = useLiteralMessages();
	const copy = STATUS_COPY[status];
	return (
		<Badge
			aria-label={tl("Ticket status: {label}", { label: copy.label })}
			variant="outline"
		>
			<HugeiconsIcon
				aria-hidden="true"
				className={copy.iconTone}
				icon={copy.icon}
			/>
			{copy.label}
		</Badge>
	);
}

export function PriorityPill({ priority }: { priority: TicketPriority }) {
	const tl = useLiteralMessages();
	const copy = PRIORITY_COPY[priority];
	return (
		<Badge
			aria-label={tl("Ticket priority: {label}", { label: copy.label })}
			variant="outline"
		>
			<HugeiconsIcon
				aria-hidden="true"
				className={copy.iconTone}
				icon={copy.icon}
			/>
			{copy.label}
		</Badge>
	);
}

export function ChannelPill({ channel }: { channel: TicketChannel }) {
	return (
		<span className="font-medium text-muted-foreground text-xs">
			{CHANNEL_LABELS[channel]}
		</span>
	);
}

export function statusLabel(status: TicketStatus): string {
	return STATUS_COPY[status].label;
}
