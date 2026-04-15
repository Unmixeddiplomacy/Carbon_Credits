const projects = [
  {
    name: "Sundarbans Mangrove Shield",
    region: "India",
    price: "$14.60 / tCO₂",
  },
  {
    name: "Andes High-Altitude Forests",
    region: "Peru",
    price: "$18.20 / tCO₂",
  },
  {
    name: "Community Fruit Forests",
    region: "Kenya",
    price: "$11.90 / tCO₂",
  },
];

const MarketPreview = () => {
  return (
    <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Marketplace preview</h2>
        <span className="text-[11px] text-neutral-500">Exploration only — no live orders</span>
      </div>
      <div className="space-y-2 text-xs text-neutral-700">
        {projects.map((project) => (
          <div
            key={project.name}
            className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2"
          >
            <div>
              <p className="font-medium text-neutral-900">{project.name}</p>
              <p className="text-[11px] text-neutral-500">{project.region}</p>
            </div>
            <p className="text-[11px] font-semibold text-emerald-600">
              {project.price}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default MarketPreview;
