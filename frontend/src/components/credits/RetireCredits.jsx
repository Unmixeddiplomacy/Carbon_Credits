import { useState } from "react";
import { BrowserProvider, Contract, id } from "ethers";
import { useDispatch, useSelector } from "react-redux";
import {
  retireCredits,
  fetchHistory,
  fetchCredits,
  selectRetiringCredits,
  selectRetiringError,
} from "../../store/creditsSlice";
import { invalidateTransactions } from "../../store/marketplaceSlice";
import { useCreditsInvalidation } from "../../hooks/useCreditsInvalidation";
import { useCreditsData } from "../../hooks/useCreditsPolling";
import useWalletLink from "../../hooks/useWalletLink";
import { isSupportedNetwork, getNetworkErrorMessage } from "../../config/networks";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Card from "../ui/Card";

const parsedScale = Number.parseInt(import.meta.env.VITE_CARBON_CHAIN_UNIT_SCALE || "10000", 10);
const CHAIN_UNIT_SCALE = Number.isFinite(parsedScale) && parsedScale > 0 ? parsedScale : 10000;

let carbonCreditAbi = null;
let carbonCreditAddress = null;

const loadCarbonCreditArtifacts = async () => {
  try {
    const abiModule = await import("../../contracts/CarbonCredit-abi.json");
    const addressModule = await import("../../contracts/CarbonCredit-address.json");
    carbonCreditAbi = abiModule.default;
    carbonCreditAddress = addressModule.default.address;
  } catch {
    console.warn("CarbonCredit contract artifacts not found. Retirement on-chain sync unavailable.");
  }
};

loadCarbonCreditArtifacts();

function toChainUnits(amountKg) {
  const value = Number.parseFloat(String(amountKg ?? ""));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * CHAIN_UNIT_SCALE);
}

const RetireCredits = () => {
  const dispatch = useDispatch();
  const { invalidateCredits, invalidateHistory, invalidateRetirements } = useCreditsInvalidation();
  const { isLinked, walletAddress, isMetamaskAvailable } = useWalletLink();
  
  // Use RTK Query for live credits data with automatic updates
  const { credits: summary } = useCreditsData();
  
  const isRetiring = useSelector(selectRetiringCredits);
  const retiringError = useSelector(selectRetiringError);

  const [form, setForm] = useState({
    amount: "",
    reason: "",
    beneficiaryName: "",
  });
  const [localError, setLocalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [certificate, setCertificate] = useState(null);
  const [status, setStatus] = useState("");

  const availableBalance = summary?.availableBalance ?? 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setLocalError("");
  };

  const handleSetMax = () => {
    setForm((prev) => ({ ...prev, amount: availableBalance.toString() }));
  };

  const validateForm = () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      return "Please enter a valid amount";
    }
    if (amount > availableBalance) {
      return `Insufficient credits. Available: ${availableBalance} kg CO₂`;
    }
    if (!form.reason.trim()) {
      return "Please provide a reason for retirement";
    }
    if (form.reason.trim().length < 10) {
      return "Reason must be at least 10 characters";
    }
    return null;
  };

  const handleRetire = async () => {
    const error = validateForm();
    if (error) {
      setLocalError(error);
      return;
    }

    setLocalError("");
    setSuccessMessage("");
    setCertificate(null);

    try {
      if (!isMetamaskAvailable || !window.ethereum) {
        throw new Error("MetaMask is required to sync retirement on-chain.");
      }
      if (!isLinked || !walletAddress) {
        throw new Error("Link your wallet first to retire credits on-chain.");
      }
      if (!carbonCreditAbi || !carbonCreditAddress) {
        throw new Error("CarbonCredit contract is not configured for this frontend build.");
      }

      setStatus("Submitting retirement to blockchain...");
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const network = await provider.getNetwork();
      if (!isSupportedNetwork(network.chainId)) {
        throw new Error(getNetworkErrorMessage());
      }

      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error(`Wallet mismatch. Linked: ${walletAddress}, connected: ${signerAddress}`);
      }

      const amountUnits = toChainUnits(parseFloat(form.amount));
      if (amountUnits <= 0) {
        throw new Error("Amount is too small for on-chain retirement.");
      }

      const certificateHash = id(
        `retire:${signerAddress}:${form.amount}:${form.reason.trim()}:${Date.now()}`
      );

      const contract = new Contract(carbonCreditAddress, carbonCreditAbi, signer);
      const tx = await contract.retireCredits(amountUnits, form.reason.trim(), certificateHash);

      setStatus("Waiting for blockchain confirmation...");
      const receipt = await tx.wait();

      setStatus("Recording retirement in platform database...");
      const result = await dispatch(
        retireCredits({
          amount: parseFloat(form.amount),
          reason: form.reason.trim(),
          beneficiaryName: form.beneficiaryName.trim() || null,
          txHash: receipt.hash,
        })
      ).unwrap();

      setSuccessMessage(
        `Successfully retired ${result.retirement.amount} kg CO₂ credits!`
      );
      setCertificate(result.retirement);
      setForm({ amount: "", reason: "", beneficiaryName: "" });

      // Refresh related data (both legacy slice and RTK Query cache)
      dispatch(fetchCredits());
      dispatch(fetchHistory({ limit: 20, offset: 0 }));
      dispatch(invalidateTransactions());
      // Invalidate RTK Query cache - triggers auto-refresh for all subscribed components
      invalidateCredits();
      invalidateHistory();
      invalidateRetirements();
      setStatus("");
    } catch (err) {
      setStatus("");
      setLocalError(err?.message || err || "Failed to retire credits");
    }
  };

  const presetReasons = [
    "Personal carbon footprint offset",
    "Business travel emissions offset",
    "Annual emissions neutralization",
    "Event carbon neutrality",
  ];

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Retire Credits</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Permanently burn credits to offset your carbon emissions
        </p>
      </div>

      {/* Available Balance */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        <p className="text-xs text-neutral-500">Available to retire</p>
        <p className="text-xl font-semibold text-neutral-900">
          {availableBalance.toLocaleString()}{" "}
          <span className="text-sm font-normal text-neutral-500">kg CO₂</span>
        </p>
      </div>

      {availableBalance <= 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-700">
          You don't have any credits to retire yet. Issue credits from your trees first.
        </div>
      ) : (
        <>
          {/* Amount Input */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-700">
              Amount to retire (kg CO₂)
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                placeholder="Enter amount"
                min="0"
                max={availableBalance}
                step="0.01"
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleSetMax}>
                Max
              </Button>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-700">
              Reason for retirement *
            </label>
            <textarea
              name="reason"
              value={form.reason}
              onChange={handleChange}
              placeholder="e.g., Offsetting my 2024 personal carbon footprint"
              rows={2}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {presetReasons.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, reason: preset }))}
                  className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] text-neutral-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Beneficiary Name (optional) */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-700">
              Beneficiary name (optional)
            </label>
            <Input
              type="text"
              name="beneficiaryName"
              value={form.beneficiaryName}
              onChange={handleChange}
              placeholder="Name to appear on certificate"
            />
            <p className="text-[10px] text-neutral-500">
              Leave blank to use your account name
            </p>
          </div>

          {/* Errors */}
          {(localError || retiringError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {localError || retiringError}
            </div>
          )}

          {/* On-chain status */}
          {status && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
              {status}
            </div>
          )}

          {/* Success & Certificate */}
          {successMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <p className="text-xs font-medium text-emerald-700">✓ {successMessage}</p>
              {certificate && (
                <div className="mt-2 rounded-lg border border-emerald-300 bg-white p-3">
                  <p className="text-center text-[10px] font-medium uppercase tracking-wider text-emerald-600">
                    Carbon Offset Certificate
                  </p>
                  <p className="mt-2 text-center text-lg font-bold text-neutral-900">
                    {certificate.amount} kg CO₂
                  </p>
                  <p className="mt-1 text-center text-xs text-neutral-500">
                    Certificate #{certificate.certificateNumber}
                  </p>
                  <div className="mt-3 border-t border-neutral-200 pt-3 text-[10px] text-neutral-600">
                    <p>
                      <span className="font-medium">Reason:</span> {certificate.reason}
                    </p>
                    {certificate.beneficiaryName && (
                      <p className="mt-1">
                        <span className="font-medium">Beneficiary:</span>{" "}
                        {certificate.beneficiaryName}
                      </p>
                    )}
                    <p className="mt-1">
                      <span className="font-medium">Date:</span>{" "}
                      {new Date(certificate.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Retire Button */}
          <Button onClick={handleRetire} disabled={isRetiring || !!status} className="w-full">
            {isRetiring ? "Processing..." : "Retire Credits"}
          </Button>

          <p className="text-center text-[10px] text-neutral-500">
            ⚠️ Retirement is permanent and cannot be undone
          </p>
        </>
      )}
    </Card>
  );
};

export default RetireCredits;
