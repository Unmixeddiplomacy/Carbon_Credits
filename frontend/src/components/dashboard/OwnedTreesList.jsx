import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchTrees, selectTreesState } from "../../store/treesSlice";
import { fetchMyListings, selectMyListings, invalidateListings, invalidateTransactions } from "../../store/marketplaceSlice";
import ListTreeModal from "../marketplace/ListTreeModal";

const statusStyles = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  dead: "bg-red-50 text-red-700 border-red-200",
  listed: "bg-blue-50 text-blue-700 border-blue-200",
};

const OwnedTreesList = () => {
  const dispatch = useDispatch();
  const { items, isLoading, error, hasLoaded } = useSelector(selectTreesState);
  const myListings = useSelector(selectMyListings);
  const [selectedTree, setSelectedTree] = useState(null);
  const [showListModal, setShowListModal] = useState(false);

  useEffect(() => {
    if (!hasLoaded && !isLoading) {
      dispatch(fetchTrees());
    }
    dispatch(fetchMyListings());
  }, [dispatch, hasLoaded, isLoading]);

  // Get listing IDs for user's trees
  const listedTreeIds = new Set(myListings.map((l) => l.treeId));

  const handleSellClick = (tree) => {
    setSelectedTree(tree);
    setShowListModal(true);
  };

  const handleListingSuccess = () => {
    dispatch(fetchMyListings());
    dispatch(fetchTrees());
    dispatch(invalidateListings());
    dispatch(invalidateTransactions());
  };

  return (
    <>
      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">My Trees</h2>
          <span className="text-[11px] text-neutral-500">
            {items.length} tree{items.length !== 1 ? "s" : ""} owned
          </span>
        </div>
        <div className="space-y-2 text-xs text-neutral-700">
          {isLoading && (
            <p className="text-[11px] text-neutral-500">Loading trees...</p>
          )}
          {error && !isLoading && (
            <p className="text-[11px] text-red-600">{error}</p>
          )}
          {!isLoading && !error && items.length === 0 && (
            <p className="text-[11px] text-neutral-500">
              No trees found yet. Register a tree to see it here.
            </p>
          )}
          {items.map((t) => {
            const isListed = listedTreeIds.has(t.id);
            const tree = {
              id: t.id,
              name: t.metadata?.name || `Tree #${t.id}`,
              species: t.metadata?.species || "Unknown species",
              creditsPerYear: t.metadata?.absorptionKgPerYear
                ? `${t.metadata.absorptionKgPerYear} kg CO₂ / year`
                : "-",
              carbonAbsorptionKgPerYear: t.metadata?.absorptionKgPerYear || t.carbonAbsorptionKgPerYear || 0,
              totalCreditsAccrued: t.totalCreditsAccrued || 0,
              location: t.metadata?.geo
                ? `${t.metadata.geo.lat}, ${t.metadata.geo.lon}`
                : "-",
              status: isListed ? "listed" : t.status || "pending",
            };
            return (
              <article
                key={tree.id}
                className="flex flex-col items-start justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-[11px] font-semibold text-emerald-700">
                    🌱
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-neutral-900">{tree.name}</p>
                    <p className="text-[11px] text-neutral-500">
                      {tree.species} • {tree.location}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {tree.creditsPerYear} • {tree.totalCreditsAccrued.toFixed(2)} kg accumulated
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      statusStyles[tree.status] || statusStyles.pending
                    }`}
                  >
                    {tree.status === "listed" ? "For Sale" : tree.status.charAt(0).toUpperCase() + tree.status.slice(1)}
                  </span>
                  {tree.status === "active" && !isListed && (
                    <button
                      type="button"
                      onClick={() => handleSellClick(t)}
                      className="rounded-full border border-emerald-500 px-3 py-1 text-[10px] font-semibold text-emerald-600 transition hover:bg-emerald-500 hover:text-white"
                    >
                      Sell
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* List Tree Modal */}
      <ListTreeModal
        isOpen={showListModal}
        onClose={() => setShowListModal(false)}
        tree={selectedTree}
        onSuccess={handleListingSuccess}
      />
    </>
  );
};

export default OwnedTreesList;
