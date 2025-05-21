require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  "0000000000000000000000000000000000000000000000000000000000000000";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          viaIR: true  // Enable IR-based code generation
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts"
  },
  // Only include OrderProcessor contract
  includeFiles: [
    "contracts/OrderProcessor.sol"
  ],
  networks: {
    optimismSepolia: {
      url: process.env.OPTIMISM_SEPOLIA_RPC || "https://sepolia.optimism.io",
      accounts: [PRIVATE_KEY],
      chainId: 11155420,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      accounts: [PRIVATE_KEY],
      chainId: 84532,
    },
    modeSepolia: {
      url: process.env.MODE_SEPOLIA_RPC || "https://sepolia.mode.network",
      accounts: [PRIVATE_KEY],
      chainId: 919,
    },
    bobSepolia: {
      url: process.env.BOB_SEPOLIA_RPC || "https://testnet.rpc.gobob.xyz",
      accounts: [PRIVATE_KEY],
      chainId: 808813,
    },
    inkSepolia: {
      url: process.env.INK_SEPOLIA_RPC || "https://sepolia.rpc.ink",
      accounts: [PRIVATE_KEY],
      chainId: 763373,
    },
    unichainSepolia: {
      url: process.env.UNICHAIN_SEPOLIA_RPC || "https://rpc-testnet.unichain.org",
      accounts: [PRIVATE_KEY],
      chainId: 1301,
    },
    t3rn: {
      url: process.env.T3RN_RPC || "https://b2n.rpc.caldera.xyz/http",
      accounts: [PRIVATE_KEY],
      chainId: 334,
    },
  },
};
