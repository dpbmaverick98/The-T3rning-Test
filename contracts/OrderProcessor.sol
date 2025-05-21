// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPolymerProver {
    function validateEvent(
        bytes calldata proof
    )
        external
        view
        returns (
            uint32 chainId,
            address emittingContract,
            bytes memory topics,
            bytes memory data
        );
}

contract OrderProcessor {
    // Order states
    enum OrderState { NONEXISTENT, OPEN, COMPLETED }
    
    // Minimal order info to store on-chain
    struct OrderInfo {
        OrderState state;
        address sourceAccount;
        bytes32 targetAccount;
        uint256 amount;
        address rewardAsset;
        bytes32 confirmationId;
        uint256 timestamp;
        uint32 nonce;         // Added nonce to recompute ID later
        bytes32 networkId;    // Changed from bytes4 to bytes32
    }
    
    // Polymer prover contract
    IPolymerProver public immutable polymerProver;
    
    // Authorized source contract addresses per chain ID
    mapping(uint32 => mapping(address => bool)) public authorizedContracts;
    
    // Mapping to track order states and info
    mapping(bytes32 => OrderInfo) public orders;
    
    // Event emitted when an order is opened successfully
    event OrderOpened(
        bytes32 indexed id,
        bytes32 indexed destination,
        uint32 asset,
        bytes32 targetAccount,
        uint256 amount,
        address rewardAsset,
        uint256 insurance,
        uint256 maxReward,
        uint32 nonce,
        address sourceAccount,
        uint256 orderTimestamp
    );
    
    // Event emitted when an order is completed
    event OrderCompleted(
        bytes32 indexed id,
        address indexed target,
        bytes32 confirmationId,
        uint256 amount,
        address asset,
        uint256 timestamp
    );
    
    // Event emitted when an order is ready to be reclaimed
    event ReclaimReady(
        bytes32 indexed id,
        address indexed sourceAccount,
        address rewardAsset,
        uint256 timestamp
    );
    
    constructor(address _polymerProver) {
        polymerProver = IPolymerProver(_polymerProver);
    }
    
    // Function to authorize source contracts
    function authorizeSourceContract(uint32 chainId, address contractAddress, bool authorized) external {
        // In production, this should be restricted to admin/owner
        authorizedContracts[chainId][contractAddress] = authorized;
    }
    
    /**
     * @notice Generate order ID for verification
     * @param requester Source account address
     * @param nonce Order nonce
     * @param networkId Network identifier
     * @return bytes32 Order ID
     */
    function generateIdFull(address requester, uint32 nonce, bytes32 networkId) public pure returns (bytes32) {
        return keccak256(abi.encode(keccak256(abi.encode(requester, nonce, networkId)), bytes32(0)));
    }
    
    /**
     * @notice Generate confirmation ID
     * @param id Order ID
     * @param target Target address
     * @param amount Transaction amount
     * @param asset Asset address
     * @param sender Confirmation sender
     * @return bytes32 Confirmation ID
     */
    function generateConfirmationId(
        bytes32 id, 
        address target, 
        uint256 amount, 
        address asset, 
        address sender
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(id, target, amount, asset, sender));
    }
    
    /**
     * @notice Process an order from a source chain using Polymer proof
     * @param proof Polymer proof of the OrderCreated event
     */
    function openOrder(bytes calldata proof) external {
        // Validate and decode the proof using Polymer's prover
        (
            ,  // sourceChainId (unused)
            ,  // sourceContract (unused)
            bytes memory topics,
            bytes memory unindexedData
        ) = polymerProver.validateEvent(proof);
        
        // Verify source contract is authorized - COMMENTED OUT FOR NOW
        // require(
        //     authorizedContracts[sourceChainId][sourceContract],
        //     "Unauthorized source contract"
        // );
        
        // Split concatenated topics into individual 32-byte values
        bytes32[] memory topicsArray = new bytes32[](3);  // [eventSig, id, destination]
        require(topics.length >= 96, "Invalid topics length"); // 3 * 32 bytes
        
        // Use assembly for efficient memory operations when splitting topics
        assembly {
            // Skip first 32 bytes (length prefix of bytes array)
            let topicsPtr := add(topics, 32)
            
            // Load each 32-byte topic into the array
            for { let i := 0 } lt(i, 3) { i := add(i, 1) } {
                mstore(
                    add(add(topicsArray, 32), mul(i, 32)),
                    mload(add(topicsPtr, mul(i, 32)))
                )
            }
        }
        
        // Verify this is the correct event type (OrderCreated event signature)
        bytes32 expectedSelector = keccak256(
            "OrderCreated(bytes32,bytes4,uint32,bytes32,uint256,address,uint256,uint256,uint32,address,uint256)"
        );
        require(topicsArray[0] == expectedSelector, "Invalid event signature");
        
        // Extract indexed parameters from topics
        bytes32 id = topicsArray[1];
        bytes32 destination = topicsArray[2];
        
        // Check if order state is nonexistent
        require(orders[id].state == OrderState.NONEXISTENT, "Order already exists");
        
        // Decode non-indexed event parameters
        (
            uint32 asset,
            bytes32 targetAccount,
            uint256 amount,
            address rewardAsset,
            uint256 insurance,
            uint256 maxReward,
            uint32 nonce,
            address sourceAccount,
            uint256 orderTimestamp
        ) = abi.decode(
            unindexedData, 
            (uint32, bytes32, uint256, address, uint256, uint256, uint32, address, uint256)
        );
        
        // Store order information
        orders[id] = OrderInfo({
            state: OrderState.OPEN,
            sourceAccount: sourceAccount,
            targetAccount: targetAccount,
            amount: amount,
            rewardAsset: rewardAsset,
            confirmationId: bytes32(0), // Will be set when completed
            timestamp: orderTimestamp,
            nonce: nonce,                     // Store nonce for later verification
            networkId: destination           // Store networkId for later verification, no conversion needed
        });
        
        // Emit event for successful order opening
        emit OrderOpened(
            id,
            destination,  // Use the full bytes32 destination without conversion
            asset,
            targetAccount,
            amount,
            rewardAsset,
            insurance,
            maxReward,
            nonce,
            sourceAccount,
            orderTimestamp
        );
        
        // Additional business logic for order processing would go here
        // ...
    }
    
    /**
     * @notice Complete an order using a Confirmation event proof
     * @param proof Polymer proof of the Confirmation event
     */
    function orderCompleted(bytes calldata proof) external {
        // Validate and decode the proof using Polymer's prover
        (
            ,  // sourceChainId (unused)
            ,  // sourceContract (unused)
            bytes memory topics,
            bytes memory unindexedData
        ) = polymerProver.validateEvent(proof);
        
        // Verify source contract is authorized - COMMENTED OUT FOR NOW
        // require(
        //     authorizedContracts[sourceChainId][sourceContract],
        //     "Unauthorized source contract"
        // );
        
        // Split concatenated topics into individual 32-byte values
        bytes32[] memory topicsArray = new bytes32[](4);  // [eventSig, id, target, sender]
        require(topics.length >= 128, "Invalid topics length"); // 4 * 32 bytes
        
        // Use assembly for efficient memory operations when splitting topics
        assembly {
            // Skip first 32 bytes (length prefix of bytes array)
            let topicsPtr := add(topics, 32)
            
            // Load each 32-byte topic into the array
            for { let i := 0 } lt(i, 4) { i := add(i, 1) } {
                mstore(
                    add(add(topicsArray, 32), mul(i, 32)),
                    mload(add(topicsPtr, mul(i, 32)))
                )
            }
        }
        
        // Verify this is the correct event type with correct signature
        // Format: "Confirmation(bytes32,address,uint256,address,address,bytes32,uint256)"
        // For indexed parameters: bytes32 indexed id, address indexed target, address indexed sender
        bytes32 expectedSelector = keccak256(
            "Confirmation(bytes32,address,uint256,address,address,bytes32,uint256)"
        );
        require(topicsArray[0] == expectedSelector, "Invalid event signature");
        
        // Extract indexed parameters from topics
        bytes32 id = topicsArray[1];           // id (indexed)
        address target = address(uint160(uint256(topicsArray[2]))); // target (indexed)
        // address sender = address(uint160(uint256(topicsArray[3]))); // sender (indexed)
        
        // Check if order exists and is in open state
        require(orders[id].state == OrderState.OPEN, "Order not in open state");
        
        // Get stored order info for verification
        OrderInfo storage order = orders[id];
        
        // Decode non-indexed event parameters:
        // uint256 amount, address asset, bytes32 confirmationId, uint256 timestamp
        (
            uint256 amount,
            address asset,
            bytes32 confirmationId,
            uint256 timestamp
        ) = abi.decode(
            unindexedData, 
            (uint256, address, bytes32, uint256)
        );
        
        // Verify the confirmation ID was correctly generated - COMMENTED OUT FOR TESTING
        // bytes32 generatedConfirmationId = generateConfirmationId(id, target, amount, asset, sender);
        // require(generatedConfirmationId == confirmationId, "Confirmation ID verification failed");
        
        // Verify that the stored order information is consistent with the confirmation
        require(order.amount == amount, "Amount mismatch between order and confirmation");
        
        // Update order information
        order.state = OrderState.COMPLETED;
        order.confirmationId = confirmationId;
        order.timestamp = timestamp; // Update with completion timestamp
        
        // Emit events for order completion and reclaim readiness
        emit OrderCompleted(
            id,
            target,
            confirmationId,
            amount,
            asset,
            timestamp
        );
        
        emit ReclaimReady(
            id,
            order.sourceAccount,
            order.rewardAsset,
            timestamp
        );
    }
    
    /**
     * @notice Check if an order is open
     * @param id Order ID to check
     * @return bool True if the order is open
     */
    function isOrderOpen(bytes32 id) external view returns (bool) {
        return orders[id].state == OrderState.OPEN;
    }
    
    /**
     * @notice Check if an order is completed
     * @param id Order ID to check
     * @return bool True if the order is completed
     */
    function isOrderCompleted(bytes32 id) external view returns (bool) {
        return orders[id].state == OrderState.COMPLETED;
    }
    
    /**
     * @notice Get order info
     * @param id Order ID
     * @return state Order state
     * @return sourceAccount Source account address
     * @return targetAccount Target account bytes32
     * @return amount Order amount
     * @return rewardAsset Reward asset address
     * @return confirmationId Confirmation ID (zero if not completed)
     * @return timestamp Order timestamp
     * @return nonce Order nonce
     * @return networkId Order network ID
     */
    function getOrderInfo(bytes32 id) external view returns (
        OrderState state,
        address sourceAccount,
        bytes32 targetAccount,
        uint256 amount,
        address rewardAsset,
        bytes32 confirmationId,
        uint256 timestamp,
        uint32 nonce,
        bytes32 networkId
    ) {
        OrderInfo storage order = orders[id];
        return (
            order.state,
            order.sourceAccount,
            order.targetAccount,
            order.amount,
            order.rewardAsset,
            order.confirmationId,
            order.timestamp,
            order.nonce,
            order.networkId
        );
    }
} 