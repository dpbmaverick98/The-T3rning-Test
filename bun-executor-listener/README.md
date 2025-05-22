# t3rn Cross-Chain Event Listener & Executor

This project provides a Bun-based TypeScript application to listen for events on the t3rn hub and execute cross-chain transactions using Polymer's Executor API.

## Prerequisites

*   [Bun](https://bun.sh/) installed on your system.
*   Node.js (Bun uses it for some package management tasks, usually comes with Bun).

## Setup

1.  **Clone the Repository (if applicable):**
    ```bash
    # If this project is in a Git repository
    # git clone <repository-url>
    # cd bun-executor-listener
    ```

2.  **Install Dependencies:**
    Open your terminal in the `bun-executor-listener` directory and run:
    ```bash
    bun install
    ```
    This will install `ethers` and other necessary packages.

3.  **Configure RPC Endpoints:**
    *   Open the `bun-executor-listener/config.ts` file.
    *   Locate the `HARDCODED_CONFIG` object.
    *   Inside the `chains` object, ensure the `rpcUrl` for each chain ID (e.g., `334` for t3rn, `84532` for Base Sepolia, `1301` for Unichain Sepolia) is correctly set to your desired RPC provider endpoint.
        ```typescript
        // Example snippet from config.ts
        const HARDCODED_CONFIG: ExecutorConfig = {
          chains: {
            // t3rn Testnet (Hub)
            334: {
              id: 334,
              name: 't3rn Testnet',
              rpcUrl: 'https://rpc.t3rn.io/', // <-- VERIFY/UPDATE THIS
            },
            // Base Sepolia (Spoke)
            84532: {
              id: 84532,
              name: 'Base Sepolia',
              rpcUrl: 'https://sepolia.base.org', // <-- VERIFY/UPDATE THIS
            },
            // Unichain Sepolia (Spoke)
            1301: {
              id: 1301,
              name: 'Unichain Sepolia',
              rpcUrl: 'https://rpc.sepolia.unichain', // <-- VERIFY/UPDATE THIS
            },
            // ... other chains
          },
        };
        ```

4.  **Configure Contract Addresses (if necessary):**
    *   Open `bun-executor-listener/contracts.ts`.
    *   Verify the contract addresses for the hub and spoke chains in the `contractConfig` object are correct for your target environment.
        ```typescript
        export const contractConfig: ContractEventConfig = {
          hub: {
            chain: config.chains[334]!,
            contract: {
              address: '0xBf822582b24a0227Dda5d665c1F56B5268D04444', // Hub contract address
              // ...
            }
          },
          spokes: {
            84532: { // Base Sepolia
              chain: config.chains[84532]!,
              contract: {
                address: '0xCEE0372632a37Ba4d0499D1E2116eCff3A17d3C3', // Base spoke contract
                // ...
              }
            },
            1301: { // Unichain Sepolia
              chain: config.chains[1301]!,
              contract: {
                address: '0x1cEAb5967E5f078Fa0FEC3DFfD0394Af1fEeBCC9', // Unichain spoke contract
                // ...
              }
            },
          }
        };
        ```

## Building the Project

While Bun can run TypeScript files directly, you can build the project (e.g., for type checking or creating distributable files, though not strictly necessary for running with `bun run`):

```bash
bun build ./listener.ts ./executor.ts --outdir ./dist
```
This command will compile `listener.ts` and `executor.ts` into JavaScript files in the `dist` directory.

## Running the Applications

You can run the listener and executor in separate terminal windows.

### 1. Listener (for t3rn Hub Events)

This script connects to the t3rn hub chain (defined by chain ID `334` in `config.ts`) and polls for `OrderOpened`, `OrderCompleted`, and `ReclaimReady` events. It then logs these events to the console.

To start the listener:

```bash
bun run listener.ts
```

### 2. Executor (for Unichain -> Base -> t3rn Transactions)

This script monitors specific spoke chains for events and uses Polymer's Executor API (`https://execute.testnet.polymer.zone/execute`) to trigger transactions on the t3rn hub contract.

*   It listens for `OrderCreated` events on the Unichain Sepolia spoke contract.
*   It listens for `Confirmation` events on the Base Sepolia spoke contract.
*   When an `OrderCreated` event on Unichain (filtered for Base as the destination) is detected, it calls `openOrder` on the t3rn hub via the Polymer Executor API.
*   When a corresponding `Confirmation` event is detected on Base, it calls `orderCompleted` on the t3rn hub via the Polymer Executor API.

**Disclaimer:** Currently, the executor is specifically configured to process transactions originating from **Unichain (for `OrderCreated`) and targeting Base (for `Confirmation`), ultimately interacting with t3rn.** The filtering for `OrderCreated` events specifically looks for a `destination` field indicating Base (currently configured as the hex string prefix `0x62617374` for "bast").

To start the executor:

```bash
bun run executor.ts
```

## Development

*   Modify `.ts` files as needed.
*   Bun provides fast reloading if you run scripts with `bun --watch <filename>.ts`.

## Project Structure

*   `config.ts`: Main application configuration (RPC URLs, etc.).
*   `contracts.ts`: Contract addresses, ABIs, and event/type definitions related to contracts.
*   `types.ts`: General TypeScript type definitions for configuration objects.
*   `listener.ts`: Script for listening to events on the t3rn Hub.
*   `executor.ts`: Script for orchestrating cross-chain interactions via Polymer Executor API.
*   `README.md`: This file.
