require("dotenv").config();
const hre = require("hardhat");
const chalk = require("chalk");

async function main() {
  console.log(chalk.yellow("📄 Deploying OrderProcessor contract..."));

  // Get the network and prover address
  const network = hre.network.name;
  
  // Get the prover address based on the network
  const proverAddressKey = `${network.toUpperCase()}_POLYMER_PROVER_ADDRESS`;
  let polymerProverAddress = process.env[proverAddressKey];
  
  // Fallback address for all chains - REPLACE WITH REAL ADDRESSES BEFORE PRODUCTION USE
  const fallbackProverAddress = "0xcDa03d74DEc5B24071D1799899B2e0653C24e5Fa";
  
  const fallbackAddresses = {
    optimismSepolia: fallbackProverAddress,
    baseSepolia: fallbackProverAddress,
    modeSepolia: fallbackProverAddress,
    bobSepolia: fallbackProverAddress,
    inkSepolia: fallbackProverAddress,
    unichainSepolia: fallbackProverAddress,
    t3rn: fallbackProverAddress
  };
  
  // Use fallback address if not set in environment
  if (!polymerProverAddress) {
    if (fallbackAddresses[network]) {
      polymerProverAddress = fallbackAddresses[network];
      console.log(chalk.yellow(`⚠️ Using fallback Polymer Prover address for ${network}: ${polymerProverAddress}`));
      console.log(chalk.yellow(`⚠️ Update your .env file with the correct address for production use.`));
    } else {
      throw new Error(`Missing Polymer Prover address for ${network} in .env. Please set ${proverAddressKey}.`);
    }
  }
  
  console.log(chalk.cyan(`Using Polymer Prover at: ${polymerProverAddress}`));

  // Deploy the contract
  const OrderProcessor = await hre.ethers.getContractFactory("OrderProcessor");
  const orderProcessor = await OrderProcessor.deploy(polymerProverAddress);
  await orderProcessor.waitForDeployment();

  const orderProcessorAddress = await orderProcessor.getAddress();
  console.log(chalk.green(`✅ OrderProcessor deployed to: ${orderProcessorAddress}`));

  // Output the updated environment variable
  const envKey = `${network.toUpperCase()}_ORDER_PROCESSOR_ADDRESS`;
  console.log(chalk.cyan(`Add to your .env file: ${envKey}=${orderProcessorAddress}`));
  
  // Verify the contract if not on a local network
  if (network !== "hardhat" && network !== "localhost") {
    console.log(chalk.yellow("Waiting for block confirmations before verification..."));
    // Wait for block confirmations to ensure the contract is deployed before verification
    await orderProcessor.deploymentTransaction().wait(5);
    
    console.log(chalk.yellow("Verifying contract on explorer..."));
    try {
      await hre.run("verify:verify", {
        address: orderProcessorAddress,
        constructorArguments: [polymerProverAddress],
      });
      console.log(chalk.green("✅ Contract verified successfully!"));
    } catch (error) {
      if (error.message.includes("Already Verified") || error.message.includes("already verified")) {
        console.log(chalk.green("✅ Contract already verified!"));
      } else if (error.message.includes("Explorer API not supported")) {
        console.log(chalk.yellow("⚠️ Contract verification not supported on this network."));
      } else {
        console.error(chalk.red("❌ Error during verification:"), error);
      }
    }
  }
  
  return orderProcessorAddress;
}

// Execute if run directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(chalk.red("❌ Error:"), error);
      process.exit(1);
    });
}

// Export for use in other scripts
module.exports = main; 