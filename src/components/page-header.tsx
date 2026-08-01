export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 mb-6 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight break-words leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-sm sm:text-base text-muted-foreground leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="[&>button]:w-full sm:[&>button]:w-auto w-full sm:w-auto">{action}</div>}
    </div>
  );
}
