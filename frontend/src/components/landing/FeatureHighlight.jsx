const features = [
  {
    title: "Own real trees, digitally",
    body: "Every credit is backed by a verifiable tree with traceable ownership, from planting to retirement.",
  },
  {
    title: "Trade credits with confidence",
    body: "List, buy and retire carbon credits with transparent pricing and clear portfolio visibility.",
  },
  {
    title: "Track your emissions",
    body: "Use credits against your carbon footprint and see exactly how much you offset over time.",
  },
];

const FeatureHighlight = () => {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-neutral-950 px-6 py-8 text-white shadow-xl sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">Portfolio snapshot</p>
      <p className="mt-2 text-lg font-semibold">See your trees, credits and emissions in one place.</p>

      <div className="mt-6 grid gap-4 text-xs sm:grid-cols-3">
        <div className="space-y-1 rounded-2xl bg-neutral-900 p-4">
          <p className="text-neutral-400">Owned trees</p>
          <p className="text-2xl font-semibold text-white">128</p>
          <p className="text-neutral-500">spread across 5 projects</p>
        </div>
        <div className="space-y-1 rounded-2xl bg-neutral-900 p-4">
          <p className="text-neutral-400">Available credits</p>
          <p className="text-2xl font-semibold text-emerald-400">620</p>
          <p className="text-neutral-500">ready to trade or retire</p>
        </div>
        <div className="space-y-1 rounded-2xl bg-neutral-900 p-4">
          <p className="text-neutral-400">Emissions covered</p>
          <p className="text-2xl font-semibold text-white">74%</p>
          <p className="text-neutral-500">of this year&apos;s footprint</p>
        </div>
      </div>

      <ul className="mt-8 space-y-3 text-xs text-neutral-300">
        {features.map((feature) => (
          <li key={feature.title} className="flex gap-3">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <div>
              <p className="font-medium text-white">{feature.title}</p>
              <p className="text-neutral-400">{feature.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default FeatureHighlight;
