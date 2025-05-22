import { ethers, EventLog } from 'ethers';
import { loadConfig } from './config';
import { 
  contractConfig, 
  HUB_EVENTS,
  type OrderOpenedEvent,
  type OrderCompletedEvent,
  type ReclaimReadyEvent
} from './contracts';
import type { ChainConfig } from './types';

// Load configuration
const config = loadConfig();
const T3RN_CHAIN_ID = 334;

// Ensure t3rn chain config exists
const t3rnChainConfig = config.chains[T3RN_CHAIN_ID];
if (!t3rnChainConfig) {
  console.error(`❌ t3rn chain configuration not found for chain ID ${T3RN_CHAIN_ID}!`);
  process.exit(1);
}

// After verification, we can safely assert the type
const chainConfig = t3rnChainConfig as ChainConfig;

let provider: ethers.JsonRpcProvider | null = null;
let hubContract: ethers.Contract | null = null;
let lastPolledBlock: number = -1;
const POLLING_INTERVAL_MS = 10000; // 10 seconds
const processedEventIds = new Set<string>(); // To store txHash:logIndex
const CATCH_UP_BLOCK_COUNT = 100; // Number of blocks to look back on initial start or restart

function processHubEvent(event: EventLog) {
  const eventUniqueId = `${event.transactionHash}:${event.index}`;
  if (processedEventIds.has(eventUniqueId)) {
    return; // Already processed
  }

  if (!event.args) {
    console.warn('Event has no args, skipping:', event);
    return;
  }

  if (event.eventName === HUB_EVENTS.ORDER_OPENED) {
    const args = event.args;
    const typedEvent: OrderOpenedEvent = {
      id: args.id.toString(),
      destination: args.destination.toString(),
      asset: Number(args.asset),
      targetAccount: args.targetAccount.toString(),
      amount: BigInt(args.amount.toString()),
      rewardAsset: args.rewardAsset.toString(),
      insurance: BigInt(args.insurance.toString()),
      maxReward: BigInt(args.maxReward.toString()),
      nonce: Number(args.nonce),
      sourceAccount: args.sourceAccount.toString(),
      orderTimestamp: BigInt(args.orderTimestamp.toString())
    };
    console.log('\n🔵 Order Opened (Polled):');
    console.log(JSON.stringify(typedEvent, (_, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2));
  } else if (event.eventName === HUB_EVENTS.ORDER_COMPLETED) {
    const args = event.args;
    const typedEvent: OrderCompletedEvent = {
      id: args.id.toString(),
      target: args.target.toString(),
      confirmationId: args.confirmationId.toString(),
      amount: BigInt(args.amount.toString()),
      asset: args.asset.toString(),
      timestamp: BigInt(args.timestamp.toString())
    };
    console.log('\n✅ Order Completed (Polled):');
    console.log(JSON.stringify(typedEvent, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2));
  } else if (event.eventName === HUB_EVENTS.RECLAIM_READY) {
    const args = event.args;
    const typedEvent: ReclaimReadyEvent = {
      id: args.id.toString(),
      sourceAccount: args.sourceAccount.toString(),
      rewardAsset: args.rewardAsset.toString(),
      timestamp: BigInt(args.timestamp.toString())
    };
    console.log('\n🔄 Reclaim Ready (Polled):');
    console.log(JSON.stringify(typedEvent, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2));
  }

  processedEventIds.add(eventUniqueId);
}

async function pollForHubEvents() {
  if (!provider || !hubContract) {
    console.error('Provider or contract not initialized for polling.');
    return;
  }

  // Add a check for hubContract.filters
  if (!hubContract.filters) {
    console.error('❌ Hub contract filters are not available. ABI might be incomplete or contract not properly initialized.');
    // Potentially try to re-initialize the contract or provider here, or wait for the main setup to retry.
    return;
  }

  try {
    const currentBlock = await provider.getBlockNumber();
    if (lastPolledBlock === -1) {
      // First run, or restart after an issue where lastPolledBlock wasn't set
      lastPolledBlock = Math.max(0, currentBlock - CATCH_UP_BLOCK_COUNT); 
      console.log(`Initial poll: setting lastPolledBlock to ${lastPolledBlock} (current: ${currentBlock})`);
    }

    if (currentBlock <= lastPolledBlock) {
      // console.log('No new blocks to poll.');
      return;
    }

    const fromBlock = lastPolledBlock + 1;
    const toBlock = currentBlock;

    console.log(`Polling for hub events from block ${fromBlock} to ${toBlock}`);

    // Ensure filter methods exist before calling them
    const orderOpenedFilter = hubContract.filters.OrderOpened;
    const orderCompletedFilter = hubContract.filters.OrderCompleted;
    const reclaimReadyFilter = hubContract.filters.ReclaimReady;

    if (!orderOpenedFilter || !orderCompletedFilter || !reclaimReadyFilter) {
        console.error('❌ One or more event filter methods (OrderOpened, OrderCompleted, ReclaimReady) are not available on the contract. Check ABI.');
        return;
    }

    const eventPromises = [
      hubContract.queryFilter(orderOpenedFilter(), fromBlock, toBlock),
      hubContract.queryFilter(orderCompletedFilter(), fromBlock, toBlock),
      hubContract.queryFilter(reclaimReadyFilter(), fromBlock, toBlock),
    ];

    const eventArrays = await Promise.all(eventPromises);
    const allEvents: EventLog[] = eventArrays.flat() as EventLog[];

    if (allEvents.length > 0) {
      // Sort events by block number and then log index to process in order
      allEvents.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) {
          return a.blockNumber - b.blockNumber;
        }
        return a.index - b.index; 
      });

      console.log(`Found ${allEvents.length} hub events between block ${fromBlock} and ${toBlock}.`);
      for (const event of allEvents) {
        processHubEvent(event);
      }
    }

    lastPolledBlock = toBlock;

  } catch (error) {
    console.error('❌ Error during hub event polling:', error);
    // Errors here might be RPC issues. The next poll will retry.
    // If provider itself is unstable, re-initializing it might be needed,
    // but simple polling often bypasses transient filter issues.
  }
}

async function startHubListener() {
  console.log('🚀 Starting t3rn Hub Listener with polling strategy...');
  console.log(`RPC URL: ${chainConfig.rpcUrl}`);
  console.log(`Hub Contract: ${contractConfig.hub.contract.address}`);
  console.log(`Polling Interval: ${POLLING_INTERVAL_MS / 1000} seconds`);

  provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
  hubContract = new ethers.Contract(
    contractConfig.hub.contract.address,
    contractConfig.hub.contract.abi,
    provider
  );

  try {
    // Perform an initial connection test
    const network = await provider.getNetwork();
    console.log(`Successfully connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    
    // Initialize lastPolledBlock before starting the interval
    // Set it a bit behind current to catch events that might occur during init
    const currentBlock = await provider.getBlockNumber();
    lastPolledBlock = Math.max(0, currentBlock - CATCH_UP_BLOCK_COUNT); 
    console.log(`Initial lastPolledBlock set to: ${lastPolledBlock}`);

    // Perform an initial poll immediately
    await pollForHubEvents();

    // Then set up the interval
    setInterval(pollForHubEvents, POLLING_INTERVAL_MS);
    console.log('✅ Hub event polling started successfully.');

  } catch (error) {
    console.error('❌ Failed to initialize hub listener or perform initial poll:', error);
    console.log(`Retrying initialization in ${POLLING_INTERVAL_MS / 1000} seconds...`);
    // Attempt to restart the whole listener setup after a delay if initial setup fails
    setTimeout(startHubListener, POLLING_INTERVAL_MS);
  }
}

// Handle SIGINT for graceful shutdown (optional for polling, but good practice)
process.on('SIGINT', () => {
  console.log('\n👋 SIGINT received. Shutting down listener...');
  // No explicit cleanup needed for provider/contract with polling if process exits,
  // but if you had other resources, you'd clean them here.
  process.exit(0);
});

// Start listening
startHubListener();
