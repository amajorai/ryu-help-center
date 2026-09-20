import { Mail01Icon, User02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@ryu/ui/components/badge.tsx";
import type { TicketDocument } from "../types.ts";

function initials(name: string): string {
	return name
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

export function CustomerContext({
	relatedTicketCount,
	ticket,
}: {
	relatedTicketCount: number;
	ticket: TicketDocument;
}) {
	return (
		<aside
			className="flex min-h-0 flex-col gap-5 overflow-y-auto border-border/70 border-l bg-card p-5"
			data-testid="help-center-customer-context"
		>
			<div className="flex items-center gap-3">
				<span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 font-medium text-primary ring-1 ring-primary/20">
					{initials(ticket.requester.name)}
				</span>
				<div className="min-w-0">
					<p className="truncate font-medium">{ticket.requester.name}</p>
					<p className="truncate text-muted-foreground text-xs">
						{ticket.requester.company ?? "Independent customer"}
					</p>
				</div>
			</div>

			<div className="space-y-2 text-xs">
				<div className="flex items-center gap-2 text-muted-foreground">
					<HugeiconsIcon aria-hidden="true" icon={Mail01Icon} />
					<span className="truncate">{ticket.requester.email}</span>
				</div>
				<div className="flex items-center gap-2 text-muted-foreground">
					<HugeiconsIcon aria-hidden="true" icon={User02Icon} />
					<span>
						{relatedTicketCount} ticket{relatedTicketCount === 1 ? "" : "s"} in
						this Space
					</span>
				</div>
			</div>

			<div className="space-y-2">
				<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
					Requester context
				</p>
				<div className="grid grid-cols-2 gap-2 text-xs">
					<div className="rounded-xl border border-border/70 bg-muted/30 p-3">
						<p className="text-muted-foreground">Channel</p>
						<p className="mt-1 font-medium capitalize">
							{ticket.channel.replace("-", " ")}
						</p>
					</div>
					<div className="rounded-xl border border-border/70 bg-muted/30 p-3">
						<p className="text-muted-foreground">Topic</p>
						<p className="mt-1 font-medium">
							{ticket.topic ?? "Uncategorized"}
						</p>
					</div>
				</div>
			</div>

			<div className="space-y-2">
				<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
					Tags
				</p>
				<div className="flex flex-wrap gap-1.5">
					{ticket.tags.length > 0 ? (
						ticket.tags.map((tag) => (
							<Badge key={tag} variant="secondary">
								{tag}
							</Badge>
						))
					) : (
						<span className="text-muted-foreground text-xs">No tags yet</span>
					)}
				</div>
			</div>

			<div className="mt-auto rounded-2xl border border-primary/20 bg-primary/5 p-4">
				<p className="font-medium text-sm">Keep context close</p>
				<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
					Everything here comes from the selected Help Center ticket and its
					Space.
				</p>
			</div>
		</aside>
	);
}
