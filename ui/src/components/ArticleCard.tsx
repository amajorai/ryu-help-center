import { ArrowUpRight01Icon, File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@ryu/ui/components/badge.tsx";
import { Button } from "@ryu/ui/components/button.tsx";
import type { ArticleDocument } from "../types.ts";

export function ArticleCard({
	article,
	onOpen,
}: {
	article: ArticleDocument;
	onOpen: () => void;
}) {
	return (
		<article className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
			<div className="flex items-start gap-3">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<HugeiconsIcon aria-hidden="true" icon={File01Icon} />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="font-medium text-sm">{article.title}</h3>
						<Badge
							variant={article.status === "published" ? "secondary" : "outline"}
						>
							{article.status === "published" ? "Published" : "Draft"}
						</Badge>
					</div>
					<p className="mt-1 line-clamp-2 text-muted-foreground text-xs leading-relaxed">
						{article.body}
					</p>
				</div>
			</div>
			<div className="flex items-center justify-between gap-3 border-border/60 border-t pt-3">
				<span className="text-muted-foreground text-xs">
					Used {article.usageCount} times ·{" "}
					{article.tags.slice(0, 2).join(" · ") || "No tags"}
				</span>
				<Button onClick={onOpen} size="sm" variant="ghost">
					Edit
					<HugeiconsIcon aria-hidden="true" icon={ArrowUpRight01Icon} />
				</Button>
			</div>
		</article>
	);
}
