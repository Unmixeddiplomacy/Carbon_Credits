import { useState } from "react";

/* ─────────── Type config ─────────── */
const typeLabels = {
  tree_purchase: "Tree Purchase Certificate",
  tree_sale: "Tree Sale Certificate",
  credit_purchase: "Credit Purchase Certificate",
  credit_sale: "Credit Sale Certificate",
};

const typeEmoji = {
  tree_purchase: "🌳",
  tree_sale: "🌳",
  credit_purchase: "💎",
  credit_sale: "💎",
};

const typeBadge = {
  tree_purchase: "bg-blue-50 text-blue-700 ring-blue-600/20",
  tree_sale: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  credit_purchase: "bg-violet-50 text-violet-700 ring-violet-600/20",
  credit_sale: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

const mintStatusConfig = {
  minted: { label: "On-Chain", color: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  pending: { label: "Pending", color: "bg-yellow-50 text-yellow-700 ring-yellow-600/20", dot: "bg-yellow-500" },
  failed: { label: "Retry Queued", color: "bg-red-50 text-red-700 ring-red-600/20", dot: "bg-red-500" },
};

/* ─────────── Helpers ─────────── */
const fmt = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const truncHash = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-10)}` : "—");

const explorerUrl = (chainId, txHash) => {
  if (!txHash) return null;
  if (chainId === 11155111) return `https://sepolia.etherscan.io/tx/${txHash}`;
  if (chainId === 1) return `https://etherscan.io/tx/${txHash}`;
  return null;
};

/* ─────────── Component ─────────── */
const NFTCertificate = ({ certificate, onClose }) => {
  const [hashExpanded, setHashExpanded] = useState(false);
  const [txExpanded, setTxExpanded] = useState(false);

  if (!certificate) return null;

  const {
    certificateNumber,
    certificateHash,
    type,
    assetType,
    assetDescription,
    amount,
    currency,
    creditsAmount,
    treeName,
    treeSpecies,
    treeId,
    issuer,
    recipient,
    issuedAt,
    plantedAt,
    pricePerUnit,
    network,
    version,
    // on-chain
    tokenId,
    txHash,
    blockNumber,
    chainId,
    contractAddress,
    mintStatus,
  } = certificate;

  const msConf = mintStatusConfig[mintStatus] || mintStatusConfig.pending;
  const etherscanLink = explorerUrl(chainId, txHash);

  return (
    /* Backdrop — click outside closes, always scrollable */
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-hidden bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Centering wrapper — min-h so short modals center, tall ones scroll */}
      <div className="flex min-h-dvh w-full items-start justify-center px-3 py-4 sm:items-center sm:px-6 sm:py-10">
        <div className="relative flex w-full max-w-md max-h-[calc(100dvh-2rem)] flex-col overflow-hidden animate-[fadeScaleIn_0.2s_ease-out] rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:max-h-[calc(100dvh-5rem)] md:max-w-lg">
          {/* Absolute close button at modal corner */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-1.5 top-1.5 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/30 transition-colors hover:bg-white/25 active:bg-white/40 focus:outline-none focus:ring-2 focus:ring-white/60 sm:right-2 sm:top-2 sm:h-7 sm:w-7"
            aria-label="Close certificate"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* ─── Header ─── */}
          <div className="relative overflow-hidden rounded-t-2xl bg-linear-to-br from-emerald-600 via-emerald-500 to-teal-400 px-5 pb-10 pt-5 sm:px-6 sm:pb-12 sm:pt-6">
            {/* Grid pattern */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]" aria-hidden="true">
              <defs>
                <pattern id="cert-grid-p" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M32 0H0v32" fill="none" stroke="#fff" strokeWidth=".5" />
                </pattern>
              </defs>
              <rect fill="url(#cert-grid-p)" width="100%" height="100%" />
            </svg>


            {/* Title row */}
            <div className="relative flex flex-col gap-2 pr-10 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:pr-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xl leading-none">{typeEmoji[type] || "📜"}</span>
                  <span className="rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                    NFT Certificate
                  </span>
                  {/* Mint status badge */}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${msConf.color}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${msConf.dot}`} />
                    {msConf.label}
                  </span>
                </div>
                <h2 className="mt-2 text-base font-bold leading-tight text-white sm:text-lg">
                  {typeLabels[type] || "Transaction Certificate"}
                </h2>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">Cert #</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-white">{certificateNumber}</p>
              </div>
            </div>

            <p className="relative mt-2 text-xs leading-relaxed text-white/80 sm:text-sm">{assetDescription}</p>
          </div>

          {/* ─── Ticket notch ─── */}
          <div className="relative -mt-4 flex items-center justify-between sm:-mt-5">
            <div className="-ml-3 h-6 w-6 rounded-full bg-black/50" />
            <div className="flex-1 border-b-2 border-dashed border-neutral-200" />
            <div className="-mr-3 h-6 w-6 rounded-full bg-black/50" />
          </div>

          {/* ─── Body (scrolls inside card) ─── */}
          <div className="cert-scroll flex-1 overflow-x-hidden overflow-y-auto overscroll-contain space-y-3 px-5 pb-5 pt-3 sm:space-y-4 sm:px-6 sm:pb-6 sm:pt-4">

            {/* Type + version badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${typeBadge[type] || "bg-neutral-50 text-neutral-600 ring-neutral-500/20"}`}>
                {assetType === "tree" ? "🌲 Tree" : "⚡ Credit"}
              </span>
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-500">
                v{version}
              </span>
              {tokenId && (
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-600/20">
                  Token #{tokenId}
                </span>
              )}
            </div>

            {/* ─ Values grid ─ */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <InfoCard label="Transaction Value">
                <p className="text-base font-bold text-neutral-900 sm:text-lg">
                  ${amount?.toFixed(2)} <span className="text-[11px] font-normal text-neutral-400">{currency}</span>
                </p>
              </InfoCard>

              <InfoCard label={assetType === "tree" ? "Credits Transferred" : "Credits Amount"}>
                <p className="text-base font-bold text-neutral-900 sm:text-lg">
                  {creditsAmount?.toFixed(2) || "0.00"}{" "}
                  <span className="text-[11px] font-normal text-neutral-400">kg CO₂</span>
                </p>
              </InfoCard>

              {pricePerUnit != null && (
                <InfoCard label="Price Per Unit">
                  <p className="text-base font-bold text-neutral-900 sm:text-lg">
                    ${Number(pricePerUnit).toFixed(2)} <span className="text-[11px] font-normal text-neutral-400">/kg</span>
                  </p>
                </InfoCard>
              )}

              {treeName && (
                <InfoCard label="Tree">
                  <p className="text-sm font-bold text-neutral-900">{treeName}</p>
                  <p className="text-[11px] text-neutral-500">{treeSpecies} · #{treeId}</p>
                </InfoCard>
              )}
            </div>

            {plantedAt && (
              <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span>🌱</span> Planted {fmt(plantedAt)}
              </p>
            )}

            {/* ─ Parties ─ */}
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-100 bg-neutral-50/50 p-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  {type?.includes("purchase") ? "Seller" : "Buyer"}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-neutral-900">{issuer?.username || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  {type?.includes("purchase") ? "Buyer" : "Seller"}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-neutral-900">{recipient?.username || "—"}</p>
              </div>
            </div>

            {/* ─ Date & Network ─ */}
            <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/50 p-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Issued</p>
                <p className="mt-0.5 text-xs font-medium text-neutral-700">{fmt(issuedAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Network</p>
                <p className="mt-0.5 text-xs font-medium text-neutral-700">{network}</p>
              </div>
            </div>

            {/* ─ On-chain proof ─ */}
            {(txHash || tokenId) && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-500">
                    🔗 On-Chain Proof
                  </p>
                  {etherscanLink && (
                    <a
                      href={etherscanLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-indigo-600 underline decoration-indigo-300 hover:text-indigo-700"
                    >
                      View on Etherscan ↗
                    </a>
                  )}
                </div>

                <div className="mt-2 space-y-1 text-xs">
                  {tokenId && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-500">Token ID</span>
                      <span className="font-semibold text-neutral-900">#{tokenId}</span>
                    </div>
                  )}
                  {blockNumber && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-500">Block</span>
                      <span className="font-semibold text-neutral-900">{blockNumber.toLocaleString()}</span>
                    </div>
                  )}
                  {contractAddress && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="shrink-0 font-medium text-neutral-500">Contract</span>
                      <span className="truncate font-mono text-[11px] text-neutral-700">{truncHash(contractAddress)}</span>
                    </div>
                  )}
                </div>

                {txHash && (
                  <div className="mt-2">
                    <button
                      onClick={() => setTxExpanded(!txExpanded)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Tx Hash: {txExpanded ? "Hide" : "Show"}
                    </button>
                    {txExpanded && (
                      <p className="mt-1 break-all rounded-lg bg-white/60 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-neutral-600">
                        {txHash}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─ Integrity hash ─ */}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  Integrity Hash (SHA-256)
                </p>
                <button
                  onClick={() => setHashExpanded(!hashExpanded)}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  {hashExpanded ? "Hide" : "Show"}
                </button>
              </div>
              <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-neutral-600">
                {hashExpanded ? certificateHash : truncHash(certificateHash)}
              </p>
            </div>

            {/* ─ Footer ─ */}
            <div className="border-t border-neutral-100 pt-3">
              <p className="text-center text-[10px] leading-relaxed text-neutral-400">
                This certificate is a tamper-evident{mintStatus === "minted" ? ", on-chain verified" : ""}{" "}
                digital record issued by the CarbonCredit Platform.{" "}
                {mintStatus === "minted"
                  ? "The NFT is soul-bound (non-transferable) and permanently recorded on the blockchain."
                  : "The integrity hash can verify that no fields have been modified since issuance."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Small reusable card ─── */
const InfoCard = ({ label, children }) => (
  <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-3">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{label}</p>
    <div className="mt-1">{children}</div>
  </div>
);

export default NFTCertificate;
