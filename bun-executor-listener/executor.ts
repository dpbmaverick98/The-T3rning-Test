import { ethers } from 'ethers';
import axios from 'axios';
import dotenv from 'dotenv';
import { contractConfig, SPOKE_EVENTS } from './contracts';
import type { OrderCreatedEvent, ConfirmationEvent } from './contracts';
import type { ContractEventConfig } from './types';

// Load env vars
dotenv.config();

// API Endpoint
const EXECUTOR_API_URL = 'https://execute.testnet.polymer.zone/execute';

// Chain IDs
const UNICHAIN_ID = 1301;
const BASE_ID = 84532;

// Track processed events to avoid duplicates
const processedTxs = new Set<string>();

// Store IDs of orders created on Unichain and pending confirmation on Base
const pendingOrderIdsFromUnichain = new Set<string>();

// Polling interval in ms
const POLLING_INTERVAL = 2000; // 2 seconds

// Verify chain configurations exist
const unichainConfig = contractConfig.spokes[UNICHAIN_ID];
const baseConfig = contractConfig.spokes[BASE_ID];

if (!unichainConfig || !baseConfig) {
  console.error('❌ Missing chain configuration!');
  process.exit(1);
}

// After verification, we can safely assert the types
const UNICHAIN = unichainConfig;
const BASE = baseConfig;

/**
 * Call the Executor API to relay an event to t3rn
 */
async function callExecutorAPI(
  srcChainId: number,
  blockNumber: number,
  logIndex: number,
  destMethod: string,
  args: any[]
) {
  try {
    console.log(`Calling executor API for event at block ${blockNumber}, log index ${logIndex}`);
    
    // Prepare the request payload
    const payload = {
      proofParams: {
        srcChainId: srcChainId,
        srcBlockNumber: blockNumber,
        globalLogIndex: logIndex
      },
      executionParams: {
        destChainId: contractConfig.hub.contract.chainId,
        destContractAddress: contractConfig.hub.contract.address,
        method: destMethod,
        args: args,
        gasLimit: 500000
      }
    };
    
    console.log(`Sending request to ${EXECUTOR_API_URL}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    // Make the API call
    const response = await axios.post(EXECUTOR_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success && response.data.result.executionResult.success) {
      console.log(`✅ Transaction executed: ${response.data.result.executionResult.transactionHash}`);
      console.log(`⏱️ Total execution time: ${response.data.result.executionTime}ms`);
    } else {
      console.error('❌ Execution failed:', response.data);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ API call failed:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
    } else {
      console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * Process OrderCreated event from Unichain
 */
async function processOrderCreatedEvent(log: ethers.Log) {
  try {
    const txHash = log.transactionHash;
    const blockNumber = Number(log.blockNumber);
    const logIndex = log.index;
    
    // Skip if already processed
    if (processedTxs.has(txHash)) {
      console.log(`⏭️ Skipping already processed transaction: ${txHash}`);
      return;
    }
    
    // Mark as processed
    processedTxs.add(txHash);
    
    // Create interface to parse the log
    const iface = new ethers.Interface(UNICHAIN.contract.abi);
    const parsedLog = iface.parseLog(log);
    
    if (!parsedLog) {
      console.error('❌ Could not parse log for OrderCreatedEvent');
      return;
    }
    
    const rawDestinationHex = parsedLog.args[1] as string;
    // const destinationChainIdAsNumber = parseInt(rawDestinationHex, 16); // No longer parsing to number

    // Define the expected bytes4 string prefix for Base ("bast")
    const expectedBaseDestinationHexPrefix = "0x62617374"; 

    // Only process if destination is Base (matches "bast")
    if (!rawDestinationHex.toLowerCase().startsWith(expectedBaseDestinationHexPrefix)) { 
      console.log(`⏭️ Skipping OrderCreated event: Destination hex ${rawDestinationHex} does not match expected Base identifier (${expectedBaseDestinationHexPrefix}).`);
      return;
    }
    
    // Extract event data
    const event: OrderCreatedEvent = {
      id: parsedLog.args[0] as string,
      destination: rawDestinationHex, // Keep as raw hex string
      asset: Number(parsedLog.args[2]),
      targetAccount: parsedLog.args[3] as string,
      amount: BigInt(parsedLog.args[4].toString()),
      rewardAsset: parsedLog.args[5] as string,
      insurance: BigInt(parsedLog.args[6].toString()),
      maxReward: BigInt(parsedLog.args[7].toString()),
      nonce: Number(parsedLog.args[8]),
      sourceAccount: parsedLog.args[9] as string,
      orderTimestamp: BigInt(parsedLog.args[10].toString())
    };

    // Only process if destination is Base (84532) -- This check is now redundant due to the earlier return, but kept for clarity of original logic flow if needed.
    // if (event.destination !== BASE_ID) { 
    //   console.log(`⏭️ Skipping event for non-Base destination: ${event.destination}`);
    //   return;
    // }
    
    console.log('\n🔔 New OrderCreated event detected:', event);
    
    // Add to pending set
    pendingOrderIdsFromUnichain.add(event.id);
    console.log(`➕ Added Order ID ${event.id} to pending set.`);

    // Call executor API to relay to t3rn's openOrder
    await callExecutorAPI(
      UNICHAIN_ID,
      blockNumber,
      logIndex,
      'openOrder',
      [{ proofPlaceholder: true }] // proof will be generated by API
    );
  } catch (error) {
    console.error('❌ Error processing OrderCreated event:', error);
  }
}

/**
 * Process Confirmation event from Base
 */
async function processConfirmationEvent(log: ethers.Log) {
  try {
    const txHash = log.transactionHash;
    const blockNumber = Number(log.blockNumber);
    const logIndex = log.index;
    
    // Skip if already processed
    if (processedTxs.has(txHash)) {
      console.log(`⏭️ Skipping already processed transaction: ${txHash}`);
      return;
    }
    
    // Mark as processed
    processedTxs.add(txHash);
    
    // Create interface to parse the log
    const iface = new ethers.Interface(BASE.contract.abi);
    const parsedLog = iface.parseLog(log);
    
    if (!parsedLog) {
      console.error('❌ Could not parse log');
      return;
    }
    
    // Extract event data
    const event: ConfirmationEvent = {
      id: parsedLog.args[0],
      target: parsedLog.args[1],
      amount: BigInt(parsedLog.args[2].toString()),
      asset: parsedLog.args[3],
      sender: parsedLog.args[4],
      confirmationId: parsedLog.args[5],
      timestamp: BigInt(parsedLog.args[6].toString())
    };

    // Check if this order ID was seen on Unichain
    if (!pendingOrderIdsFromUnichain.has(event.id)) {
      console.log(`
❔ Skipping Confirmation for ID ${event.id}. No corresponding OrderCreated event found in pending set from Unichain (or already processed).`);
      return;
    }
    
    console.log('\n🔔 New Confirmation event detected (ID was pending):', event);
    
    // Call executor API to relay to t3rn's orderCompleted
    await callExecutorAPI(
      BASE_ID,
      blockNumber,
      logIndex,
      'orderCompleted',
      [{ proofPlaceholder: true }] // proof will be generated by API
    );

    // Remove from pending set after processing
    pendingOrderIdsFromUnichain.delete(event.id);
    console.log(`➖ Removed Order ID ${event.id} from pending set after processing confirmation.`);

  } catch (error) {
    console.error('❌ Error processing Confirmation event:', error);
  }
}

/**
 * Poll for new events on a specific chain
 */
async function pollForEvents(
  provider: ethers.JsonRpcProvider,
  contract: ethers.Contract,
  eventName: string,
  processor: (log: ethers.Log) => Promise<void>,
  lastProcessedBlock: number
) {
  try {
    const currentBlock = await provider.getBlockNumber();
    
    if (currentBlock <= lastProcessedBlock) {
      return lastProcessedBlock;
    }
    
    console.log(`Checking for ${eventName} events from block ${lastProcessedBlock + 1} to ${currentBlock}`);
    
    // Create event filter
    const iface = new ethers.Interface(contract.interface.fragments);
    const eventFragment = iface.getEvent(eventName);
    
    if (!eventFragment) {
      console.error(`❌ Could not find event ${eventName} in ABI`);
      return lastProcessedBlock;
    }
    
    // Get logs
    const logs = await provider.getLogs({
      fromBlock: lastProcessedBlock + 1,
      toBlock: currentBlock,
      address: contract.target as string,
      topics: [eventFragment.topicHash]
    });
    
    console.log(`Found ${logs.length} new ${eventName} events`);
    
    // Process each log
    for (const log of logs) {
      await processor(log);
    }
    
    return currentBlock;
  } catch (error) {
    console.error(`❌ Error polling for ${eventName} events:`, error);
    return lastProcessedBlock;
  }
}

/**
 * Start polling for events on both chains
 */
async function startPolling() {
  try {
    // Set up Unichain monitoring
    const unichainProvider = new ethers.JsonRpcProvider(UNICHAIN.chain.rpcUrl);
    const unichainContract = new ethers.Contract(
      UNICHAIN.contract.address,
      UNICHAIN.contract.abi,
      unichainProvider
    );
    let lastUnichainBlock = await unichainProvider.getBlockNumber();
    
    // Set up Base monitoring
    const baseProvider = new ethers.JsonRpcProvider(BASE.chain.rpcUrl);
    const baseContract = new ethers.Contract(
      BASE.contract.address,
      BASE.contract.abi,
      baseProvider
    );
    let lastBaseBlock = await baseProvider.getBlockNumber();
    
    console.log('\n🚀 Starting event monitoring:');
    console.log(`Unichain Contract: ${UNICHAIN.contract.address}`);
    console.log(`Base Contract: ${BASE.contract.address}`);
    console.log(`t3rn Hub Contract: ${contractConfig.hub.contract.address}`);
    console.log(`Polling interval: ${POLLING_INTERVAL}ms\n`);
    
    // Set up polling intervals
    setInterval(async () => {
      // Poll Unichain for OrderCreated events
      lastUnichainBlock = await pollForEvents(
        unichainProvider,
        unichainContract,
        SPOKE_EVENTS.ORDER_CREATED,
        processOrderCreatedEvent,
        lastUnichainBlock
      );
      
      // Poll Base for Confirmation events
      lastBaseBlock = await pollForEvents(
        baseProvider,
        baseContract,
        SPOKE_EVENTS.CONFIRMATION,
        processConfirmationEvent,
        lastBaseBlock
      );
    }, POLLING_INTERVAL);
    
    // Keep process running
    process.stdin.resume();
    
  } catch (error) {
    console.error('❌ Error starting polling:', error);
    process.exit(1);
  }
}

// Start the executor
startPolling().catch(console.error); 