const statusStyles = {
  listed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unlisted: "bg-neutral-50 text-neutral-700 border-neutral-200",
};

const TreeCard = ({ tree }) => {
  const isListed = tree.status === "listed";

  return (
    <article className="flex h-full flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 text-xs text-neutral-700 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-neutral-900" title={tree.name}>
            {tree.name}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">
            {tree.species} • {tree.region}
          </p>
          <p className="mt-1 text-[11px] text-neutral-500">{tree.creditsPerYear}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              statusStyles[tree.status]
            }`}
          >
            {isListed ? "Listed" : "Unlisted"}
          </span>
          {isListed && (
            <p className="text-[11px] font-semibold text-emerald-600">
              {tree.price}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-neutral-500">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            🌳
          </span>
          <div className="min-w-0">
            <p className="text-[11px] text-neutral-500">Owner</p>
            <p
              className="truncate text-[11px] font-mono text-neutral-800"
              title={tree.owner}
            >
              {tree.owner}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 self-end sm:self-auto">
          <button
            type="button"
            className="rounded-full border border-neutral-300 px-3 py-1 text-[10px] text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
          >
            View
          </button>
          <button
            type="button"
            className="rounded-full border border-emerald-500 px-3 py-1 text-[10px] font-semibold text-emerald-600 transition hover:bg-emerald-500 hover:text-white"
          >
            {isListed ? "Buy (demo)" : "Favorite"}
          </button>
        </div>
      </div>
    </article>
  );
};

export default TreeCard;
