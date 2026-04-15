import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  listTreeForSale,
  checkListingEligibility,
  selectEligibilityCache,
  selectActionInProgress,
  selectActionError,
  selectActionSuccess,
  clearActionMessages,
} from "../../store/marketplaceSlice";

/**
 * ListTreeModal - Modal for listing a tree for sale on the marketplace
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: function
 * - tree: { id, name, species, totalCreditsAccrued, carbonAbsorptionKgPerYear, ... }
 * - onSuccess: function - callback after successful listing
 */
const ListTreeModal = ({ isOpen, onClose, tree, onSuccess }) => {
  const dispatch = useDispatch();
  const eligibilityCache = useSelector(selectEligibilityCache);
  const actionInProgress = useSelector(selectActionInProgress);
  const actionError = useSelector(selectActionError);
  const actionSuccess = useSelector(selectActionSuccess);

  const [priceCredits, setPriceCredits] = useState("");
  const [description, setDescription] = useState("");
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  // Check eligibility when modal opens
  useEffect(() => {
    if (isOpen && tree?.id) {
      setCheckingEligibility(true);
      dispatch(checkListingEligibility(tree.id)).finally(() => {
        setCheckingEligibility(false);
      });
      // Clear any previous messages
      dispatch(clearActionMessages());
    }
  }, [isOpen, tree?.id, dispatch]);

  // Handle successful listing
  useEffect(() => {
    if (actionSuccess && isOpen) {
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
        dispatch(clearActionMessages());
      }, 1500);
    }
  }, [actionSuccess, isOpen, onSuccess, onClose, dispatch]);

  const eligibility = tree?.id ? eligibilityCache[tree.id] : null;
  const isEligible = eligibility?.eligible === true;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tree?.id || !priceCredits || parseFloat(priceCredits) <= 0) return;

    await dispatch(
      listTreeForSale({
        treeId: tree.id,
        priceCredits: parseFloat(priceCredits),
        description: description.trim() || undefined,
      })
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <h2 className="text-lg font-semibold text-neutral-900">List Tree for Sale</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tree Info */}
        <div className="mt-4 rounded-lg bg-neutral-50 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-lg">
              🌳
            </span>
            <div>
              <p className="font-semibold text-neutral-900">
                {tree?.metadata?.name || tree?.name || `Tree #${tree?.id}`}
              </p>
              <p className="text-xs text-neutral-500">
                {tree?.metadata?.species || tree?.species || "Unknown Species"}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-neutral-500">Accumulated Credits</p>
              <p className="font-semibold text-neutral-800">
                {(tree?.totalCreditsAccrued || 0).toFixed(2)} kg CO₂
              </p>
            </div>
            <div>
              <p className="text-neutral-500">Absorption Rate</p>
              <p className="font-semibold text-neutral-800">
                {(tree?.metadata?.absorptionKgPerYear || tree?.carbonAbsorptionKgPerYear || 0).toFixed(1)} kg/year
              </p>
            </div>
          </div>
        </div>

        {/* Eligibility Check */}
        {checkingEligibility ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-neutral-50 p-4">
            <svg className="h-5 w-5 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-neutral-600">Checking eligibility...</span>
          </div>
        ) : eligibility && !isEligible ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-red-700">Not Eligible for Listing</p>
                {eligibility.issues?.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-sm text-red-600">
                    {eligibility.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}
                {eligibility.tree?.lastVerifiedAt && (
                  <p className="mt-2 text-xs text-red-500">
                    Last verified: {new Date(eligibility.tree.lastVerifiedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : isEligible ? (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold text-green-700">Eligible for Listing</span>
            </div>
          </div>
        ) : null}

        {/* Error Message */}
        {actionError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {actionError}
          </div>
        )}

        {/* Success Message */}
        {actionSuccess && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-600">
            {actionSuccess}
          </div>
        )}

        {/* Form */}
        {isEligible && !actionSuccess && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="priceCredits" className="block text-sm font-medium text-neutral-700">
                Price (in credits) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="priceCredits"
                value={priceCredits}
                onChange={(e) => setPriceCredits(e.target.value)}
                min="0.01"
                step="0.01"
                required
                placeholder="Enter price in carbon credits"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Buyer will pay this amount in carbon credits to purchase your tree.
              </p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-neutral-700">
                Description (optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Add details about your tree..."
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Info about credits transfer */}
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              <p className="font-semibold">Important:</p>
              <ul className="mt-1 list-inside list-disc space-y-1">
                <li>All accumulated credits ({(tree?.totalCreditsAccrued || 0).toFixed(2)} kg CO₂) will transfer to the buyer</li>
                <li>Ownership and future credit earnings will transfer to the buyer</li>
                <li>This action cannot be undone once sold</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={actionInProgress}
                className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionInProgress || !priceCredits || parseFloat(priceCredits) <= 0}
                className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionInProgress ? "Listing..." : "List for Sale"}
              </button>
            </div>
          </form>
        )}

        {/* Close button if not eligible */}
        {!isEligible && !checkingEligibility && (
          <div className="mt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListTreeModal;
