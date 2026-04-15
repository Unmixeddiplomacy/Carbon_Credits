/**
 * Network configuration for the Carbon Credit platform
 * 
 * Supports multiple networks:
 * - Sepolia testnet (persistent, recommended for stable dev)
 * - Hardhat localhost (ephemeral, for quick local testing)
 */

// Supported networks
export const NETWORKS = {
  sepolia: {
    chainId: 11155111n,
    name: "Sepolia",
    rpcUrl: "https://rpc.sepolia.org",
    blockExplorer: "https://sepolia.etherscan.io",
  },
  hardhat: {
    chainId: 31337n,
    name: "Hardhat",
    rpcUrl: "http://127.0.0.1:8545",
    blockExplorer: null,
  },
};

// Allowed chain IDs (as BigInt for ethers v6 compatibility)
export const ALLOWED_CHAIN_IDS = [
  NETWORKS.sepolia.chainId,
  NETWORKS.hardhat.chainId,
];

// Check if a chainId is supported
export function isSupportedNetwork(chainId) {
  // Handle both BigInt and number
  const id = typeof chainId === "bigint" ? chainId : BigInt(chainId);
  return ALLOWED_CHAIN_IDS.includes(id);
}

// Get network info by chainId
export function getNetworkByChainId(chainId) {
  const id = typeof chainId === "bigint" ? chainId : BigInt(chainId);
  for (const [key, network] of Object.entries(NETWORKS)) {
    if (network.chainId === id) {
      return { key, ...network };
    }
  }
  return null;
}

// Get friendly error message for unsupported network
export function getNetworkErrorMessage() {
  const supportedNames = Object.values(NETWORKS)
    .map((n) => `${n.name} (${n.chainId})`)
    .join(" or ");
  return `Please switch MetaMask to ${supportedNames}.`;
}

// Get block explorer URL for a transaction
export function getTxExplorerUrl(chainId, txHash) {
  const network = getNetworkByChainId(chainId);
  if (!network || !network.blockExplorer) return null;
  return `${network.blockExplorer}/tx/${txHash}`;
}

export default NETWORKS;
