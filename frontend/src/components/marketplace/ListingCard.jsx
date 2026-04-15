import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { buyTree, selectActionInProgress } from "../../store/marketplaceSlice";
import { fetchCredits } from "../../store/creditsSlice";

/**
 * ListingCard - Display a marketplace listing with buy functionality
 * 
 * Props:
 * - listing: { id, treeId, price, description, tree: {...}, seller: {...}, isOwn, ... }
 * - onCancel: function - callback when owner cancels listing
 * - onBuySuccess: function - callback after successful purchase
 */
const ListingCard = ({ listing, onCancel, onBuySuccess }) => {
  const dispatch = useDispatch();
  const actionInProgress = useSelector(selectActionInProgress);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");

  const handleBuy = async () => {
    setBuying(true);
    setBuyError("");
    try {
      await dispatch(buyTree(listing.id)).unwrap();
      // Refresh credits after purchase
      dispatch(fetchCredits());
      setShowBuyConfirm(false);
      if (onBuySuccess) onBuySuccess();
    } catch (err) {
      console.error("Buy failed:", err);
      setBuyError(typeof err === "string" ? err : "Purchase failed. Please try again.");
    } finally {
      setBuying(false);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown";
    return new Date(dateStr).toLocaleDateString();
  };

  // Calculate tree age
  const getTreeAge = () => {
    const plantedAt = listing.tree?.plantedAt;
    if (!plantedAt) return "Unknown";
    const planted = new Date(plantedAt);
    const now = new Date();
    const years = Math.floor((now - planted) / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor(((now - planted) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
    if (years > 0) return `${years}y ${months}m`;
    return `${months} months`;
  };

  // Check if verification is current (within 2 days)
  const isVerificationCurrent = () => {
    const lastVerified = listing.tree?.lastVerifiedAt;
    if (!lastVerified) return false;
    const verificationAge = Date.now() - new Date(lastVerified).getTime();
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    return verificationAge < twoDays;
  };

  const treeName = listing.tree?.name || `Tree #${listing.treeId}`;
  const species = listing.tree?.species || "Unknown Species";
  const price = listing.price || 0;
  const accumulatedCredits = listing.tree?.totalCreditsAccrued || 0;
  const absorptionRate = listing.tree?.absorptionRate || 0;
  const sellerName = listing.seller?.username || "Unknown";
  const isOwn = listing.isOwn;

  return (
    <article className="flex h-full flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 text-xs text-neutral-700 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900" title={treeName}>
            {treeName}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-500">{species}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isOwn ? (
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
              Your Listing
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              For Sale
            </span>
          )}
          {isVerificationCurrent() ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Needs Verification
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-neutral-50 p-2">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Price</p>
          <p className="mt-0.5 text-sm font-bold text-emerald-600">
            {price.toFixed(2)} <span className="text-[10px] font-normal">credits</span>
          </p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Accumulated</p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-800">
            {accumulatedCredits.toFixed(2)} <span className="text-[10px] font-normal">kg CO₂</span>
          </p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Rate</p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-800">
            {absorptionRate.toFixed(1)} <span className="text-[10px] font-normal">kg/year</span>
          </p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Age</p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-800">{getTreeAge()}</p>
        </div>
      </div>

      {/* Seller Info */}
      <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-sm">
          🌳
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-neutral-500">Seller</p>
          <p className="truncate text-[11px] font-medium text-neutral-800" title={sellerName}>
            {sellerName}
          </p>
        </div>
        <p className="text-[10px] text-neutral-400">
          Listed {formatDate(listing.createdAt)}
        </p>
      </div>

      {/* Description */}
      {listing.description && (
        <p className="mt-3 line-clamp-2 text-[11px] italic text-neutral-500">
          "{listing.description}"
        </p>
      )}

      {/* Error message */}
      {buyError && (
        <p className="mt-2 rounded bg-red-50 p-2 text-[11px] text-red-600">{buyError}</p>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex gap-2">
        {isOwn ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={actionInProgress}
            className="flex-1 rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel Listing
          </button>
        ) : showBuyConfirm ? (
          <>
            <button
              type="button"
              onClick={() => {
                setShowBuyConfirm(false);
                setBuyError("");
              }}
              disabled={buying}
              className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBuy}
              disabled={buying || actionInProgress}
              className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {buying ? "Processing..." : "Confirm Purchase"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowBuyConfirm(true)}
            disabled={actionInProgress}
            className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Buy Now ({price.toFixed(2)} credits)
          </button>
        )}
      </div>
    </article>
  );
};

export default ListingCard;
