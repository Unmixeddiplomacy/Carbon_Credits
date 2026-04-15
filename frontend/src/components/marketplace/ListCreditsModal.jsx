import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  listCreditsForSale,
  selectActionInProgress,
  selectActionError,
  selectActionSuccess,
  clearActionMessages,
} from "../../store/marketplaceSlice";
import { selectCreditsSummary } from "../../store/creditsSlice";

/**
 * ListCreditsModal - Modal for listing carbon credits for sale
 *
 * Props:
 * - isOpen: boolean
 * - onClose: function
 * - onSuccess: function
 */
const ListCreditsModal = ({ isOpen, onClose, onSuccess }) => {
  const dispatch = useDispatch();
  const actionInProgress = useSelector(selectActionInProgress);
  const actionError = useSelector(selectActionError);
  const actionSuccess = useSelector(selectActionSuccess);
  const creditsSummary = useSelector(selectCreditsSummary);

  const [amount, setAmount] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [description, setDescription] = useState("");

  const availableBalance = creditsSummary?.availableBalance || 0;

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setPricePerUnit("");
      setDescription("");
      dispatch(clearActionMessages());
    }
  }, [isOpen, dispatch]);

  useEffect(() => {
    if (actionSuccess && isOpen) {
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
        dispatch(clearActionMessages());
      }, 1500);
    }
  }, [actionSuccess, isOpen, onSuccess, onClose, dispatch]);

  const numAmount = parseFloat(amount) || 0;
  const numPrice = parseFloat(pricePerUnit) || 0;
  const totalPrice = numAmount * numPrice;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (numAmount <= 0 || numPrice <= 0) return;

    await dispatch(
      listCreditsForSale({
        amount: numAmount,
        pricePerUnit: numPrice,
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
          <h2 className="text-lg font-semibold text-neutral-900">Sell Carbon Credits</h2>
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

        {/* Balance */}
        <div className="mt-4 rounded-lg bg-emerald-50 p-4">
          <p className="text-xs text-emerald-600">Available Balance</p>
          <p className="text-xl font-bold text-emerald-700">{availableBalance.toFixed(2)} kg CO₂</p>
        </div>

        {/* Error */}
        {actionError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {actionError}
          </div>
        )}

        {/* Success */}
        {actionSuccess && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-600">
            {actionSuccess}
          </div>
        )}

        {/* Form */}
        {!actionSuccess && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="creditAmount" className="block text-sm font-medium text-neutral-700">
                Amount to sell (kg CO₂) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="creditAmount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0.01"
                max={availableBalance}
                step="0.01"
                required
                placeholder="e.g. 10.00"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="pricePerUnit" className="block text-sm font-medium text-neutral-700">
                Price per kg CO₂ ($) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="pricePerUnit"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                min="0.01"
                step="0.01"
                required
                placeholder="e.g. 5.00"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Price Preview */}
            {numAmount > 0 && numPrice > 0 && (
              <div className="rounded-lg bg-neutral-50 p-3">
                <div className="flex justify-between text-xs text-neutral-600">
                  <span>Amount</span>
                  <span className="font-medium">{numAmount.toFixed(2)} kg CO₂</span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-neutral-600">
                  <span>Price per unit</span>
                  <span className="font-medium">${numPrice.toFixed(2)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-sm font-semibold text-neutral-900">
                  <span>Total Listing Price</span>
                  <span className="text-emerald-600">${totalPrice.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="creditDescription" className="block text-sm font-medium text-neutral-700">
                Description (optional)
              </label>
              <textarea
                id="creditDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Add a note for buyers..."
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
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
                disabled={actionInProgress || numAmount <= 0 || numPrice <= 0 || numAmount > availableBalance}
                className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionInProgress ? "Listing..." : "List for Sale"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ListCreditsModal;
