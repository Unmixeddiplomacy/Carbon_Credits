import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import FilterBar from "../../components/marketplace/FilterBar";
import ListingCard from "../../components/marketplace/ListingCard";
import CreditListingCard from "../../components/marketplace/CreditListingCard";
import ListCreditsModal from "../../components/marketplace/ListCreditsModal";
import SectionHeader from "../../components/ui/SectionHeader";
import PageContainer from "../../components/layout/PageContainer";
import {
  fetchListings,
  fetchCreditListings,
  fetchMyCreditListings,
  cancelListing,
  cancelCreditListing,
  selectListings,
  selectListingsLoading,
  selectListingsError,
  selectCreditListings,
  selectCreditListingsLoading,
  selectCreditListingsError,
  selectActionSuccess,
  selectActionError,
  clearActionMessages,
  invalidateListings,
  invalidateTransactions,
} from "../../store/marketplaceSlice";
import { fetchCredits } from "../../store/creditsSlice";
import { fetchTrees } from "../../store/treesSlice";
import { useCreditsInvalidation } from "../../hooks/useCreditsInvalidation";

const MarketplacePage = () => {
  const { invalidateCredits } = useCreditsInvalidation();
  const [activeTab, setActiveTab] = useState("trees");
  const [filters, setFilters] = useState({
    species: "",
    minPrice: "",
    maxPrice: "",
    sortBy: "price",
    sortOrder: "asc",
  });
  const [notification, setNotification] = useState(null);
  const [showListCreditsModal, setShowListCreditsModal] = useState(false);

  const dispatch = useDispatch();

  // Tree listings
  const listings = useSelector(selectListings);
  const isLoading = useSelector(selectListingsLoading);
  const error = useSelector(selectListingsError);
  const listingsHasLoaded = useSelector((state) => state.marketplace.listingsHasLoaded);

  // Credit listings
  const creditListings = useSelector(selectCreditListings);
  const creditListingsLoading = useSelector(selectCreditListingsLoading);
  const creditListingsError = useSelector(selectCreditListingsError);
  const creditListingsHasLoaded = useSelector((state) => state.marketplace.creditListingsHasLoaded);

  const actionSuccess = useSelector(selectActionSuccess);
  const actionError = useSelector(selectActionError);

  // Fetch tree listings
  useEffect(() => {
    if (activeTab === "trees" && !listingsHasLoaded && !isLoading) {
      dispatch(fetchListings(filters));
    }
  }, [dispatch, listingsHasLoaded, isLoading, filters, activeTab]);

  // Fetch credit listings
  useEffect(() => {
    if (activeTab === "credits" && !creditListingsHasLoaded && !creditListingsLoading) {
      dispatch(fetchCreditListings(filters));
    }
  }, [dispatch, creditListingsHasLoaded, creditListingsLoading, filters, activeTab]);

  // Handle action notifications
  useEffect(() => {
    if (actionSuccess) {
      setNotification({ type: "success", message: actionSuccess });
      dispatch(fetchCredits());
      dispatch(fetchTrees());
      dispatch(invalidateListings());
      dispatch(invalidateTransactions());
      invalidateCredits(); // RTK Query cache invalidation
      setTimeout(() => {
        dispatch(clearActionMessages());
        setNotification(null);
      }, 3000);
    }
  }, [actionSuccess, dispatch, invalidateCredits]);

  useEffect(() => {
    if (actionError) {
      setNotification({ type: "error", message: actionError });
      setTimeout(() => {
        dispatch(clearActionMessages());
        setNotification(null);
      }, 5000);
    }
  }, [actionError, dispatch]);

  // Filter tree listings locally for species
  const filteredListings = useMemo(() => {
    let result = [...listings];
    if (filters.species) {
      result = result.filter((l) =>
        l.tree?.species?.toLowerCase().includes(filters.species.toLowerCase())
      );
    }
    return result;
  }, [listings, filters.species]);

  const handleBuySuccess = () => {
    dispatch(invalidateListings());
    if (activeTab === "trees") dispatch(fetchListings(filters));
    else dispatch(fetchCreditListings(filters));
  };

  const handleCancelListing = async (listingId) => {
    if (window.confirm("Are you sure you want to cancel this listing?")) {
      await dispatch(cancelListing(listingId));
      dispatch(invalidateListings());
      dispatch(fetchListings(filters));
    }
  };

  const handleCancelCreditListing = async (listingId) => {
    if (window.confirm("Cancel this credit listing?")) {
      await dispatch(cancelCreditListing(listingId));
      dispatch(invalidateListings());
      dispatch(fetchCreditListings(filters));
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    dispatch(invalidateListings());
  };

  const handleListCreditsSuccess = () => {
    dispatch(invalidateListings());
    dispatch(fetchCredits());
    dispatch(fetchMyCreditListings());
    dispatch(invalidateTransactions());
  };

  const currentLoading = activeTab === "trees" ? isLoading : creditListingsLoading;
  const currentError = activeTab === "trees" ? error : creditListingsError;

  return (
    <PageContainer>
      <div className="flex flex-col gap-8 text-neutral-900">
        <SectionHeader
          eyebrow="Marketplace"
          title="Buy & sell trees and credits"
          description="Browse trees and carbon credits for sale. Trade with verified tree owners."
        />

        {/* Notification */}
        {notification && (
          <div
            className={`rounded-lg p-4 text-sm ${
              notification.type === "success"
                ? "border border-green-200 bg-green-50 text-green-700"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("trees")}
              className={`rounded-full px-5 py-2 text-xs font-semibold transition ${
                activeTab === "trees"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              🌳 Trees
            </button>
            <button
              onClick={() => setActiveTab("credits")}
              className={`rounded-full px-5 py-2 text-xs font-semibold transition ${
                activeTab === "credits"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              💎 Credits
            </button>
          </div>

          {activeTab === "credits" && (
            <button
              onClick={() => setShowListCreditsModal(true)}
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
            >
              + Sell Credits
            </button>
          )}
        </div>

        {activeTab === "trees" && (
          <FilterBar filters={filters} onChange={handleFilterChange} />
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          {activeTab === "trees" ? (
            <span>{filteredListings.length} tree listing{filteredListings.length !== 1 ? "s" : ""} available</span>
          ) : (
            <span>{creditListings.length} credit listing{creditListings.length !== 1 ? "s" : ""} available</span>
          )}
        </div>

        {/* Loading */}
        {currentLoading && (
          <div className="flex items-center justify-center py-12">
            <svg className="h-8 w-8 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Error */}
        {currentError && !currentLoading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {currentError}
          </div>
        )}

        {/* Tree Listings */}
        {activeTab === "trees" && !currentLoading && !currentError && (
          <>
            {filteredListings.length === 0 ? (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
                <span className="text-4xl">🏪</span>
                <p className="mt-3 text-sm text-neutral-600">No trees currently listed for sale.</p>
                <p className="mt-1 text-xs text-neutral-400">Check back later or list your own tree!</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onBuySuccess={handleBuySuccess}
                    onCancel={() => handleCancelListing(listing.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Credit Listings */}
        {activeTab === "credits" && !currentLoading && !currentError && (
          <>
            {creditListings.length === 0 ? (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
                <span className="text-4xl">💎</span>
                <p className="mt-3 text-sm text-neutral-600">No credits currently listed for sale.</p>
                <p className="mt-1 text-xs text-neutral-400">Be the first to sell your carbon credits!</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {creditListings.map((listing) => (
                  <CreditListingCard
                    key={listing.id}
                    listing={listing}
                    onBuySuccess={handleBuySuccess}
                    onCancel={() => handleCancelCreditListing(listing.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <ListCreditsModal
        isOpen={showListCreditsModal}
        onClose={() => setShowListCreditsModal(false)}
        onSuccess={handleListCreditsSuccess}
      />
    </PageContainer>
  );
};

export default MarketplacePage;
