import { ArrowRight01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@ryu/ui/components/badge.tsx";
import { Button } from "@ryu/ui/components/button.tsx";
import { Input } from "@ryu/ui/components/input.tsx";
import { Textarea } from "@ryu/ui/components/textarea.tsx";
import { useState } from "react";
import { answerCustomerQuestion } from "../ai.ts";
import type { ArticleDocument } from "../types.ts";

export function AgentView({
	articles,
	mode,
	spaceId,
}: {
	articles: ArticleDocument[];
	mode: "demo" | "live";
	spaceId: string | null;
}) {
	const [question, setQuestion] = useState("");
	const [answer, setAnswer] = useState<Awaited<
		ReturnType<typeof answerCustomerQuestion>
	> | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [tone, setTone] = useState("clear, helpful, and concise");
	const [guardrails, setGuardrails] = useState(
		"Say when you are unsure. Escalate account changes to a human."
	);

	const runPreview = async (): Promise<void> => {
		if (!question.trim()) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			setAnswer(
				await answerCustomerQuestion(question, {
					settings: { guardrails, tone },
					spaceId: spaceId ?? undefined,
				})
			);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "The agent preview failed"
			);
		} finally {
			setBusy(false);
		}
	};

	return (
		<section
			className="flex min-h-0 min-w-0 flex-1 flex-col"
			data-testid="help-center-agent"
		>
			<header className="border-border/70 border-b px-5 py-5">
				<div className="flex items-center gap-2">
					<span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<HugeiconsIcon aria-hidden="true" icon={SparklesIcon} />
					</span>
					<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
						Agent control
					</p>
				</div>
				<h1 className="mt-3 font-semibold text-2xl tracking-tight">Agent</h1>
				<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
					Shape the support voice, then test it against the knowledge your team
					has approved.
				</p>
			</header>
			<div className="min-h-0 flex-1 overflow-y-auto p-5">
				<div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
					<div className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
						<div>
							<p className="font-medium text-sm">Behavior</p>
							<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
								These settings stay local to the preview until a dedicated
								preference bridge is added.
							</p>
						</div>
						<label
							className="grid gap-2 font-medium text-xs"
							htmlFor="agent-tone"
						>
							Tone
							<Input
								id="agent-tone"
								onChange={(event) => setTone(event.target.value)}
								value={tone}
							/>
						</label>
						<label
							className="grid gap-2 font-medium text-xs"
							htmlFor="agent-guardrails"
						>
							Guardrails
							<Textarea
								className="min-h-28"
								id="agent-guardrails"
								onChange={(event) => setGuardrails(event.target.value)}
								value={guardrails}
							/>
						</label>
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed">
							<p className="font-medium">Knowledge sources</p>
							<p className="mt-1 text-muted-foreground">
								{articles.length} Help Center article
								{articles.length === 1 ? "" : "s"} available for retrieval.
							</p>
						</div>
					</div>

					<div className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
						<div className="flex items-start justify-between gap-4">
							<div>
								<p className="font-medium text-sm">Customer preview</p>
								<p className="mt-1 text-muted-foreground text-xs">
									Ask a question as a customer would.
								</p>
							</div>
							<Badge variant="outline">
								{mode === "demo" ? "Demo mode" : "Live model"}
							</Badge>
						</div>
						<div className="flex gap-2">
							<Input
								aria-label="Customer preview question"
								onChange={(event) => setQuestion(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										void runPreview();
									}
								}}
								placeholder="How do I export a report?"
								value={question}
							/>
							<Button
								disabled={busy || !question.trim()}
								onClick={() => void runPreview()}
								size="sm"
							>
								{busy ? "Answering…" : "Ask"}
							</Button>
						</div>
						{error ? (
							<p
								className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive text-xs"
								role="alert"
							>
								{error}
							</p>
						) : null}
						{answer ? (
							<div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
								<div className="flex items-center gap-2 text-primary text-xs">
									<HugeiconsIcon aria-hidden="true" icon={SparklesIcon} />
									Ryu Help Center agent
								</div>
								<p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
									{answer.answer}
								</p>
								{answer.citedArticleIds.length > 0 ? (
									<div className="mt-3 flex flex-wrap gap-1.5">
										{answer.citedArticleIds.map((id) => (
											<Badge key={id} variant="secondary">
												Source:{" "}
												{articles.find((article) => article.id === id)?.title ??
													id}
											</Badge>
										))}
									</div>
								) : null}
								{answer.shouldEscalate ? (
									<p className="mt-3 flex items-center gap-1 text-warning-foreground text-xs">
										<HugeiconsIcon aria-hidden="true" icon={ArrowRight01Icon} />
										Human handoff recommended
									</p>
								) : null}
							</div>
						) : (
							<div className="rounded-2xl border border-border border-dashed p-8 text-center text-muted-foreground text-sm">
								The preview answer will appear here with sources and handoff
								guidance.
							</div>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
