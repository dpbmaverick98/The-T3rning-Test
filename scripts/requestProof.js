#!/usr/bin/env node

require("dotenv").config();
const axios = require("axios");
const ethers = require("ethers");
const chalk = require("chalk");

const POLYMER_API_URL = "https://proof.testnet.polymer.zone";
const PROVER_CONTRACT_ADDRESS = "0xcDa03d74DEc5B24071D1799899B2e0653C24e5Fa";
const T3RN_RPC_URL = "https://b2n.rpc.caldera.xyz/http";
const T3RN_CHAIN_ID = 334;

// Chain ID to name mapping
const CHAIN_ID_MAP = {
  // Common chain IDs
  1: "ETHEREUM",
  5: "ETHEREUM_GOERLI",
  11155111: "ETHEREUM_SEPOLIA",
  137: "POLYGON",
  80001: "POLYGON_MUMBAI",
  42161: "ARBITRUM", 
  421613: "ARBITRUM_GOERLI",
  421614: "ARBITRUM_SEPOLIA",
  10: "OPTIMISM",
  420: "OPTIMISM_GOERLI",
  43114: "AVALANCHE",
  43113: "AVALANCHE_FUJI",
  56: "BSC",
  97: "BSC_TESTNET",
  8453: "BASE",
  84531: "BASE_GOERLI",
  84532: "BASE_SEPOLIA"
};

// ABI for the validateEvent function and OrderCreated event
const PROVER_ABI = [
  "function validateEvent(bytes calldata proof) external view returns (uint32 chainId, address emittingContract, bytes memory topics, bytes memory unindexedData)",
  "event OrderCreated(bytes32 indexed id, bytes4 indexed destination, uint32 asset, bytes32 targetAccount, uint256 amount, address rewardAsset, uint256 insurance, uint256 maxReward, uint32 nonce, address sourceAccount, uint256 orderTimestamp)"
];

async function getRpcUrl(chainId) {
  // Try the CHAIN_ID_RPC format first
  const directEnvVar = `CHAIN_${chainId}_RPC`;
  if (process.env[directEnvVar]) {
    return process.env[directEnvVar];
  }

  // Try to get the chain name
  const chainName = CHAIN_ID_MAP[chainId];
  if (!chainName) {
    throw new Error(`Unknown chain ID: ${chainId}. Please add it to CHAIN_ID_MAP or set ${directEnvVar} directly.`);
  }

  // Try different naming formats used in the codebase
  const possibleEnvVars = [
    `${chainName}_RPC`,
    `${chainName.replace("_", "-")}_RPC`,
    `${chainName.replace(/-/g, "_")}_RPC`
  ];

  for (const envVar of possibleEnvVars) {
    if (process.env[envVar]) {
      console.log(chalk.cyan(`>  Using RPC URL from ${envVar}`));
      return process.env[envVar];
    }
  }

  throw new Error(`Missing RPC URL for chain ID ${chainId}. Please set one of these in your .env file: ${possibleEnvVars.join(", ")} or ${directEnvVar}`);
}

async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error(chalk.red("❌ Missing required arguments"));
    console.log(chalk.yellow("Usage: node requestProof.js <chainId> <txHash> <localLogIndex>"));
    process.exit(1);
  }

  const chainId = parseInt(args[0]);
  const txHash = args[1];
  const localLogIndex = parseInt(args[2]);

  console.log(chalk.blue("🔄 Requesting proof from Polymer API..."));
  console.log(chalk.cyan(`>  Chain ID: ${chalk.bold(chainId)}`));
  console.log(chalk.cyan(`>  Chain Name: ${chalk.bold(CHAIN_ID_MAP[chainId] || "Unknown")}`));
  console.log(chalk.cyan(`>  Transaction Hash: ${chalk.bold(txHash)}`));
  console.log(chalk.cyan(`>  Local Log Index: ${chalk.bold(localLogIndex)}`));

  try {
    // Check if POLYMER_API_KEY is set
    if (!process.env.POLYMER_API_KEY) {
      throw new Error("Missing POLYMER_API_KEY in environment variables");
    }

    // Get the RPC URL using our helper function
    const rpcUrl = await getRpcUrl(chainId);
    
    // Get transaction details from the blockchain
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const txReceipt = await provider.getTransactionReceipt(txHash);
    
    if (!txReceipt) {
      throw new Error(`Transaction receipt not found for hash: ${txHash}`);
    }

    const blockNumber = txReceipt.blockNumber;
    const positionInBlock = txReceipt.index;

    console.log(chalk.cyan(`>  Block Number: ${chalk.bold(blockNumber)}`));
    console.log(chalk.cyan(`>  Position in Block: ${chalk.bold(positionInBlock)}`));

    // Request proof from Polymer API
    const proofRequest = await axios.post(
      POLYMER_API_URL,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "log_requestProof",
        params: [
          chainId,
          blockNumber,
          positionInBlock, 
          localLogIndex
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.POLYMER_API_KEY}`,
        },
      }
    );

    if (proofRequest.status !== 200) {
      throw new Error(`Failed to get proof from Polymer API. Status code: ${proofRequest.status}`);
    }

    // Debug output to see what's in the response
    console.log(chalk.yellow(">  API Response:"), JSON.stringify(proofRequest.data, null, 2));

    // Check if result exists
    if (!proofRequest.data || !proofRequest.data.result) {
      throw new Error(`Invalid response from Polymer API: ${JSON.stringify(proofRequest.data)}`);
    }

    const jobId = proofRequest.data.result;
    
    if (!jobId) {
      throw new Error(`Failed to get job ID from Polymer API. Response: ${JSON.stringify(proofRequest.data)}`);
    }

    console.log(chalk.green(`✅ Proof requested successfully. Job ID: ${chalk.bold(jobId)}`));

    // Wait for the proof to be generated
    console.log(chalk.yellow(`>  Waiting for proof to be generated...`));

    let proofResponse;
    let attempts = 0;
    const maxAttempts = 30; // More attempts since it can take time
    let lastStatus = null;
    
    while (!proofResponse?.data?.result?.proof && attempts < maxAttempts) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Check every second
      
      try {
        proofResponse = await axios.post(
          POLYMER_API_URL,
          {
            jsonrpc: "2.0",
            id: 1,
            method: "log_queryProof",
            params: [jobId]
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.POLYMER_API_KEY}`,
            },
          }
        );

        // Debug the response on first attempt and whenever status changes
        if (attempts === 1 || 
           (attempts > 1 && proofResponse?.data?.result?.status !== lastStatus)) {
          console.log(chalk.yellow(">  Full Query Response:"), JSON.stringify(proofResponse.data, null, 2));
          lastStatus = proofResponse?.data?.result?.status;
        }
        
        if (proofResponse?.data?.result) {
          console.log(`>  Proof status: ${proofResponse.data.result.status}... (Attempt ${attempts}/${maxAttempts})`);
        } else {
          console.log(chalk.red(`>  Invalid response format (Attempt ${attempts}/${maxAttempts}):`), JSON.stringify(proofResponse.data));
        }
      } catch (error) {
        console.error(chalk.red(`>  Error querying proof (Attempt ${attempts}/${maxAttempts}):`), error.message);
        // Continue to next attempt
      }
      
      // If we have a proof, break out early
      if (proofResponse?.data?.result?.proof) {
        break;
      }
    }

    if (!proofResponse?.data?.result?.proof) {
      throw new Error("Failed to get proof after maximum attempts");
    }

    const proof = proofResponse.data.result.proof;
    console.log(chalk.green(`✅ Proof received. Length: ${chalk.bold(proof.length)} bytes`));
    
    // Convert proof to hex for use with contracts
    const proofInHex = `0x${Buffer.from(proof, "base64").toString("hex")}`;
    
    console.log(chalk.yellow("\nProof details:"));
    console.log(chalk.cyan(`>  Base64 Proof: ${proof.substring(0, 40)}...${proof.substring(proof.length - 40)}`));
    console.log(chalk.cyan(`>  Hex Proof: ${proofInHex.substring(0, 42)}...${proofInHex.substring(proofInHex.length - 40)}`));
    
    // Validate the proof on t3rn chain
    console.log(chalk.blue("\n🧪 Validating proof on t3rn chain..."));
    
    try {
      // Connect to the t3rn network
      const t3rnProvider = new ethers.JsonRpcProvider(T3RN_RPC_URL);
      
      // Create contract instance
      const proverContract = new ethers.Contract(
        PROVER_CONTRACT_ADDRESS,
        PROVER_ABI,
        t3rnProvider
      );
      
      console.log(chalk.cyan(`>  Calling validateEvent on ${PROVER_CONTRACT_ADDRESS}`));
      console.log(chalk.cyan(`>  Using RPC: ${T3RN_RPC_URL}`));
      
      // Call the validateEvent function statically
      const [validatedChainId, emittingContract, topics, unindexedData] = await proverContract.validateEvent.staticCall(proofInHex);
      
      console.log(chalk.green("\n✅ Proof validation successful!"));
      console.log(chalk.yellow("Validation Results:"));
      console.log(chalk.cyan(`>  Validated Chain ID: ${validatedChainId}`));
      console.log(chalk.cyan(`>  Emitting Contract: ${emittingContract}`));
      
      // Display topics as separate items
      if (topics && topics.length > 0) {
        console.log(chalk.cyan(`>  Topics (hex): ${ethers.hexlify(topics)}`));
        
        // Try to parse topics from the bytes
        try {
          // Assuming topics follow standard Ethereum event topic format
          // We need to parse the topics bytes which might contain multiple 32-byte topics
          const topicsHex = ethers.hexlify(topics);
          const topicLength = 64; // 32 bytes in hex is 64 characters
          
          if (topicsHex.length > 2) { // More than just '0x'
            const topicsData = topicsHex.substring(2); // Remove '0x'
            const numTopics = Math.floor(topicsData.length / topicLength);
            
            console.log(chalk.cyan(`>  Number of Topics: ${numTopics}`));
            
            for (let i = 0; i < numTopics; i++) {
              const topicHex = '0x' + topicsData.substring(i * topicLength, (i + 1) * topicLength);
              console.log(chalk.cyan(`>    Topic ${i}: ${topicHex}`));
            }
            
            // Store the topics data for later use in event decoding
            const eventId = '0x' + topicsData.substring(0, 64);
            const eventDestination = '0x' + topicsData.substring(64, 72); // bytes4 = 4 bytes = 8 hex chars
          }
        } catch (error) {
          console.log(chalk.red(`>  Error parsing topics: ${error.message}`));
        }
      }
      
      if (unindexedData && unindexedData.length > 0) {
        console.log(chalk.cyan(`>  Unindexed Data (hex): ${ethers.hexlify(unindexedData)}`));
        
        // Try to parse the unindexed data as utf8 if it might be a string
        try {
          const dataString = ethers.toUtf8String(unindexedData);
          if (dataString && dataString.length > 0 && /^[\x20-\x7E]*$/.test(dataString)) {
            console.log(chalk.cyan(`>  Unindexed Data (utf8): ${dataString}`));
          }
        } catch (error) {
          // Ignore UTF-8 parsing errors as the data might not be a string
        }
        
        // Decode the OrderCreated event data
        console.log(chalk.blue("\n📊 Decoding OrderCreated event:"));
        
        // Extract indexed parameters from topics
        const topicsHex = ethers.hexlify(topics);
        const topicsData = topicsHex.substring(2); // Remove '0x'
        const id = topicsData.length >= 64 ? '0x' + topicsData.substring(0, 64) : 'Unknown';
        const destination = topicsData.length >= 72 ? '0x' + topicsData.substring(64, 72) : 'Unknown';
        
        // Decode non-indexed parameters from unindexedData
        // The unindexedData contains the remaining non-indexed parameters in the event
        try {
          // Define the parameter types for the non-indexed parameters
          const types = ['uint32', 'bytes32', 'uint256', 'address', 'uint256', 'uint256', 'uint32', 'address', 'uint256'];
          
          // ABI decode the unindexed data
          const unindexedHex = ethers.hexlify(unindexedData);
          
          // Create an interface to help us decode the data
          const iface = new ethers.Interface([
            "event OrderCreated(bytes32 indexed id, bytes4 indexed destination, uint32 asset, bytes32 targetAccount, uint256 amount, address rewardAsset, uint256 insurance, uint256 maxReward, uint32 nonce, address sourceAccount, uint256 orderTimestamp)"
          ]);
          
          // The actual decoding
          // We need to manually decode since the indexed parameters are in the topics
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            types,
            unindexedData
          );
          
          // Format and display all parameters
          console.log(chalk.yellow("Decoded Event Data:"));
          console.log(chalk.cyan(`>  id (indexed): ${id}`));
          console.log(chalk.cyan(`>  destination (indexed): ${destination}`));
          console.log(chalk.cyan(`>  asset: ${decoded[0]}`));
          console.log(chalk.cyan(`>  targetAccount: 0x${decoded[1].substring(2)}`)); // Format bytes32 as hex
          console.log(chalk.cyan(`>  amount: ${decoded[2]} (${ethers.formatEther(decoded[2])} ETH)`));
          console.log(chalk.cyan(`>  rewardAsset: ${decoded[3]}`));
          console.log(chalk.cyan(`>  insurance: ${decoded[4]} (${ethers.formatEther(decoded[4])} ETH)`));
          console.log(chalk.cyan(`>  maxReward: ${decoded[5]} (${ethers.formatEther(decoded[5])} ETH)`));
          console.log(chalk.cyan(`>  nonce: ${decoded[6]}`));
          console.log(chalk.cyan(`>  sourceAccount: ${decoded[7]}`));
          console.log(chalk.cyan(`>  orderTimestamp: ${decoded[8]} (${new Date(Number(decoded[8]) * 1000).toISOString()})`));
        } catch (error) {
          console.error(chalk.red("\n❌ Error decoding event data:"), error.message);
        }
      }
    } catch (error) {
      console.error(chalk.red("\n❌ Error validating proof:"), error.message);
      if (error.info) {
        console.error(chalk.red(">  Error details:"), error.info);
      }
    }
    
    console.log(chalk.green(`\n✅ Success! Proof validation and decoding complete.`));
    
    // Output original proof data for reference
    console.log(JSON.stringify({
      chainId: chainId,
      txHash: txHash,
      blockNumber: blockNumber,
      positionInBlock: positionInBlock,
      localLogIndex: localLogIndex,
      proofBase64: proof,
      proofHex: proofInHex
    }, null, 2));

  } catch (error) {
    console.error(chalk.red("❌ Error:"), error.message);
    if (error.response) {
      console.error(chalk.red("Response data:"), error.response.data);
    }
    process.exit(1);
  }
}

// Handle errors
process.on("unhandledRejection", (error) => {
  console.error(chalk.red("❌ Unhandled promise rejection:"), error);
});

main().catch((error) => {
  console.error(chalk.red("❌ Error:"), error);
  process.exit(1);
}); 