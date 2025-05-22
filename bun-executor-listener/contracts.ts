// contract-config.ts

import type { ContractEventConfig } from './types';
import { loadConfig } from './config';

// Get chain configurations
const config = loadConfig();

// Spoke Chain Contract ABI - Events emitted by spoke chain contracts
const SPOKE_CONTRACT_ABI = [
  "event OrderCreated(bytes32 indexed id, bytes4 indexed destination, uint32 asset, bytes32 targetAccount, uint256 amount, address rewardAsset, uint256 insurance, uint256 maxReward, uint32 nonce, address sourceAccount, uint256 orderTimestamp)",
  "event Confirmation(bytes32 indexed id, address indexed target, uint256 amount, address asset, address indexed sender, bytes32 confirmationId, uint256 timestamp)"
];

// Hub Chain (t3rn) Contract ABI - Events emitted by the hub contract
const HUB_CONTRACT_ABI: string[] = [
  "event OrderOpened(bytes32 indexed id, bytes32 indexed destination, uint32 asset, bytes32 targetAccount, uint256 amount, address rewardAsset, uint256 insurance, uint256 maxReward, uint32 nonce, address sourceAccount, uint256 orderTimestamp)",
  "event OrderCompleted(bytes32 indexed id, address indexed target, bytes32 confirmationId, uint256 amount, address asset, uint256 timestamp)",
  "event ReclaimReady(bytes32 indexed id, address indexed sourceAccount, address rewardAsset, uint256 timestamp)",
  
  "function openOrder(bytes calldata proof) external",
  "function orderCompleted(bytes calldata proof) external"
];

// Contract event monitoring configuration
export const contractConfig: ContractEventConfig = {
  // Hub configuration (t3rn)
  hub: {
    chain: config.chains[334]!, // t3rn testnet
    contract: {
      address: '0xBf822582b24a0227Dda5d665c1F56B5268D04444', // Replace with actual t3rn contract address
      chainId: 334,
      abi: HUB_CONTRACT_ABI,
      methodToCall: 'processOrder' // Update this with actual method name if different
    }
  },
  
  // Spoke chains configuration
  spokes: {
    // Base Sepolia configuration
    84532: {
      chain: config.chains[84532]!,
      contract: {
        address: '0xCEE0372632a37Ba4d0499D1E2116eCff3A17d3C3',
        chainId: 84532,
        abi: SPOKE_CONTRACT_ABI,
        eventToMonitor: 'OrderCreated'
      }
    },
    
    // Unichain Sepolia configuration
    1301: {
      chain: config.chains[1301]!,
      contract: {
        address: '0x1cEAb5967E5f078Fa0FEC3DFfD0394Af1fEeBCC9',
        chainId: 1301,
        abi: SPOKE_CONTRACT_ABI,
        eventToMonitor: 'Confirmation'
      }
    },
  }
};

// Export spoke chain event names
export const SPOKE_EVENTS = {
  ORDER_CREATED: 'OrderCreated',
  CONFIRMATION: 'Confirmation'
} as const;

// Export hub chain event names
export const HUB_EVENTS = {
  ORDER_OPENED: 'OrderOpened',
  ORDER_COMPLETED: 'OrderCompleted',
  RECLAIM_READY: 'ReclaimReady'
} as const;

// Spoke chain event parameter types
export interface OrderCreatedEvent {
  id: string;           // bytes32
  destination: string;  // bytes4 (string identifier like "bast", e.g., 0x62617374...)
  asset: number;        // uint32
  targetAccount: string;// bytes32
  amount: bigint;       // uint256
  rewardAsset: string;  // address
  insurance: bigint;    // uint256
  maxReward: bigint;    // uint256
  nonce: number;        // uint32
  sourceAccount: string;// address
  orderTimestamp: bigint;// uint256
}

export interface ConfirmationEvent {
  id: string;           // bytes32
  target: string;       // address
  amount: bigint;       // uint256
  asset: string;        // address
  sender: string;       // address
  confirmationId: string;// bytes32
  timestamp: bigint;    // uint256
}

// Hub chain event parameter types
export interface OrderOpenedEvent {
  id: string;           // bytes32
  destination: string;  // bytes32
  asset: number;        // uint32
  targetAccount: string;// bytes32
  amount: bigint;       // uint256
  rewardAsset: string;  // address
  insurance: bigint;    // uint256
  maxReward: bigint;    // uint256
  nonce: number;        // uint32
  sourceAccount: string;// address
  orderTimestamp: bigint;// uint256
}

export interface OrderCompletedEvent {
  id: string;           // bytes32
  target: string;       // address
  confirmationId: string;// bytes32
  amount: bigint;       // uint256
  asset: string;        // address
  timestamp: bigint;    // uint256
}

export interface ReclaimReadyEvent {
  id: string;           // bytes32
  sourceAccount: string;// address
  rewardAsset: string;  // address
  timestamp: bigint;    // uint256
}

// Replace with your actual contract ABI (usually a JSON object)
const ORDER_PROCESSOR_ABI_PLACEHOLDER = {}; 

export const Contracts = {
  orderProcessor: {
    address: process.env.ORDER_PROCESSOR_CONTRACT_ADDRESS || "YOUR_ORDER_PROCESSOR_CONTRACT_ADDRESS_HERE",
    abi: ORDER_PROCESSOR_ABI_PLACEHOLDER, // You will replace this with the actual ABI
    // Define specific events you want to listen to from this contract
    events: [
      "OrderCreated", 
      "OrderProcessed", 
      "OrderCancelled"
      // Add more event names as strings
    ]
  },
  // Add other contracts here as needed
  // anotherContract: {
  //   address: process.env.ANOTHER_CONTRACT_ADDRESS || "ANOTHER_CONTRACT_ADDRESS",
  //   abi: {}, // Replace with actual ABI
  //   events: ["EventA", "EventB"]
  // }
};

// You would typically load the ABI from a JSON file, e.g.:
// import orderProcessorAbiJson from './abis/orderProcessor.abi.json';
// const ORDER_PROCESSOR_ABI = orderProcessorAbiJson;
// Make sure to create an 'abis' folder and place your ABI JSON files there if you use this approach. 