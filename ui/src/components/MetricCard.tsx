export function MetricCard({
	detail,
	title,
	value,
}: {
	detail: string;
	title: string;
	value: string;
}) {
	return (
		<div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
			<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
				{title}
			</p>
			<p className="mt-3 font-medium text-2xl tracking-tight">{value}</p>
			<p className="mt-1 text-muted-foreground text-xs">{detail}</p>
		</div>
	);
}
