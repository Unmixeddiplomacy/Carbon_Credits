import { useMemo, useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import apiClient from "../../api/client";
import useWalletLink from "../../hooks/useWalletLink";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import SectionHeader from "../ui/SectionHeader";
import treeRegistryAbi from "../../contracts/TreeRegistry-abi.json";
import treeRegistryAddress from "../../contracts/TreeRegistry-address.json";

const initialForm = {
  name: "",
  species: "",
  plantedAt: "",
  absorptionKgPerYear: "",
};

const RegisterTree = () => {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});

  const CONTRACT_ADDRESS = treeRegistryAddress.address;

  const { walletAddress, truncatedAddress, isLinked, isMetamaskAvailable, connectWallet } =
    useWalletLink();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // live-validate the single field on change
    setErrors((prev) => {
      const next = { ...prev };
      const msg = validateField(name, value, { ...form, [name]: value });
      if (msg) next[name] = msg; else delete next[name];
      return next;
    });
  };

  const todayISO = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  function isNumberLike(v) {
    if (v === null || v === undefined || v === "") return false;
    return !Number.isNaN(Number(v));
  }

  function validateField(name, value, state) {
    switch (name) {
      case "name": {
        const v = (value || "").trim();
        if (!v) return "Name is required";
        if (v.length < 2) return "Name must be at least 2 characters";
        if (v.length > 80) return "Name must be at most 80 characters";
        return "";
      }
      case "species": {
        const v = (value || "").trim();
        if (!v) return "Species is required";
        if (v.length < 2) return "Species must be at least 2 characters";
        if (v.length > 80) return "Species must be at most 80 characters";
        return "";
      }
      case "plantedAt": {
        const v = (value || "").trim();
        if (!v) return "Planted date is required";
        // Expect yyyy-mm-dd
        const time = Date.parse(v);
        if (Number.isNaN(time)) return "Invalid date";
        if (v > todayISO) return "Planted date cannot be in the future";
        // Optional: prevent unrealistic ancient dates
        if (v < "1900-01-01") return "Planted date seems too early";
        return "";
      }
      case "absorptionKgPerYear": {
        if (!isNumberLike(value)) return "Absorption must be a number";
        const n = Number(value);
        if (n < 0) return "Absorption cannot be negative";
        if (n > 100000) return "Absorption seems too large";
        return "";
      }
      default:
        return "";
    }
  }

  function validateAll(state) {
    const fields = Object.keys(state);
    const next = {};
    for (const f of fields) {
      const msg = validateField(f, state[f], state);
      if (msg) next[f] = msg;
    }
    return next;
  }

  const createMetadata = async () => {
    setStatus("Creating metadata on backend...");

    const payload = {
      name: form.name,
      species: form.species,
      plantedAt: form.plantedAt,
      absorptionKgPerYear: Number(form.absorptionKgPerYear) || 0,
    };

    const metaRes = await apiClient.post("/trees/create-metadata", payload);
    if (!metaRes.data) {
      throw new Error("Backend did not return metadata response");
    }
    const { dbId, metadataURI } = metaRes.data;
    if (!dbId || !metadataURI) {
      throw new Error("Backend did not return dbId/metadataURI");
    }
    return { dbId, metadataURI };
  };

  const registerOnChain = async (metadataURI) => {
    setStatus("Connecting wallet and sending transaction...");

    if (!window.ethereum) {
      throw new Error("MetaMask not found");
    }

    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);

    const network = await provider.getNetwork();
    // Import network check from config
    const { isSupportedNetwork, getNetworkErrorMessage } = await import("../../config/networks.js");
    if (network && !isSupportedNetwork(network.chainId)) {
      throw new Error(getNetworkErrorMessage());
    }

    const signer = await provider.getSigner();
    const signerAddr = await signer.getAddress();

    const contract = new Contract(CONTRACT_ADDRESS, treeRegistryAbi, signer);

    const tx = await contract.registerTree(metadataURI);
    setStatus("Waiting for transaction confirmation...");
    const receipt = await tx.wait();

    // Parse TreeRegistered event to get treeId
    let treeId = null;
    for (const log of receipt.logs || []) {
      if (log.address && log.address.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
        continue;
      }
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics,
          data: log.data,
        });
        if (parsed && parsed.name === "TreeRegistered") {
          treeId = parsed.args.treeId.toString();
          break;
        }
      } catch {
        // ignore logs that don't match this contract's events
      }
    }

    // Fallback: if event parsing fails but contract call works, use nextTreeId() - 1
    if (treeId === null) {
      try {
        const nextId = await contract.nextTreeId();
        const lastId = nextId - 1n;
        if (lastId >= 0n) {
          treeId = lastId.toString();
        }
      } catch (e) {
        console.warn("Fallback nextTreeId() call failed", e);
      }
    }

    if (treeId === null) {
      console.warn("Could not find TreeRegistered event or derive id", receipt.logs);
      throw new Error("Could not determine registered tree id from the transaction.");
    }

    return { treeId, txHash: tx.hash, owner: signerAddr };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");
    // Validate form
    const v = validateAll(form);
    setErrors(v);
    if (Object.keys(v).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }

    if (!isMetamaskAvailable) {
      setError("MetaMask is not available in this browser.");
      return;
    }

    if (!isLinked) {
      setError("Please link your wallet first.");
      return;
    }

    try {
      setIsSubmitting(true);
      const { dbId, metadataURI } = await createMetadata();

      const { treeId, txHash, owner } = await registerOnChain(metadataURI);

      // 3) Notify backend to bind on-chain tree to DB row
      setStatus("Updating backend with on-chain tree id...");
      await apiClient.post("/trees/register-callback", {
        dbId,
        chainTreeId: Number(treeId),
        ownerAddress: owner,
      });

      setResult({
        dbId,
        chainTreeId: Number(treeId),
        owner,
        txHash,
      });
      setStatus("Tree successfully registered.");
      setForm(initialForm);
      setErrors({});
    } catch (err) {
      console.error("Register tree error", err);
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Unable to register tree. Please try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mt-4">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          eyebrow="On-chain trees"
          title="Register a new tree"
          description="Create rich metadata for a real-world tree and register it on the TreeRegistry smart contract."
          className="max-w-lg"
        />
        <div className="flex flex-col items-end gap-2 text-right text-xs text-neutral-500">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-600">
            Wallet status
          </span>
          {walletAddress ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
              Linked: {truncatedAddress}
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={connectWallet}
              className="text-xs"
            >
              Link wallet with MetaMask
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Input
            id="tree-name"
            name="name"
            label="Tree name"
            placeholder="E.g. Oak #12 in north plot"
            value={form.name}
            onChange={handleChange}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "tree-name-error" : undefined}
            className={errors.name ? "border-red-500 focus:border-red-600" : ""}
          />
          {errors.name && (
            <p id="tree-name-error" className="text-[11px] text-red-600">
              {errors.name}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Input
            id="tree-species"
            name="species"
            label="Species"
            placeholder="Quercus robur"
            value={form.species}
            onChange={handleChange}
            aria-invalid={Boolean(errors.species)}
            aria-describedby={errors.species ? "tree-species-error" : undefined}
            className={errors.species ? "border-red-500 focus:border-red-600" : ""}
          />
          {errors.species && (
            <p id="tree-species-error" className="text-[11px] text-red-600">
              {errors.species}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Input
            id="tree-plantedAt"
            name="plantedAt"
            label="Planted at"
            type="date"
            max={todayISO}
            value={form.plantedAt}
            onChange={handleChange}
            aria-invalid={Boolean(errors.plantedAt)}
            aria-describedby={errors.plantedAt ? "tree-plantedAt-error" : undefined}
            className={errors.plantedAt ? "border-red-500 focus:border-red-600" : ""}
          />
          {errors.plantedAt && (
            <p id="tree-plantedAt-error" className="text-[11px] text-red-600">
              {errors.plantedAt}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Input
            id="tree-absorption"
            name="absorptionKgPerYear"
            label="Estimated CO₂ absorption (kg/year)"
            placeholder="E.g. 21"
            value={form.absorptionKgPerYear}
            onChange={handleChange}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            max="100000"
            aria-invalid={Boolean(errors.absorptionKgPerYear)}
            aria-describedby={errors.absorptionKgPerYear ? "tree-absorption-error" : undefined}
            className={errors.absorptionKgPerYear ? "border-red-500 focus:border-red-600" : ""}
          />
          {errors.absorptionKgPerYear && (
            <p id="tree-absorption-error" className="text-[11px] text-red-600">
              {errors.absorptionKgPerYear}
            </p>
          )}
        </div>

        <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
          <div className="space-y-1 text-xs">
            {status && <p className="text-emerald-700">{status}</p>}
            {error && <p className="text-red-600">{error}</p>}
            {!status && !error && (
              <p className="text-neutral-500">
                This flow will call your authenticated backend first, then send a transaction from
                your linked wallet, and finally bind the on-chain tree to your account.
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={isSubmitting || !isLinked}
            className="whitespace-nowrap"
          >
            {isSubmitting ? "Registering tree..." : !isLinked ? "Link wallet to continue" : "Register tree"}
          </Button>
        </div>

        {result && (
          <div className="md:col-span-2 mt-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm">
            <p className="font-semibold text-emerald-800 flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              Tree Registered Successfully
            </p>
            <div className="mt-2 text-emerald-700 space-y-1 text-xs">
              <p>Database ID: {result.dbId}</p>
              <p>On-chain Tree ID: {result.chainTreeId}</p>
              <p className="truncate">Tx: {result.txHash}</p>
            </div>
            
            <div className="mt-3 pt-3 border-t border-emerald-200">
              <p className="text-amber-700 font-medium text-sm">⚠️ Verification Required</p>
              <p className="text-neutral-600 text-xs mt-1">
                Your tree is registered but <strong>pending verification</strong>. 
                It won't earn credits until you verify it with a photo and GPS location.
              </p>
              <button
                type="button"
                onClick={() => window.location.href = "/verification"}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                Go to Verification Page →
              </button>
            </div>
          </div>
        )}
      </form>
    </Card>
  );
};

export default RegisterTree;
