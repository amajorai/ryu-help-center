import {
	CheckmarkCircle02Icon,
	SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@ryu/ui/components/button.tsx";
import type { TicketDocument } from "../types.ts";
import { getResolutionRibbonState } from "../ui-state.ts";

export function ResolutionRibbon({
	onAction,
	ticket,
}: {
	onAction: () => void;
	ticket: TicketDocument;
}) {
	const ribbon = getResolutionRibbonState(ticket);

	return (
		<section
			aria-label="Ticket resolution status"
			className="border-border/70 border-b bg-muted/20 px-5 py-3"
			data-testid="help-center-resolution-ribbon"
		>
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					<div className="flex items-center gap-1.5" role="list">
						{ribbon.steps.map((step, index) => (
							<div
								className="flex items-center gap-1.5"
								key={step.id}
								role="listitem"
							>
								<span
									aria-label={`${step.label}: ${step.state}`}
									className={`size-2 rounded-full ${
										step.state === "current"
											? "bg-primary ring-4 ring-primary/15"
											: step.state === "complete"
												? "bg-success"
												: "bg-muted-foreground/30"
									}`}
									role="img"
								/>
								<span className="hidden text-muted-foreground text-xs sm:inline">
									{step.label}
								</span>
								{index < ribbon.steps.length - 1 ? (
									<span
										aria-hidden="true"
										className="mx-1 h-px w-5 bg-border"
									/>
								) : null}
							</div>
						))}
					</div>
					<div className="hidden min-w-0 md:block">
						<p className="font-medium text-xs">{ribbon.currentLabel}</p>
						<p className="truncate text-muted-foreground text-xs">
							{ribbon.description}
						</p>
					</div>
				</div>
				<Button onClick={onAction} size="sm" variant="outline">
					{ribbon.currentStage === "resolved" ? (
						<HugeiconsIcon aria-hidden="true" icon={CheckmarkCircle02Icon} />
					) : (
						<HugeiconsIcon aria-hidden="true" icon={SparklesIcon} />
					)}
					{ribbon.nextAction}
				</Button>
			</div>
		</section>
	);
}
