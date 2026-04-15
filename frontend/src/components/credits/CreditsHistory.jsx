import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchHistory,
  selectHistory,
  selectHistoryLoading,
} from "../../store/creditsSlice";
import Card from "../ui/Card";

const transactionStyles = {
  issuance: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: "🌱",
    iconBg: "bg-emerald-100",
    label: "Issued",
    amountClass: "text-emerald-700",
    prefix: "+",
  },
  retirement: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "🔥",
    iconBg: "bg-amber-100",
    label: "Retired",
    amountClass: "text-amber-700",
    prefix: "-",
  },
  transfer_sent: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "↗️",
    iconBg: "bg-red-100",
    label: "Sent",
    amountClass: "text-red-700",
    prefix: "-",
  },
  transfer_received: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "↙️",
    iconBg: "bg-blue-100",
    label: "Received",
    amountClass: "text-blue-700",
    prefix: "+",
  },
};

const CreditsHistory = () => {
  const dispatch = useDispatch();
  const history = useSelector(selectHistory);
  const isLoading = useSelector(selectHistoryLoading);

  useEffect(() => {
    dispatch(fetchHistory({ limit: 20, offset: 0 }));
  }, [dispatch]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  const getTransactionDescription = (tx) => {
    switch (tx.type) {
      case "issuance":
        return `From "${tx.treeName}" • ${tx.periodStart} to ${tx.periodEnd}`;
      case "retirement":
        return tx.reason;
      case "transfer_sent":
        return `To ${tx.toEmail}${tx.memo ? ` • ${tx.memo}` : ""}`;
      case "transfer_received":
        return `From ${tx.fromEmail}${tx.memo ? ` • ${tx.memo}` : ""}`;
      default:
        return "";
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Transaction History</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Recent credit activities
          </p>
        </div>
        {history.length > 0 && (
          <span className="text-[10px] text-neutral-400">{history.length} transactions</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50"
            />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-center text-xs text-neutral-500">
          No transactions yet. Issue or retire credits to see history here.
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((tx) => {
            const style = transactionStyles[tx.type] || transactionStyles.issuance;
            return (
              <div
                key={`${tx.type}-${tx.id}`}
                className={`rounded-lg border ${style.border} ${style.bg} p-3`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.iconBg} text-sm`}
                  >
                    {style.icon}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-neutral-900">
                        {style.label}
                      </span>
                      <span className={`text-sm font-semibold ${style.amountClass}`}>
                        {style.prefix}{tx.amount.toLocaleString()} kg
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-neutral-600">
                      {getTransactionDescription(tx)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-neutral-400">
                        {formatDate(tx.createdAt)}
                      </span>
                      {tx.txHash && (
                        <span className="inline-flex items-center rounded bg-neutral-100 px-1 py-0.5 text-[9px] font-mono text-neutral-500">
                          {tx.txHash.slice(0, 10)}...
                        </span>
                      )}
                      {tx.certificateNumber && (
                        <span className="inline-flex items-center rounded bg-amber-100 px-1 py-0.5 text-[9px] font-mono text-amber-700">
                          #{tx.certificateNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default CreditsHistory;
