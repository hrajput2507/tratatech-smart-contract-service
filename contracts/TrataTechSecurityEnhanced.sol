// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TrataTechSecurityEnhanced
 * @dev Enhanced security library with comprehensive validation and protection mechanisms
 * @author TrataTech Security Team
 */
library TrataTechSecurityEnhanced {
    
    // ============ CONSTANTS ============
    
    uint256 public constant MAX_ARRAY_SIZE = 10;
    uint256 public constant MAX_BATCH_SIZE = 5;
    uint256 public constant MIN_STRING_LENGTH = 1;
    uint256 public constant MAX_STRING_LENGTH = 256;
    uint256 public constant MAX_PERCENTAGE = 1000; // 10%
    uint256 public constant FEE_DENOMINATOR = 10000; // 100% = 10000 basis points
    uint256 public constant MIN_TIMELOCK = 1 days;
    uint256 public constant MAX_TIMELOCK = 30 days;
    uint256 public constant RATE_LIMIT_DURATION = 60; // 60 seconds
    
    // ============ ERRORS ============
    
    error ArrayTooLarge(uint256 size, uint256 maxSize);
    error InvalidStringLength(uint256 length);
    error InvalidAddress(address addr);
    error InvalidPercentage(uint256 percentage);
    error InvalidAmount(uint256 amount);
    error InvalidTimestamp(uint256 timestamp);
    error InvalidIPFSCID(string cid);
    error RateLimitExceeded(uint256 timeRemaining);
    error InsufficientPayment(uint256 sent, uint256 required);
    error RefundFailed(uint256 amount);
    
    // ============ EVENTS ============
    
    event ValidationPerformed(string validationType, bool success);
    event RateLimitApplied(address user, uint256 nextAllowedTime);
    event RefundProcessed(address recipient, uint256 amount);
    
    // ============ INPUT VALIDATION FUNCTIONS ============
    
    /**
     * @dev Validate array size to prevent DoS attacks
     * @param arrayLength Length of array to validate
     */
    function validateArraySize(uint256 arrayLength) internal pure {
        if (arrayLength > MAX_ARRAY_SIZE) {
            revert ArrayTooLarge(arrayLength, MAX_ARRAY_SIZE);
        }
    }
    
    /**
     * @dev Validate batch operation size
     * @param batchSize Size of batch operation
     */
    function validateBatchSize(uint256 batchSize) internal pure {
        if (batchSize > MAX_BATCH_SIZE) {
            revert ArrayTooLarge(batchSize, MAX_BATCH_SIZE);
        }
    }
    
    /**
     * @dev Validate string length
     * @param str String to validate
     */
    function validateString(string memory str) internal pure {
        uint256 length = bytes(str).length;
        if (length < MIN_STRING_LENGTH || length > MAX_STRING_LENGTH) {
            revert InvalidStringLength(length);
        }
    }
    
    /**
     * @dev Validate Ethereum address
     * @param addr Address to validate
     */
    function validateAddress(address addr) internal pure {
        if (addr == address(0)) {
            revert InvalidAddress(addr);
        }
    }
    
    /**
     * @dev Validate percentage (in basis points)
     * @param percentage Percentage to validate
     */
    function validatePercentage(uint256 percentage) internal pure {
        if (percentage > MAX_PERCENTAGE) {
            revert InvalidPercentage(percentage);
        }
    }
    
    /**
     * @dev Validate amount is greater than zero
     * @param amount Amount to validate
     */
    function validateAmount(uint256 amount) internal pure {
        if (amount == 0) {
            revert InvalidAmount(amount);
        }
    }
    
    /**
     * @dev Validate timestamp is not in the future
     * @param timestamp Timestamp to validate
     */
    function validateTimestamp(uint256 timestamp) internal view {
        if (timestamp > block.timestamp) {
            revert InvalidTimestamp(timestamp);
        }
    }
    
    /**
     * @dev Validate future timestamp
     * @param timestamp Timestamp to validate
     */
    function validateFutureTimestamp(uint256 timestamp) internal view {
        if (timestamp <= block.timestamp) {
            revert InvalidTimestamp(timestamp);
        }
    }
    
    /**
     * @dev Enhanced IPFS CID validation
     * @param cid IPFS CID to validate
     */
    function validateIPFSCID(string memory cid) internal pure {
        bytes memory cidBytes = bytes(cid);
        if (cidBytes.length < 46 || cidBytes.length > 90) {
            revert InvalidIPFSCID(cid);
        }
        
        // Check for valid IPFS CID prefixes
        bool validPrefix = false;
        if (cidBytes.length >= 2) {
            // Check for "Qm" prefix (CIDv0)
            if (cidBytes[0] == 0x51 && cidBytes[1] == 0x6D) {
                validPrefix = true;
            }
            // Check for base32 encoded CIDv1
            else if (cidBytes.length >= 59) {
                validPrefix = true;
            }
        }
        
        if (!validPrefix) {
            revert InvalidIPFSCID(cid);
        }
    }
    
    // ============ PAYMENT HANDLING FUNCTIONS ============
    
    /**
     * @dev Process payment with automatic refund for overpayment
     * @param requiredAmount Required payment amount
     */
    function processPaymentWithRefund(uint256 requiredAmount) internal {
        if (msg.value < requiredAmount) {
            revert InsufficientPayment(msg.value, requiredAmount);
        }
        
        // Refund excess payment
        if (msg.value > requiredAmount) {
            uint256 refund = msg.value - requiredAmount;
            (bool success, ) = payable(msg.sender).call{value: refund}("");
            if (!success) {
                revert RefundFailed(refund);
            }
            emit RefundProcessed(msg.sender, refund);
        }
    }
    
    /**
     * @dev Calculate fee amount
     * @param amount Base amount
     * @param feePercentage Fee percentage in basis points
     */
    function calculateFee(uint256 amount, uint256 feePercentage) internal pure returns (uint256) {
        return (amount * feePercentage) / FEE_DENOMINATOR;
    }
    
    // ============ RATE LIMITING FUNCTIONS ============
    
    /**
     * @dev Check and enforce rate limiting
     * @param lastActionTime User's last action timestamp
     */
    function checkRateLimit(uint256 lastActionTime) internal view {
        uint256 timeSinceLastAction = block.timestamp - lastActionTime;
        if (timeSinceLastAction < RATE_LIMIT_DURATION) {
            uint256 timeRemaining = RATE_LIMIT_DURATION - timeSinceLastAction;
            revert RateLimitExceeded(timeRemaining);
        }
    }
    
    /**
     * @dev Update rate limit timestamp
     * @param user User address
     * @param lastActionTimes Mapping to update
     */
    function updateRateLimit(address user, mapping(address => uint256) storage lastActionTimes) internal {
        lastActionTimes[user] = block.timestamp;
        emit RateLimitApplied(user, block.timestamp + RATE_LIMIT_DURATION);
    }
    
    // ============ ARRAY PROCESSING FUNCTIONS ============
    
    /**
     * @dev Process key-value pairs with size validation
     * @param keyValuePairs Array of key-value pairs (even indices = keys, odd = values)
     * @param dataStorage Storage mapping to update
     * @param keysArray Array to store keys
     */
    function processKeyValuePairs(
        string[] memory keyValuePairs,
        mapping(string => string) storage dataStorage,
        string[] storage keysArray
    ) internal {
        validateArraySize(keyValuePairs.length);
        
        for (uint256 i = 0; i < keyValuePairs.length; i += 2) {
            if (i + 1 < keyValuePairs.length) {
                string memory key = keyValuePairs[i];
                string memory value = keyValuePairs[i + 1];
                
                validateString(key);
                // Value can be empty, so no validation needed
                
                dataStorage[key] = value;
                keysArray.push(key);
            }
        }
    }
    
    // ============ ACCESS CONTROL FUNCTIONS ============
    
    /**
     * @dev Validate multiple role authorization
     * @param account Account to check
     * @param roles Array of role mappings
     */
    function validateMultipleRoles(
        address account,
        mapping(address => bool)[] storage roles
    ) internal view returns (bool) {
        for (uint256 i = 0; i < roles.length; i++) {
            if (roles[i][account]) {
                return true;
            }
        }
        return false;
    }
    
    // ============ EMERGENCY FUNCTIONS ============
    
    /**
     * @dev Safe ETH transfer with gas limit
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function safeTransferETH(address to, uint256 amount) internal returns (bool) {
        validateAddress(to);
        validateAmount(amount);
        
        (bool success, ) = payable(to).call{value: amount, gas: 2300}("");
        return success;
    }
    
    /**
     * @dev Calculate storage slot for upgradeable contracts
     * @param baseSlot Base storage slot
     * @param offset Offset from base
     */
    function calculateStorageSlot(bytes32 baseSlot, uint256 offset) internal pure returns (bytes32) {
        return bytes32(uint256(baseSlot) + offset);
    }
    
    // ============ UTILITY FUNCTIONS ============
    
    /**
     * @dev Generate unique ID with collision resistance
     * @param baseId Base ID
     * @param timestamp Current timestamp
     * @param sender Sender address
     */
    function generateUniqueId(
        uint256 baseId,
        uint256 timestamp,
        address sender
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(baseId, timestamp, sender, block.prevrandao));
    }
    
    /**
     * @dev Validate and process expiry date
     * @param issueDate Issue date
     * @param expiryDate Expiry date
     */
    function validateDateRange(uint256 issueDate, uint256 expiryDate) internal view {
        validateTimestamp(issueDate); // Issue date can't be future
        if (expiryDate <= issueDate) {
            revert InvalidTimestamp(expiryDate);
        }
    }
    
    /**
     * @dev Check if current time is within date range
     * @param startDate Start date
     * @param endDate End date
     */
    function isWithinDateRange(uint256 startDate, uint256 endDate) internal view returns (bool) {
        return block.timestamp >= startDate && block.timestamp <= endDate;
    }
}