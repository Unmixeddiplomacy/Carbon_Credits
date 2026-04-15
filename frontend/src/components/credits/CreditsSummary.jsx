import { useCreditsPolling } from "../../hooks/useCreditsPolling";

/**
 * CreditsSummary - Displays user's carbon credit stats
 * Uses RTK Query with automatic polling, focus refetch, and visibility refresh
 */
const CreditsSummary = () => {
  // Auto-polling every 30s, refreshes on tab visibility and window focus
  const {
    credits: summary,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useCreditsPolling({
    pollingInterval: 30000,
    refetchOnFocus: true,
    refetchOnVisible: true,
  });

  const cards = [
    {
      label: "Available Credits",
      value: summary?.availableBalance ?? 0,
      unit: "kg CO₂",
      description: "Ready to trade or retire",
      color: "emerald",
    },
    {
      label: "Total Issued",
      value: summary?.totalIssued ?? 0,
      unit: "kg CO₂",
      description: "Credits earned from your trees",
      color: "blue",
    },
    {
      label: "Total Retired",
      value: summary?.totalRetired ?? 0,
      unit: "kg CO₂",
      description: "Permanently offset emissions",
      color: "amber",
    },
    {
      label: "Net Transferred",
      value: (summary?.totalTransferredIn ?? 0) - (summary?.totalTransferredOut ?? 0),
      unit: "kg CO₂",
      description: "Received minus sent",
      color: "violet",
    },
  ];

  const colorStyles = {
    emerald: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
      value: "text-emerald-900",
    },
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      value: "text-blue-900",
    },
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      value: "text-amber-900",
    },
    violet: {
      bg: "bg-violet-50",
      border: "border-violet-200",
      text: "text-violet-700",
      value: "text-violet-900",
    },
  };

  if (isLoading && !summary) {
    return (
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50"
          />
        ))}
      </section>
    );
  }

  if (error && !summary) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <div className="flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={refetch}
            className="ml-4 text-red-800 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Background refresh indicator */}
      {isFetching && summary && (
        <div className="absolute -top-2 right-0 text-xs text-neutral-400 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Syncing...
        </div>
      )}
      {cards.map((card) => {
        const style = colorStyles[card.color];
        return (
          <div
            key={card.label}
            className={`rounded-2xl border ${style.border} ${style.bg} p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]`}
          >
            <p className={`text-xs font-medium ${style.text}`}>{card.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${style.value}`}>
              {card.value.toLocaleString()}{" "}
              <span className="text-sm font-normal opacity-70">{card.unit}</span>
            </p>
            <p className={`mt-1 text-xs ${style.text} opacity-80`}>
              {card.description}
            </p>
          </div>
        );
      })}
    </section>
  );
};

export default CreditsSummary;
