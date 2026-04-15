const TrustBar = () => {
  const items = [
    "Verified projects",
    "Transparent ownership",
    "Secure trading",
    "Emission tracking",
  ];

  return (
    <section className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[11px] text-neutral-600">
      {items.map((item) => (
        <span key={item} className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {item}
        </span>
      ))}
    </section>
  );
};

export default TrustBar;
