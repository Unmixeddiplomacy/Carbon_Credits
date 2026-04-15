import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import {
  fetchTransactions,
  fetchCertificate,
  clearCertificate,
  selectTransactions,
  selectTransactionsLoading,
  selectTransactionsError,
  selectTransactionsPagination,
  selectActiveCertificate,
  selectCertificateLoading,
} from "../../store/marketplaceSlice";
import PageContainer from "../../components/layout/PageContainer";
import SectionHeader from "../../components/ui/SectionHeader";
import NFTCertificate from "../../components/certificates/NFTCertificate";

const typeConfig = {
  tree_purchase: { label: "Tree Purchase", icon: "🌳", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
  tree_sale: { label: "Tree Sale", icon: "🌳", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  credit_purchase: { label: "Credit Purchase", icon: "💎", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
  credit_sale: { label: "Credit Sale", icon: "💎", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  credit_transfer_out: { label: "Transfer Sent", icon: "📤", color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200" },
  credit_transfer_in: { label: "Transfer Received", icon: "📥", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
};

const typeFilterOptions = [
  { key: "all", label: "All" },
  { key: "tree_purchase", label: "Tree Purchases" },
  { key: "tree_sale", label: "Tree Sales" },
  { key: "credit_purchase", label: "Credit Purchases" },
  { key: "credit_sale", label: "Credit Sales" },
  { key: "transfer", label: "Transfers" },
];

const TransactionsPage = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const transactions = useSelector(selectTransactions);
  const isLoading = useSelector(selectTransactionsLoading);
  const error = useSelector(selectTransactionsError);
  const pagination = useSelector(selectTransactionsPagination);
  const activeCertificate = useSelector(selectActiveCertificate);
  const certificateLoading = useSelector(selectCertificateLoading);
  const [typeFilter, setTypeFilter] = useState("all");

  // Re-fetch on every navigation to this page
  useEffect(() => {
    dispatch(fetchTransactions({ limit: 100, offset: 0 }));
  }, [dispatch, location.key]);

  const handleViewCertificate = (certNumber) => {
    if (certNumber) {
      dispatch(fetchCertificate(certNumber));
    }
  };

  const handleCloseCertificate = () => {
    dispatch(clearCertificate());
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (typeFilter === "all") return true;
    if (typeFilter === "transfer") return tx.type.startsWith("credit_transfer");
    return tx.type === typeFilter;
  });

  const formatDate = (d) => {
    if (!d) return "-";
    const date = new Date(d);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isIncoming = (type) =>
    ["tree_sale", "credit_sale", "credit_transfer_in"].includes(type);

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <SectionHeader
          eyebrow="Transactions"
          title="Your transaction history"
          description="View all your tree purchases, sales, credit trades, and transfers in one place."
        />

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {typeFilterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setTypeFilter(opt.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                typeFilter === opt.key
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="text-xs text-neutral-500">
          {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
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
        {!isLoading && !error && filteredTransactions.length === 0 && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
            <span className="text-4xl">📋</span>
            <p className="mt-3 text-sm text-neutral-600">No transactions found.</p>
            <p className="mt-1 text-xs text-neutral-400">
              Your marketplace activity will appear here.
            </p>
          </div>
        )}

        {/* Transaction List */}
        {!isLoading && !error && filteredTransactions.length > 0 && (
          <div className="space-y-3">
            {filteredTransactions.map((tx) => {
              const config = typeConfig[tx.type] || typeConfig.credit_transfer_out;
              const incoming = isIncoming(tx.type);

              return (
                <article
                  key={`${tx.type}-${tx.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-lg">
                      {config.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-900">{tx.description}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.bgColor} ${config.color}`}>
                          {config.label}
                        </span>
                        {tx.counterparty && (
                          <span>
                            {incoming ? "From" : "To"}: <span className="font-medium text-neutral-700">{tx.counterparty}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:text-right">
                    <div>
                      <p className={`text-sm font-bold ${incoming ? "text-emerald-600" : "text-neutral-800"}`}>
                        {incoming ? "+" : "-"}${tx.amount?.toFixed(2) || "0.00"}
                      </p>
                      {tx.creditsTransferred > 0 && (
                        <p className="text-[10px] text-neutral-500">
                          {tx.creditsTransferred.toFixed(2)} kg CO₂
                        </p>
                      )}
                      {tx.creditsAmount > 0 && (
                        <p className="text-[10px] text-neutral-500">
                          {tx.creditsAmount.toFixed(2)} kg CO₂ @ ${tx.pricePerUnit?.toFixed(2)}/kg
                        </p>
                      )}
                    </div>

                    {/* Certificate button */}
                    {tx.certificateNumber && (
                      <button
                        onClick={() => handleViewCertificate(tx.certificateNumber)}
                        disabled={certificateLoading}
                        className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                        title="View NFT Certificate"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Certificate
                      </button>
                    )}

                    <p className="min-w-25 text-[11px] text-neutral-400">
                      {formatDate(tx.date)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {pagination.hasMore && !isLoading && (
          <div className="flex justify-center pt-4">
            <button
              onClick={() =>
                dispatch(
                  fetchTransactions({
                    limit: pagination.limit,
                    offset: pagination.offset + pagination.limit,
                  })
                )
              }
              className="rounded-full border border-neutral-200 px-6 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
            >
              Load More
            </button>
          </div>
        )}
      </div>

      {/* NFT Certificate Modal */}
      {activeCertificate && (
        <NFTCertificate
          certificate={activeCertificate}
          onClose={handleCloseCertificate}
        />
      )}
    </PageContainer>
  );
};

export default TransactionsPage;
