import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { BrowserProvider, Contract } from "ethers";
import {
  fetchEligibleTrees,
  issueCreditsForTree,
  fetchHistory,
  fetchCredits,
  selectEligibleTrees,
  selectEligibleTreesLoading,
  selectIssuingCredits,
  selectIssuingError,
} from "../../store/creditsSlice";
import { fetchTrees } from "../../store/treesSlice";
import { invalidateTransactions } from "../../store/marketplaceSlice";
import useWalletLink from "../../hooks/useWalletLink";
import { useCreditsInvalidation } from "../../hooks/useCreditsInvalidation";
import Button from "../ui/Button";
import Card from "../ui/Card";

// Contract ABIs - load statically, will fail gracefully if not deployed yet
let carbonCreditAbi = null;
let carbonCreditAddress = null;

// Try to load contract artifacts (may not exist until deployed)
const loadContractArtifacts = async () => {
  try {
    const abiModule = await import("../../contracts/CarbonCredit-abi.json");
    const addressModule = await import("../../contracts/CarbonCredit-address.json");
    carbonCreditAbi = abiModule.default;
    carbonCreditAddress = addressModule.default.address;
  } catch {
    // Contract not yet deployed - will use off-chain only
    console.log("CarbonCredit contract not yet deployed");
  }
};

// Load on module initialization
loadContractArtifacts();

const IssueCredits = () => {
  const dispatch = useDispatch();
  const { invalidateAll: invalidateCreditsCache } = useCreditsInvalidation();
  const trees = useSelector(selectEligibleTrees);
  const isLoading = useSelector(selectEligibleTreesLoading);
  const isIssuing = useSelector(selectIssuingCredits);
  const issuingError = useSelector(selectIssuingError);

  const { isLinked, walletAddress, isMetamaskAvailable } = useWalletLink();

  const [selectedTreeId, setSelectedTreeId] = useState(null);
  const [issueMode, setIssueMode] = useState("offchain"); // "offchain" or "onchain"
  const [status, setStatus] = useState("");
  const [localError, setLocalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    dispatch(fetchEligibleTrees());
  }, [dispatch]);

  const eligibleTrees = trees.filter((t) => t.canIssue && t.absorptionKgPerYear > 0);
  const selectedTree = trees.find((t) => t.id === selectedTreeId);

  const handleIssueOffChain = async () => {
    if (!selectedTreeId) return;

    setLocalError("");
    setSuccessMessage("");
    setStatus("Issuing credits...");

    try {
      const result = await dispatch(
        issueCreditsForTree({ treeId: selectedTreeId, txHash: null })
      ).unwrap();

      setSuccessMessage(
        `Successfully issued ${result.issuance.amount} kg CO₂ credits for "${selectedTree?.name}"!`
      );
      setSelectedTreeId(null);
      setStatus("");

      // Refresh all related data (both legacy slice and RTK Query cache)
      dispatch(fetchEligibleTrees());
      dispatch(fetchCredits());
      dispatch(fetchHistory({ limit: 20, offset: 0 }));
      dispatch(fetchTrees());
      dispatch(invalidateTransactions());
      invalidateCreditsCache(); // Trigger RTK Query refetch for all subscribed components
    } catch (err) {
      setLocalError(err || "Failed to issue credits");
      setStatus("");
    }
  };

  const handleIssueOnChain = async () => {
    if (!selectedTreeId || !selectedTree) return;

    if (!selectedTree.isOnChain) {
      setLocalError("Tree must be registered on-chain first to issue on-chain credits.");
      return;
    }

    if (!carbonCreditAbi || !carbonCreditAddress) {
      setLocalError("CarbonCredit contract not deployed. Use off-chain mode.");
      return;
    }

    if (!window.ethereum) {
      setLocalError("MetaMask not found");
      return;
    }

    setLocalError("");
    setSuccessMessage("");
    setStatus("Connecting to wallet...");

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const network = await provider.getNetwork();
      // Import network check from config
      const { isSupportedNetwork, getNetworkErrorMessage } = await import("../../config/networks.js");
      if (!isSupportedNetwork(network.chainId)) {
        setLocalError(getNetworkErrorMessage());
        setStatus("");
        return;
      }

      const signer = await provider.getSigner();
      const signerAddr = await signer.getAddress();

      if (signerAddr.toLowerCase() !== selectedTree.ownerWallet?.toLowerCase()) {
        setLocalError(
          `Wallet mismatch. Tree owned by ${selectedTree.ownerWallet}, but you're connected as ${signerAddr}`
        );
        setStatus("");
        return;
      }

      setStatus("Sending transaction to blockchain...");

      const contract = new Contract(carbonCreditAddress, carbonCreditAbi, signer);
      const tx = await contract.issueCredits(
        selectedTree.chainTreeId,
        Math.floor(selectedTree.absorptionKgPerYear)
      );

      setStatus("Waiting for confirmation...");
      const receipt = await tx.wait();

      // Now record on backend
      setStatus("Recording on backend...");
      const result = await dispatch(
        issueCreditsForTree({ treeId: selectedTreeId, txHash: receipt.hash })
      ).unwrap();

      setSuccessMessage(
        `Successfully issued ${result.issuance.amount} kg CO₂ credits on-chain! Tx: ${receipt.hash.slice(0, 10)}...`
      );
      setSelectedTreeId(null);
      setStatus("");

      // Refresh all related data (both legacy slice and RTK Query cache)
      dispatch(fetchEligibleTrees());
      dispatch(fetchCredits());
      dispatch(fetchHistory({ limit: 20, offset: 0 }));
      dispatch(fetchTrees());
      dispatch(invalidateTransactions());
      invalidateCreditsCache(); // Trigger RTK Query refetch for all subscribed components
    } catch (err) {
      console.error("On-chain issuance error:", err);
      setLocalError(err?.reason || err?.message || "Transaction failed");
      setStatus("");
    }
  };

  const handleIssue = () => {
    if (issueMode === "onchain") {
      handleIssueOnChain();
    } else {
      handleIssueOffChain();
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Issue Carbon Credits</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Issue yearly carbon credits from your registered trees
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-4 text-center text-xs text-neutral-500">Loading trees...</div>
      ) : eligibleTrees.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center text-xs text-neutral-500">
          No trees eligible for credit issuance right now.
          {trees.length > 0 && (
            <span className="block mt-1">
              Credits can be issued once per year per tree.
            </span>
          )}
        </div>
      ) : (
        <>
          {/* Tree Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-700">
              Select a tree to issue credits
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {eligibleTrees.map((tree) => (
                <button
                  key={tree.id}
                  type="button"
                  onClick={() => setSelectedTreeId(tree.id)}
                  className={`rounded-lg border p-3 text-left transition ${
                    selectedTreeId === tree.id
                      ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">🌳</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-neutral-900">
                        {tree.name}
                      </p>
                      <p className="text-[10px] text-neutral-500">{tree.species}</p>
                      <p className="mt-1 text-xs font-medium text-emerald-600">
                        {tree.absorptionKgPerYear} kg CO₂/year
                      </p>
                      <div className="mt-1 flex gap-1">
                        {tree.isOnChain && (
                          <span className="inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">
                            On-chain
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Issue Mode Selection */}
          {selectedTree && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-700">
                Issuance method
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIssueMode("offchain")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs transition ${
                    issueMode === "offchain"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  <span className="font-medium">Off-chain</span>
                  <span className="block text-[10px] text-neutral-500 mt-0.5">
                    Quick, no gas fees
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIssueMode("onchain")}
                  disabled={!selectedTree.isOnChain || !isMetamaskAvailable}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs transition ${
                    issueMode === "onchain"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  } ${
                    !selectedTree.isOnChain || !isMetamaskAvailable
                      ? "cursor-not-allowed opacity-50"
                      : ""
                  }`}
                >
                  <span className="font-medium">On-chain</span>
                  <span className="block text-[10px] text-neutral-500 mt-0.5">
                    {!selectedTree.isOnChain
                      ? "Tree not on-chain"
                      : !isMetamaskAvailable
                      ? "MetaMask required"
                      : "Blockchain verified"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Summary */}
          {selectedTree && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-800">
                <span className="font-medium">Ready to issue:</span>{" "}
                {selectedTree.absorptionKgPerYear} kg CO₂ credits from "{selectedTree.name}"
              </p>
              {selectedTree.totalCreditsIssued > 0 && (
                <p className="mt-1 text-[10px] text-emerald-600">
                  Previously issued: {selectedTree.totalCreditsIssued} kg CO₂
                </p>
              )}
            </div>
          )}

          {/* Status */}
          {status && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
              {status}
            </div>
          )}

          {/* Errors */}
          {(localError || issuingError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {localError || issuingError}
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
              ✓ {successMessage}
            </div>
          )}

          {/* Issue Button */}
          <Button
            onClick={handleIssue}
            disabled={!selectedTreeId || isIssuing || !!status}
            className="w-full"
          >
            {isIssuing || status
              ? "Processing..."
              : selectedTreeId
              ? `Issue ${selectedTree?.absorptionKgPerYear || 0} kg CO₂ Credits`
              : "Select a tree"}
          </Button>
        </>
      )}
    </Card>
  );
};

export default IssueCredits;
