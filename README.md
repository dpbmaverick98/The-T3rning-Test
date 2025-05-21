# Polymer Order Processor

A cross-chain order processing system built on [Polymer](https://polymerlabs.org), enabling secure verification of order creation and completion events across EVM chains.

## Features

- Cross-chain order management using Polymer Protocol's Prover
- Support for multiple EVM chains (Optimism, Base, Mode, Bob, Ink, Unichain, t3rn)
- Secure order ID verification
- Confirmation ID validation
- Two-step order process (open → complete)

## Prerequisites

- Node.js (v18 or higher)
- `npm` or `yarn`
- A wallet with some testnet ETH on supported chains
- [Polymer API Key](https://docs.polymerlabs.org/docs/build/contact) for requesting cross-chain proofs

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/polymer-order-processor.git
   cd polymer-order-processor
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:

   - Copy `env.sample` to `.env`
   - Add your private key
   - Add RPC URLs for each chain
   - Polymer Prover addresses are already defined in the sample
   - Contract addresses will be automatically updated during deployment

## Deployment

### Deploy to All Chains

```bash
npm run deploy:order-processor:all
```

This will:
- Deploy the OrderProcessor contract to all supported chains sequentially
- Update contract addresses in `.env` automatically
- Show deployment progress and results

### Deploy to Specific Chain

```bash
npm run deploy:order-processor:optimism  # Deploy to Optimism Sepolia
npm run deploy:order-processor:base      # Deploy to Base Sepolia
npm run deploy:order-processor:mode      # Deploy to Mode Sepolia
npm run deploy:order-processor:bob       # Deploy to Bob Sepolia
npm run deploy:order-processor:ink       # Deploy to Ink Sepolia
npm run deploy:order-processor:unichain  # Deploy to Unichain Sepolia
npm run deploy:order-processor:t3rn      # Deploy to t3rn
```

## Order Processing Flow

1. **Create Order (Source Chain)**:
   - An `OrderCreated` event is emitted on the source chain
   - Event includes `id`, `destination`, `nonce`, and other order details

2. **Open Order (Destination Chain)**:
   - Call `openOrder(id, destination, nonce, proof)` on the OrderProcessor
   - Proof is obtained from Polymer API for the OrderCreated event
   - Order is validated and stored in OPEN state

3. **Complete Order (After fulfillment)**:
   - A `Confirmation` event is emitted on the source chain
   - Call `orderCompleted(id, target, confirmationId, proof)` on the OrderProcessor
   - Proof is obtained from Polymer API for the Confirmation event
   - Order is marked as COMPLETED and ready for reward claiming

## Contract Methods

### Key Functions

- `openOrder(bytes32 id, bytes4 destination, uint32 nonce, bytes proof)`: Process an order from a source chain
- `orderCompleted(bytes32 id, address target, bytes32 confirmationId, bytes proof)`: Complete an order using a Confirmation event proof
- `isOrderOpen(bytes32 id)`: Check if an order is open
- `isOrderCompleted(bytes32 id)`: Check if an order is completed
- `getOrderInfo(bytes32 id)`: Get detailed order information

### Helper Functions

- `generateIdFull(address requester, uint32 nonce, bytes4 networkId)`: Generate an order ID for verification
- `generateConfirmationId(bytes32 id, address target, uint256 amount, address asset, address sender)`: Generate a confirmation ID

## Networks

Currently supported networks:

- Optimism Sepolia
- Base Sepolia
- Mode Sepolia
- Bob Sepolia
- Ink Sepolia
- Unichain Sepolia
- t3rn (Chain ID: 334)

## License

This project is licensed under the MIT License.
