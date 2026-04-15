import useWalletLink from "../../hooks/useWalletLink";
import { useCreditsPolling } from "../../hooks/useCreditsPolling";
import Button from "../ui/Button";
import Card from "../ui/Card";

/**
 * SummaryCards - Dashboard summary with wallet and credits info
 * Uses RTK Query with automatic polling for real-time updates
 */
const SummaryCards = () => {
  const {
    truncatedAddress,
    isLinked,
    isLinking,
    isUnlinking,
    error,
    isMetamaskAvailable,
    connectWallet,
    unlinkWallet,
  } = useWalletLink();

  // Auto-polling credits data - refreshes every 30s and on focus/visibility
  const {
    credits,
  } = useCreditsPolling({
    pollingInterval: 30000,
    refetchOnFocus: true,
    refetchOnVisible: true,
  });

  const availableCredits = credits?.availableBalance ?? 0;
  const totalIssued = credits?.totalIssued ?? 0;
  const totalRetired = credits?.totalRetired ?? 0;
  const cards = [
    {
      label: "Available credits",
      value: `${availableCredits.toLocaleString()} kg`,
      description: "ready to trade or retire",
    },
    {
      label: "Total issued",
      value: `${totalIssued.toLocaleString()} kg`,
      description: "issued to your account",
    },
    {
      label: "Total retired",
      value: `${totalRetired.toLocaleString()} kg`,
      description: "used for carbon offsets",
    },
  ];

  return (
    <section className="grid auto-rows-fr gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="h-full p-5 sm:p-6">
        <p className="text-xs font-medium text-neutral-500">Wallet address</p>
        <p className="mt-1 text-2xl font-semibold text-neutral-950">
          {isLinked ? truncatedAddress : "Not linked"}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {isLinked
            ? "linked to your carbon wallet"
            : "Connect MetaMask to link a wallet to this account."}
        </p>
        {!isMetamaskAvailable && (
          <p className="mt-2 text-[11px] text-amber-600">
            MetaMask not detected in this browser.
          </p>
        )}
        {error && (
          <p className="mt-2 text-[11px] text-red-600">
            {error}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={isLinked ? unlinkWallet : connectWallet}
            disabled={isLinking || isUnlinking || !isMetamaskAvailable}
          >
            {isLinked
              ? isUnlinking
                ? "Unlinking..."
                : "Unlink wallet"
              : isLinking
                ? "Connecting..."
                : "Connect MetaMask"}
          </Button>
        </div>
      </Card>

      {cards.map((card) => (
        <Card
          key={card.label}
          className="h-full p-5 sm:p-6"
        >
          <p className="text-xs font-medium text-neutral-500">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-950">
            {card.value}
          </p>
          <p className="mt-1 text-xs text-neutral-500">{card.description}</p>
        </Card>
      ))}
    </section>
  );
};

export default SummaryCards;
