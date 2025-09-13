// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TrataTechForwarder
 * @dev Enhanced forwarder contract for TrataTech ecosystem with additional features:
 * - Access control and whitelisting
 * - Gas limits and rate limiting
 * - Emergency controls
 * - Analytics and monitoring
 * 
 * This forwarder is fully compatible with ERC-2771 standard and maintains
 * all existing functionality while adding enterprise-grade features.
 */
contract TrataTechForwarder is EIP712, Ownable, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
        uint256 deadline;
    }

    bytes32 private constant _TYPEHASH =
        keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data,uint256 deadline)");

    // Core storage
    mapping(address => uint256) private _nonces;
    
    // Enhanced features
    mapping(address => bool) public whitelistedTargets;
    mapping(address => bool) public whitelistedRelayers;
    mapping(address => uint256) public lastRequestTime;
    mapping(address => uint256) public requestCount;
    
    // Configuration
    uint256 public maxGasLimit = 5000000; // 5M gas limit
    uint256 public minGasLimit = 21000;   // Minimum gas for transfer
    uint256 public rateLimitPeriod = 3600; // 1 hour
    uint256 public maxRequestsPerPeriod = 100;
    bool public requireTargetWhitelist = false;
    bool public requireRelayerWhitelist = false;

    // Statistics
    uint256 public totalTransactions = 0;
    mapping(address => uint256) public userTransactionCount;
    mapping(address => uint256) public targetTransactionCount;

    // Events
    event MetaTransactionExecuted(
        address indexed from, 
        address indexed to, 
        bytes indexed data,
        bool success,
        uint256 gasUsed
    );
    
    event TargetWhitelisted(address indexed target, bool whitelisted);
    event RelayerWhitelisted(address indexed relayer, bool whitelisted);
    event ConfigurationUpdated(string parameter, uint256 value);
    event RateLimitExceeded(address indexed user, uint256 requestCount, uint256 timeWindow);

    constructor() EIP712("TrataTechForwarder", "1.0.0") Ownable(msg.sender) {}

    // ============ CORE FORWARDER FUNCTIONS ============

    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        // Verify deadline
        if (req.deadline != 0 && block.timestamp > req.deadline) {
            return false;
        }
        
        // Verify gas limits
        if (req.gas > maxGasLimit || req.gas < minGasLimit) {
            return false;
        }
        
        // Verify signature
        address signer = _hashTypedDataV4(
            keccak256(abi.encode(_TYPEHASH, req.from, req.to, req.value, req.gas, req.nonce, keccak256(req.data), req.deadline))
        ).recover(signature);
        
        return _nonces[req.from] == req.nonce && signer == req.from;
    }

    function execute(ForwardRequest calldata req, bytes calldata signature)
        public
        payable
        whenNotPaused
        nonReentrant
        returns (bool, bytes memory)
    {
        // Verify the request
        require(verify(req, signature), "TrataTechForwarder: Invalid signature or request");
        
        // Check target whitelist if enabled
        if (requireTargetWhitelist) {
            require(whitelistedTargets[req.to], "TrataTechForwarder: Target not whitelisted");
        }
        
        // Check relayer whitelist if enabled
        if (requireRelayerWhitelist) {
            require(whitelistedRelayers[msg.sender], "TrataTechForwarder: Relayer not whitelisted");
        }
        
        // Rate limiting check
        _checkRateLimit(req.from);
        
        // Update nonce
        _nonces[req.from] = req.nonce + 1;
        
        // Update statistics
        _updateStatistics(req.from, req.to);
        
        // Execute the call
        uint256 gasBeforeExecution = gasleft();
        (bool success, bytes memory returndata) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );
        uint256 gasUsed = gasBeforeExecution - gasleft();

        // Gas validation (same as MinimalForwarder)
        if (gasleft() <= req.gas / 63) {
            assembly {
                invalid()
            }
        }

        emit MetaTransactionExecuted(req.from, req.to, req.data, success, gasUsed);
        return (success, returndata);
    }

    // ============ BATCH EXECUTION ============

    function executeBatch(
        ForwardRequest[] calldata requests,
        bytes[] calldata signatures
    ) external payable whenNotPaused nonReentrant returns (bool[] memory, bytes[] memory) {
        require(requests.length == signatures.length, "TrataTechForwarder: Length mismatch");
        require(requests.length <= 10, "TrataTechForwarder: Batch too large");
        
        bool[] memory successes = new bool[](requests.length);
        bytes[] memory results = new bytes[](requests.length);
        
        for (uint256 i = 0; i < requests.length; i++) {
            (successes[i], results[i]) = execute(requests[i], signatures[i]);
        }
        
        return (successes, results);
    }

    // ============ ADMIN FUNCTIONS ============

    function setTargetWhitelist(address target, bool whitelisted) external onlyOwner {
        whitelistedTargets[target] = whitelisted;
        emit TargetWhitelisted(target, whitelisted);
    }

    function setRelayerWhitelist(address relayer, bool whitelisted) external onlyOwner {
        whitelistedRelayers[relayer] = whitelisted;
        emit RelayerWhitelisted(relayer, whitelisted);
    }

    function setRequireTargetWhitelist(bool required) external onlyOwner {
        requireTargetWhitelist = required;
        emit ConfigurationUpdated("requireTargetWhitelist", required ? 1 : 0);
    }

    function setRequireRelayerWhitelist(bool required) external onlyOwner {
        requireRelayerWhitelist = required;
        emit ConfigurationUpdated("requireRelayerWhitelist", required ? 1 : 0);
    }

    function setGasLimits(uint256 min, uint256 max) external onlyOwner {
        require(min < max && min >= 21000, "TrataTechForwarder: Invalid gas limits");
        minGasLimit = min;
        maxGasLimit = max;
        emit ConfigurationUpdated("gasLimits", max);
    }

    function setRateLimits(uint256 period, uint256 maxRequests) external onlyOwner {
        rateLimitPeriod = period;
        maxRequestsPerPeriod = maxRequests;
        emit ConfigurationUpdated("rateLimits", maxRequests);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ INTERNAL FUNCTIONS ============

    function _checkRateLimit(address user) internal {
        uint256 currentTime = block.timestamp;
        
        // Reset counter if enough time has passed
        if (currentTime > lastRequestTime[user] + rateLimitPeriod) {
            requestCount[user] = 0;
            lastRequestTime[user] = currentTime;
        }
        
        // Check rate limit
        if (requestCount[user] >= maxRequestsPerPeriod) {
            emit RateLimitExceeded(user, requestCount[user], rateLimitPeriod);
            require(false, "TrataTechForwarder: Rate limit exceeded");
        }
        
        requestCount[user]++;
    }

    function _updateStatistics(address from, address to) internal {
        totalTransactions++;
        userTransactionCount[from]++;
        targetTransactionCount[to]++;
    }

    // ============ VIEW FUNCTIONS ============

    function getUserStats(address user) external view returns (
        uint256 nonce,
        uint256 transactionCount,
        uint256 currentRequestCount,
        uint256 lastRequest
    ) {
        return (
            _nonces[user],
            userTransactionCount[user],
            requestCount[user],
            lastRequestTime[user]
        );
    }

    function getContractStats() external view returns (
        uint256 totalTxs,
        uint256 maxGas,
        uint256 minGas,
        bool targetWhitelistEnabled,
        bool relayerWhitelistEnabled
    ) {
        return (
            totalTransactions,
            maxGasLimit,
            minGasLimit,
            requireTargetWhitelist,
            requireRelayerWhitelist
        );
    }

    // ============ EMERGENCY FUNCTIONS ============

    function emergencyWithdraw(address payable to) external onlyOwner {
        require(to != address(0), "TrataTechForwarder: Invalid address");
        to.transfer(address(this).balance);
    }

    // Allow contract to receive ETH for gas sponsorship
    receive() external payable {}
}