const items = [
  {
    title: "You purchased 40 credits from Amazonia Reforestation.",
    time: "2 hours ago",
  },
  {
    title: "10 credits retired against your March emissions.",
    time: "Yesterday",
  },
  {
    title: "3 new trees planted in Karnataka community forest.",
    time: "3 days ago",
  },
];

const RecentActivity = () => {
  return (
    <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Recent transactions</h2>
        <span className="text-[11px] text-neutral-500">Demo data — no live trades</span>
      </div>
      <ul className="space-y-3 text-xs text-neutral-700">
        {items.map((item) => (
          <li key={item.title} className="flex gap-3">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <div>
              <p>{item.title}</p>
              <p className="text-[11px] text-neutral-500">{item.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default RecentActivity;
