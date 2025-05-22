/**
 * Configuration for a blockchain network
 */
export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
}

/**
 * Base contract configuration
 */
export interface BaseContractConfig {
  address: string;
  chainId: number;
  abi: string[];
}

/**
 * Configuration for a source/spoke contract
 */
export interface SpokeContractConfig extends BaseContractConfig {
  eventToMonitor: string;
}

/**
 * Configuration for a destination/hub contract
 */
export interface HubContractConfig extends BaseContractConfig {
  methodToCall: string;
}

/**
 * Configuration for contract event monitoring
 */
export interface ContractEventConfig {
  hub: {
    chain: ChainConfig;
    contract: HubContractConfig;
  };
  spokes: {
    [chainId: number]: {
      chain: ChainConfig;
      contract: SpokeContractConfig;
    };
  };
} 