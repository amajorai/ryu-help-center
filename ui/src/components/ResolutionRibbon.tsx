import {
	CheckmarkCircle02Icon,
	SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type LiteralMessage, useLiteralMessages } from "@ryu/i18n/react";
import { Button } from "@ryu/ui/components/button.tsx";
import type { TicketDocument } from "../types.ts";
import {
	getResolutionRibbonState,
	type ResolutionRibbonState,
	type ResolutionStage,
	type ResolutionStepState,
} from "../ui-state.ts";

function stageLabel(tl: LiteralMessage, stage: ResolutionStage): string {
	if (stage === "ai-suggested") {
		return tl("AI suggested");
	}
	return stage === "human-working" ? tl("Human working") : tl("Resolved");
}

function stageDescription(tl: LiteralMessage, stage: ResolutionStage): string {
	if (stage === "ai-suggested") {
		return tl("Ryu prepared a suggestion for human review.");
	}
	return stage === "resolved"
		? tl("This ticket is resolved in the local Help Center record.")
		: tl("A human operator owns the next decision.");
}

function stepStateLabel(
	tl: LiteralMessage,
	state: ResolutionStepState
): string {
	if (state === "complete") {
		return tl("Completed step");
	}
	return state === "current" ? tl("Current step") : tl("Upcoming step");
}

function nextActionLabel(
	tl: LiteralMessage,
	action: ResolutionRibbonState["nextAction"]
): string {
	if (action === "Review suggestion") {
		return tl("Review suggestion");
	}
	return action === "Reopen ticket"
		? tl("Reopen ticket")
		: tl("Resolve ticket");
}

export function ResolutionRibbon({
	onAction,
	ticket,
}: {
	onAction: () => void;
	ticket: TicketDocument;
}) {
	const tl = useLiteralMessages();
	const ribbon = getResolutionRibbonState(ticket);
	const description = stageDescription(tl, ribbon.currentStage);

	return (
		<section
			aria-label={tl("Ticket resolution status")}
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
									aria-label={tl("{step}: {state}", {
										state: stepStateLabel(tl, step.state),
										step: stageLabel(tl, step.id),
									})}
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
									{stageLabel(tl, step.id)}
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
						<p className="font-medium text-xs">
							{stageLabel(tl, ribbon.currentStage)}
						</p>
						<p
							className="truncate text-muted-foreground text-xs"
							title={description}
						>
							{description}
						</p>
					</div>
				</div>
				<Button onClick={onAction} size="sm" variant="outline">
					{ribbon.currentStage === "resolved" ? (
						<HugeiconsIcon aria-hidden="true" icon={CheckmarkCircle02Icon} />
					) : (
						<HugeiconsIcon aria-hidden="true" icon={SparklesIcon} />
					)}
					{nextActionLabel(tl, ribbon.nextAction)}
				</Button>
			</div>
		</section>
	);
}
