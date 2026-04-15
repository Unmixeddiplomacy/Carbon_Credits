const Stats = () => {
  const stats = [
    { label: "Trees tokenized", value: "12,450+" },
    { label: "tCO₂ offset", value: "38,200" },
    { label: "Active traders", value: "3,100+" },
    { label: "Projects verified", value: "58" },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
        >
          <p className="text-[11px] font-medium text-neutral-500">{item.label}</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">{item.value}</p>
        </div>
      ))}
    </section>
  );
};

export default Stats;
