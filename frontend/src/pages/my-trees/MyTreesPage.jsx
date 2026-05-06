import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { fetchTrees, selectTreesState } from "../../store/treesSlice";
import { fetchMyListings, selectMyListings, invalidateTransactions, invalidateListings } from "../../store/marketplaceSlice";
import TreeCard from "../../components/trees/TreeCard";
import ListTreeModal from "../../components/marketplace/ListTreeModal";
import PageContainer from "../../components/layout/PageContainer";
import SectionHeader from "../../components/ui/SectionHeader";

const MyTreesPage = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { items, isLoading, error } = useSelector(selectTreesState);
  const myListings = useSelector(selectMyListings);
  const [selectedTree, setSelectedTree] = useState(null);
  const [showListModal, setShowListModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedTreeId, setExpandedTreeId] = useState(null);

  // Re-fetch on every navigation to this page
  useEffect(() => {
    dispatch(fetchTrees());
    dispatch(fetchMyListings());
  }, [dispatch, location.key]);

  const listedTreeIds = new Set(
    myListings.filter((l) => l.status === "active").map((l) => l.treeId)
  );

  const handleSell = (tree) => {
    setSelectedTree(tree);
    setShowListModal(true);
  };

  const handleListingSuccess = () => {
    dispatch(fetchMyListings());
    dispatch(fetchTrees());
    dispatch(invalidateListings());
    dispatch(invalidateTransactions());
  };

  const handleToggleDetails = (tree) => {
    setExpandedTreeId((prev) => (prev === tree.id ? null : tree.id));
  };

  const filteredTrees = items.filter((t) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "listed") return listedTreeIds.has(t.id);
    if (statusFilter === "active") return t.status === "active" && !listedTreeIds.has(t.id);
    return t.status === statusFilter;
  });

  const counts = {
    all: items.length,
    active: items.filter((t) => t.status === "active" && !listedTreeIds.has(t.id)).length,
    listed: listedTreeIds.size,
    pending: items.filter((t) => t.status === "pending").length,
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <SectionHeader
          eyebrow="My Trees"
          title="Your registered trees"
          description="View and manage all your trees. Sell them on the marketplace or track their credit earnings."
        />

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "listed", label: "For Sale" },
            { key: "pending", label: "Pending" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                statusFilter === tab.key
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {tab.label} ({counts[tab.key] || 0})
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <svg className="h-8 w-8 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredTrees.length === 0 && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
            <span className="text-4xl">🌱</span>
            <p className="mt-3 text-sm text-neutral-600">
              {statusFilter === "all"
                ? "You haven't registered any trees yet."
                : `No ${statusFilter} trees found.`}
            </p>
            {statusFilter === "all" && (
              <p className="mt-1 text-xs text-neutral-400">
                Register a tree from the dashboard to get started!
              </p>
            )}
          </div>
        )}

        {/* Tree Grid */}
        {!isLoading && !error && filteredTrees.length > 0 && (
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTrees.map((tree) => (
              <TreeCard
                key={tree.id}
                tree={tree}
                isListed={listedTreeIds.has(tree.id)}
                onSell={handleSell}
                expanded={expandedTreeId === tree.id}
                onToggleExpand={handleToggleDetails}
              />
            ))}
          </div>
        )}
      </div>

      {/* List Tree Modal */}
      <ListTreeModal
        isOpen={showListModal}
        onClose={() => setShowListModal(false)}
        tree={selectedTree}
        onSuccess={handleListingSuccess}
      />
    </PageContainer>
  );
};

export default MyTreesPage;
