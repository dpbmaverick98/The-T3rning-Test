import dotenv from 'dotenv';
import type { ChainConfig } from './types';

// Load environment variables (as fallback)
dotenv.config();

/**
 * Main configuration structure for the executor
 * This interface defines all configurable parts of the application,
 * including API credentials, wallet settings, and chain-specific details.
 */
export interface ExecutorConfig {
  // Chain configurations
  chains: Record<number, ChainConfig>;
}

// Hardcoded configuration values
const HARDCODED_CONFIG: ExecutorConfig = {
  // Chain configurations
  chains: {
    // t3rn Testnet (Hub)
    334: {
      id: 334,
      name: 't3rn Testnet',
      rpcUrl: 'https://rpc.t3rn.io/', // Replace with actual t3rn testnet RPC if different
    },
    
    // Base Sepolia (Spoke)
    84532: {
      id: 84532,
      name: 'Base Sepolia',
      rpcUrl: 'https://sepolia.base.org',
    },
    
    // Unichain Sepolia (Spoke)
    1301: {
      id: 1301,
      name: 'Unichain Sepolia',
      rpcUrl: 'https://rpc.sepolia.unichain. κόσμος.pages.dev/', // Note: . κόσμος.pages.dev might be a placeholder
    },
    
    // Add other chains as needed
    // Example: Optimism Sepolia
    11155420: {
      id: 11155420,
      name: 'Optimism Sepolia',
      rpcUrl: 'https://sepolia.optimism.io',
    },
    
    // Example: Arbitrum Sepolia
    421614: {
      id: 421614,
      name: 'Arbitrum Sepolia',
      rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    },
  },
};

/**
 * Loads the application configuration.
 * Currently, it returns hardcoded values but can be extended
 * to load from environment variables or a configuration file.
 * 
 * @returns The application configuration object.
 */
export function loadConfig(): ExecutorConfig {
  // TODO: Implement loading from environment variables or a config file
  // For now, returning hardcoded values
  return HARDCODED_CONFIG;
}

export const T3RN_RPC_ENDPOINT = process.env.T3RN_RPC_ENDPOINT || "ws://127.0.0.1:9944"; // Default to local t3rn node

// Add other chain RPC endpoints as needed
// export const ETHEREUM_RPC_ENDPOINT = process.env.ETHEREUM_RPC_ENDPOINT || "wss://mainnet.infura.io/ws/v3/YOUR_INFURA_PROJECT_ID";
// export const POLKADOT_RPC_ENDPOINT = process.env.POLKADOT_RPC_ENDPOINT || "wss://rpc.polkadot.io"; 