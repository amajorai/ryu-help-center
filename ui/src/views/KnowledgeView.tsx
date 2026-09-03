import {
	Add01Icon,
	BookOpen02Icon,
	Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@ryu/ui/components/button.tsx";
import { Input } from "@ryu/ui/components/input.tsx";
import {
	NativeSelect,
	NativeSelectOption,
} from "@ryu/ui/components/native-select.tsx";
import { Textarea } from "@ryu/ui/components/textarea.tsx";
import { useState } from "react";
import { ArticleCard } from "../components/ArticleCard.tsx";
import type { ArticleDocument } from "../types.ts";

function newArticle(): ArticleDocument {
	const now = new Date().toISOString();
	return {
		body: "",
		createdAt: now,
		id: `local-article-${Date.now()}`,
		schemaVersion: 1,
		sourceTicketIds: [],
		status: "draft",
		tags: [],
		title: "Untitled help article",
		type: "help-center/article",
		updatedAt: now,
		usageCount: 0,
	};
}

export function KnowledgeView({
	articles,
	onCreateArticle,
	onUpdateArticle,
}: {
	articles: ArticleDocument[];
	onCreateArticle: (article: ArticleDocument) => Promise<void>;
	onUpdateArticle: (article: ArticleDocument) => Promise<void>;
}) {
	const [query, setQuery] = useState("");
	const [status, setStatus] = useState<"all" | "draft" | "published">("all");
	const [editing, setEditing] = useState<ArticleDocument | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const normalizedQuery = query.trim().toLocaleLowerCase();
	const visibleArticles = articles.filter((article) => {
		if (status !== "all" && article.status !== status) {
			return false;
		}
		return (
			normalizedQuery.length === 0 ||
			`${article.title} ${article.body} ${article.tags.join(" ")}`
				.toLocaleLowerCase()
				.includes(normalizedQuery)
		);
	});

	const saveArticle = async (): Promise<void> => {
		if (
			!editing ||
			editing.title.trim().length === 0 ||
			editing.body.trim().length === 0
		) {
			setError("Add a title and body before saving the article.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			if (articles.some((article) => article.id === editing.id)) {
				await onUpdateArticle({
					...editing,
					updatedAt: new Date().toISOString(),
				});
			} else {
				await onCreateArticle(editing);
			}
			setEditing(null);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Could not save the article"
			);
		} finally {
			setBusy(false);
		}
	};

	return (
		<section
			className="flex min-h-0 min-w-0 flex-1 flex-col"
			data-testid="help-center-knowledge"
		>
			<header className="flex flex-wrap items-start justify-between gap-4 border-border/70 border-b px-5 py-5">
				<div>
					<div className="flex items-center gap-2">
						<span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<HugeiconsIcon aria-hidden="true" icon={BookOpen02Icon} />
						</span>
						<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
							Knowledge loop
						</p>
					</div>
					<h1 className="mt-3 font-semibold text-2xl tracking-tight">
						Knowledge
					</h1>
					<p className="mt-1 max-w-xl text-muted-foreground text-sm">
						Keep the answer your team gives once available for the next
						customer.
					</p>
				</div>
				<Button onClick={() => setEditing(newArticle())} size="sm">
					<HugeiconsIcon aria-hidden="true" icon={Add01Icon} />
					New article
				</Button>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto p-5">
				<div className="mx-auto max-w-5xl space-y-5">
					<div className="flex flex-wrap gap-3">
						<div className="relative min-w-[220px] flex-1">
							<HugeiconsIcon
								aria-hidden="true"
								className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
								icon={Search01Icon}
							/>
							<Input
								aria-label="Search Help Center knowledge"
								className="pl-9"
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Search articles and answers"
								value={query}
							/>
						</div>
						<NativeSelect
							aria-label="Filter knowledge articles"
							className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
							onChange={(event) =>
								setStatus(event.target.value as "all" | "draft" | "published")
							}
							value={status}
						>
							<NativeSelectOption value="all">All articles</NativeSelectOption>
							<NativeSelectOption value="published">
								Published
							</NativeSelectOption>
							<NativeSelectOption value="draft">Drafts</NativeSelectOption>
						</NativeSelect>
					</div>

					{editing ? (
						<div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="font-medium text-sm">Review article draft</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Nothing publishes until you choose Published and save.
									</p>
								</div>
								<Button
									onClick={() => setEditing(null)}
									size="sm"
									variant="ghost"
								>
									Close
								</Button>
							</div>
							<div className="mt-4 grid gap-3">
								<Input
									aria-label="Article title"
									onChange={(event) =>
										setEditing({ ...editing, title: event.target.value })
									}
									placeholder="Article title"
									value={editing.title}
								/>
								<Textarea
									aria-label="Article body"
									className="min-h-36"
									onChange={(event) =>
										setEditing({ ...editing, body: event.target.value })
									}
									placeholder="Write the answer in plain language…"
									value={editing.body}
								/>
								<div className="flex flex-wrap items-center justify-between gap-3">
									<NativeSelect
										aria-label="Article status"
										className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
										onChange={(event) =>
											setEditing({
												...editing,
												status: event.target.value as "draft" | "published",
											})
										}
										value={editing.status}
									>
										<NativeSelectOption value="draft">Draft</NativeSelectOption>
										<NativeSelectOption value="published">
											Published
										</NativeSelectOption>
									</NativeSelect>
									<Button
										disabled={busy}
										onClick={() => void saveArticle()}
										size="sm"
									>
										{busy ? "Saving…" : "Save article"}
									</Button>
								</div>
								{error ? (
									<p className="text-destructive text-xs" role="alert">
										{error}
									</p>
								) : null}
							</div>
						</div>
					) : null}

					<div className="grid gap-3 md:grid-cols-2">
						{visibleArticles.map((article) => (
							<ArticleCard
								article={article}
								key={article.id}
								onOpen={() => setEditing(article)}
							/>
						))}
					</div>
					{visibleArticles.length === 0 ? (
						<p className="rounded-2xl border border-border border-dashed p-8 text-center text-muted-foreground text-sm">
							No articles match this view yet.
						</p>
					) : null}
				</div>
			</div>
		</section>
	);
}
