import { useState } from "react";

/**
 * TreeCard - Reusable tree display card
 *
 * Props:
 * - tree: { id, name, species, status, location, plantedAt, absorptionRate, totalCreditsAccrued, chainTreeId, lastVerifiedAt }
 * - isListed: boolean - whether tree is currently listed for sale
 * - onSell: function(tree) - callback when sell button is clicked
 * - compact: boolean - compact mode for grids
 */

const statusStyles = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  dead: "bg-red-50 text-red-700 border-red-200",
  listed: "bg-blue-50 text-blue-700 border-blue-200",
};

const TreeCard = ({ tree, isListed = false, onSell, compact = false }) => {
  const [expanded, setExpanded] = useState(false);

  const name = tree.metadata?.name || tree.name || `Tree #${tree.id}`;
  const species = tree.metadata?.species || tree.species || "Unknown";
  const absorptionRate = tree.metadata?.absorptionKgPerYear || tree.carbonAbsorptionKgPerYear || tree.absorptionRate || 0;
  const totalCredits = tree.totalCreditsAccrued || 0;
  const location = tree.metadata?.geo
    ? `${tree.metadata.geo.lat}, ${tree.metadata.geo.lon}`
    : tree.location || "-";
  const plantedAt = tree.metadata?.plantedAt || tree.plantedAt;
  const status = isListed ? "listed" : tree.status || "pending";
  const chainId = tree.chainTreeId || tree.chain_tree_id;
  const lastVerified = tree.lastVerifiedAt || tree.last_verified_at;

  const getTreeAge = () => {
    if (!plantedAt) return "Unknown";
    const planted = new Date(plantedAt);
    const now = new Date();
    const years = Math.floor((now - planted) / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor(
      ((now - planted) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000)
    );
    if (years > 0) return `${years}y ${months}m`;
    return `${months} months`;
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "N/A");

  return (
    <article className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 text-xs text-neutral-700 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-lg">
            🌳
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-900" title={name}>
              {name}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500">{species}</p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
            statusStyles[status] || statusStyles.pending
          }`}
        >
          {status === "listed" ? "For Sale" : status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-neutral-50 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Credits Accrued</p>
          <p className="mt-0.5 text-sm font-bold text-emerald-600">
            {totalCredits.toFixed(2)} <span className="text-[10px] font-normal">kg CO₂</span>
          </p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Rate</p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-800">
            {parseFloat(absorptionRate).toFixed(1)} <span className="text-[10px] font-normal">kg/year</span>
          </p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Age</p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-800">{getTreeAge()}</p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Location</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-neutral-800" title={location}>
            {location}
          </p>
        </div>
      </div>

      {/* Expandable Details */}
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3 text-[11px] text-neutral-600">
          <div className="flex justify-between">
            <span>Planted</span>
            <span className="font-medium text-neutral-800">{formatDate(plantedAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Last Verified</span>
            <span className="font-medium text-neutral-800">{formatDate(lastVerified)}</span>
          </div>
          {chainId && (
            <div className="flex justify-between">
              <span>Chain ID</span>
              <span className="font-mono font-medium text-neutral-800">#{chainId}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>DB ID</span>
            <span className="font-mono font-medium text-neutral-800">#{tree.id}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 rounded-full border border-neutral-200 px-3 py-2 text-[11px] font-medium text-neutral-600 transition hover:bg-neutral-50"
        >
          {expanded ? "Show Less" : "Details"}
        </button>
        {status === "active" && !isListed && onSell && (
          <button
            type="button"
            onClick={() => onSell(tree)}
            className="flex-1 rounded-full bg-emerald-500 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-emerald-600"
          >
            Sell Tree
          </button>
        )}
        {isListed && (
          <span className="flex-1 rounded-full bg-blue-50 px-3 py-2 text-center text-[11px] font-medium text-blue-600">
            Listed on Market
          </span>
        )}
      </div>
    </article>
  );
};

export default TreeCard;
