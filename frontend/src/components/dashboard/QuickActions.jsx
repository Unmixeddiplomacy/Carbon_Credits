const actions = [
  {
    label: "Mint tree",
    description: "Simulate adding a new tree to your wallet.",
    primary: true,
  },
  {
    label: "List a tree",
    description: "Demo flow to list a tree on the market.",
  },
  {
    label: "Retire credits",
    description: "Burn credits against a sample emission event.",
  },
  {
    label: "Issue (admin)",
    description: "Static admin-only issuance control.",
  },
];

const QuickActions = () => {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">Quick actions</h2>
        <span className="text-[11px] text-neutral-500">Demo only — no live actions</span>
      </div>
      <div className="mt-3 grid gap-3 text-xs text-neutral-700 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left transition ${
              action.primary
                ? "border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10"
                : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
            }`}
          >
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                action.primary ? "text-emerald-600" : "text-neutral-700"
              }`}
            >
              {action.label}
            </span>
            <span className="text-[11px] text-neutral-500">{action.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default QuickActions;
