import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { buyCreditListing, selectActionInProgress } from "../../store/marketplaceSlice";
import { fetchCredits } from "../../store/creditsSlice";

/**
 * CreditListingCard - Display a credit marketplace listing
 *
 * Props:
 * - listing: { id, amount, remainingAmount, pricePerUnit, totalPrice, description, seller, isOwn, createdAt }
 * - onCancel: function
 * - onBuySuccess: function
 */
const CreditListingCard = ({ listing, onCancel, onBuySuccess }) => {
  const dispatch = useDispatch();
  const actionInProgress = useSelector(selectActionInProgress);
  const [buyAmount, setBuyAmount] = useState("");
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");

  const handleBuy = async () => {
    const amount = parseFloat(buyAmount);
    if (!amount || amount <= 0 || amount > listing.remainingAmount) return;

    setBuying(true);
    setBuyError("");
    try {
      await dispatch(buyCreditListing({ listingId: listing.id, amount })).unwrap();
      dispatch(fetchCredits());
      setShowBuyForm(false);
      setBuyAmount("");
      if (onBuySuccess) onBuySuccess();
    } catch (err) {
      setBuyError(typeof err === "string" ? err : "Purchase failed. Please try again.");
    } finally {
      setBuying(false);
    }
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "Unknown");

  const sellerName = listing.seller?.username || "Unknown";
  const remaining = listing.remainingAmount || 0;
  const pricePerUnit = listing.pricePerUnit || 0;
  const numBuyAmount = parseFloat(buyAmount) || 0;

  return (
    <article className="flex h-full flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 text-xs text-neutral-700 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-lg">
            💎
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">
              {remaining.toFixed(2)} kg CO₂
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500">Carbon Credits</p>
          </div>
        </div>
        {listing.isOwn ? (
          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
            Your Listing
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            For Sale
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-neutral-50 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Price/kg</p>
          <p className="mt-0.5 text-sm font-bold text-emerald-600">
            ${pricePerUnit.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Total Value</p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-800">
            ${(remaining * pricePerUnit).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Seller */}
      <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm">
          👤
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-neutral-500">Seller</p>
          <p className="truncate text-[11px] font-medium text-neutral-800">{sellerName}</p>
        </div>
        <p className="text-[10px] text-neutral-400">Listed {formatDate(listing.createdAt)}</p>
      </div>

      {/* Description */}
      {listing.description && (
        <p className="mt-3 line-clamp-2 text-[11px] italic text-neutral-500">
          "{listing.description}"
        </p>
      )}

      {/* Error */}
      {buyError && (
        <p className="mt-2 rounded bg-red-50 p-2 text-[11px] text-red-600">{buyError}</p>
      )}

      {/* Actions */}
      <div className="mt-4">
        {listing.isOwn ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={actionInProgress}
            className="w-full rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel Listing
          </button>
        ) : showBuyForm ? (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-neutral-600">
                Amount to buy (max: {remaining.toFixed(2)} kg)
              </label>
              <input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                min="0.01"
                max={remaining}
                step="0.01"
                placeholder="Enter amount"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-900 outline-none focus:border-emerald-500"
              />
              {numBuyAmount > 0 && (
                <p className="mt-1 text-[10px] text-neutral-500">
                  Cost: ${(numBuyAmount * pricePerUnit).toFixed(2)}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowBuyForm(false);
                  setBuyError("");
                  setBuyAmount("");
                }}
                disabled={buying}
                className="flex-1 rounded-full border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBuy}
                disabled={buying || actionInProgress || numBuyAmount <= 0 || numBuyAmount > remaining}
                className="flex-1 rounded-full bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {buying ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setBuyAmount(remaining.toFixed(2));
              setShowBuyForm(true);
            }}
            disabled={actionInProgress}
            className="w-full rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Buy Credits
          </button>
        )}
      </div>
    </article>
  );
};

export default CreditListingCard;
