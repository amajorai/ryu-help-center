import {
	AlertCircleIcon,
	CheckmarkCircle02Icon,
	Clock01Icon,
	InboxIcon,
	SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Badge } from "@ryu/ui/components/badge.tsx";
import { cn } from "@ryu/ui/lib/utils.ts";
import type { TicketChannel, TicketPriority, TicketStatus } from "../types.ts";

const STATUS_COPY: Record<
	TicketStatus,
	{ icon: IconSvgElement; label: string; className: string }
> = {
	open: {
		className: "border-info/30 bg-info/10 text-info",
		icon: InboxIcon,
		label: "Open",
	},
	waiting: {
		className: "border-warning/30 bg-warning/10 text-warning-foreground",
		icon: Clock01Icon,
		label: "Waiting",
	},
	snoozed: {
		className: "border-primary/30 bg-primary/10 text-primary",
		icon: Clock01Icon,
		label: "Snoozed",
	},
	resolved: {
		className: "border-success/30 bg-success/10 text-success",
		icon: CheckmarkCircle02Icon,
		label: "Resolved",
	},
};

const PRIORITY_COPY: Record<
	TicketPriority,
	{ icon: IconSvgElement; label: string; className: string }
> = {
	urgent: {
		className: "border-destructive/30 bg-destructive/10 text-destructive",
		icon: AlertCircleIcon,
		label: "Urgent",
	},
	high: {
		className: "border-warning/30 bg-warning/10 text-warning-foreground",
		icon: AlertCircleIcon,
		label: "High",
	},
	normal: {
		className: "border-border bg-muted/50 text-muted-foreground",
		icon: InboxIcon,
		label: "Normal",
	},
	low: {
		className: "border-border bg-background text-muted-foreground",
		icon: SparklesIcon,
		label: "Low",
	},
};

const CHANNEL_LABELS: Record<TicketChannel, string> = {
	"in-app": "In app",
	email: "Email",
	chat: "Chat",
};

export function StatusPill({ status }: { status: TicketStatus }) {
	const copy = STATUS_COPY[status];
	return (
		<Badge
			aria-label={`Ticket status: ${copy.label}`}
			className={cn("gap-1", copy.className)}
			variant="outline"
		>
			<HugeiconsIcon aria-hidden="true" icon={copy.icon} />
			{copy.label}
		</Badge>
	);
}

export function PriorityPill({ priority }: { priority: TicketPriority }) {
	const copy = PRIORITY_COPY[priority];
	return (
		<Badge
			aria-label={`Ticket priority: ${copy.label}`}
			className={cn("gap-1", copy.className)}
			variant="outline"
		>
			<HugeiconsIcon aria-hidden="true" icon={copy.icon} />
			{copy.label}
		</Badge>
	);
}

export function ChannelPill({ channel }: { channel: TicketChannel }) {
	return (
		<span className="font-medium text-[11px] text-muted-foreground">
			{CHANNEL_LABELS[channel]}
		</span>
	);
}

export function statusLabel(status: TicketStatus): string {
	return STATUS_COPY[status].label;
}
