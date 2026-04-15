import "@nomiclabs/hardhat-waffle";
import dotenv from "dotenv";

dotenv.config();

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

// Get deployer private key from env (for testnet deployments)
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";

const config = {
  solidity: {
    compilers: [
      {
        version: "0.7.3"
      },
      {
        version: "0.8.20"
      }
    ]
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    // Sepolia testnet - persistent chain
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155111,
    }
  }
};

export default config;

