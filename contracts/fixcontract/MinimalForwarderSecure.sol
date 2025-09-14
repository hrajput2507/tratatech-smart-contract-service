// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title MinimalForwarderSecure
 * @dev Security-enhanced minimal forwarder to be used together with an ERC2771 compatible contract.
 * This implementation includes enhanced security measures for TrataTech gasless transactions.
 */
contract MinimalForwarderSecure is EIP712 {
    using ECDSA for bytes32;

    // ============ CONSTANTS ============

    // SECURITY: Gas validation constants to prevent various gas-related attacks
    uint256 public constant MIN_GAS_LIMIT = 21000; // Minimum gas for a transaction
    uint256 public constant MAX_GAS_LIMIT = 10000000; // Maximum gas to prevent DoS
    uint256 public constant GAS_BUFFER_RATIO = 64; // Conservative gas buffer (was 63)
    uint256 public constant MAX_DATA_SIZE = 100000; // Maximum data size to prevent spam
    uint256 public constant MAX_VALUE = 1000 ether; // Maximum value to prevent large value attacks

    // ============ CUSTOM ERRORS ============

    error InvalidSignature();
    error NonceAlreadyUsed(address user, uint256 nonce);
    error InvalidGasLimit(uint256 provided, uint256 min, uint256 max);
    error InsufficientGasProvided(uint256 gasLeft, uint256 required);
    error InvalidDataSize(uint256 size, uint256 max);
    error InvalidValue(uint256 value, uint256 max);
    error InvalidAddress(string parameter);
    error ExecutionFailed();
    error ReentrancyDetected();

    // ============ STRUCTS ============

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    // ============ STATE VARIABLES ============

    bytes32 private constant _TYPEHASH =
        keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)");

    mapping(address => uint256) private _nonces;

    // SECURITY: Reentrancy protection
    bool private _executing;

    // SECURITY: Track failed executions to prevent spam
    mapping(address => uint256) private _failedExecutions;
    uint256 public constant MAX_FAILED_EXECUTIONS = 10;

    // ============ EVENTS ============

    event MetaTransactionExecuted(
        address indexed from,
        address indexed to,
        bytes indexed dataHash,
        bool success,
        uint256 gasUsed
    );

    event InvalidExecution(
        address indexed from,
        address indexed to,
        string reason
    );

    // ============ CONSTRUCTOR ============

    constructor() EIP712("MinimalForwarderSecure", "2.0.0") {}

    // ============ VIEW FUNCTIONS ============

    function getNonce(address from) public view returns (uint256) {
        if (from == address(0)) {
            revert InvalidAddress("from");
        }
        return _nonces[from];
    }

    function getFailedExecutions(address from) public view returns (uint256) {
        return _failedExecutions[from];
    }

    // ============ VERIFICATION FUNCTIONS ============

    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        // SECURITY: Enhanced input validation
        if (req.from == address(0)) {
            return false;
        }
        if (req.to == address(0)) {
            return false;
        }
        if (req.gas < MIN_GAS_LIMIT || req.gas > MAX_GAS_LIMIT) {
            return false;
        }
        if (req.data.length > MAX_DATA_SIZE) {
            return false;
        }
        if (req.value > MAX_VALUE) {
            return false;
        }
        if (signature.length == 0) {
            return false;
        }

        // SECURITY: Check nonce hasn't been used
        if (_nonces[req.from] != req.nonce) {
            return false;
        }

        // SECURITY: Verify signature
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(_TYPEHASH, req.from, req.to, req.value, req.gas, req.nonce, keccak256(req.data)))
        );

        address signer = digest.recover(signature);
        return signer == req.from;
    }

    // ============ EXECUTION FUNCTIONS ============

    function execute(ForwardRequest calldata req, bytes calldata signature)
        public
        payable
        returns (bool, bytes memory)
    {
        // SECURITY: Reentrancy protection
        if (_executing) {
            revert ReentrancyDetected();
        }
        _executing = true;

        // SECURITY: Enhanced input validation
        _validateRequest(req);

        // SECURITY: Check failed execution limit
        if (_failedExecutions[req.from] >= MAX_FAILED_EXECUTIONS) {
            emit InvalidExecution(req.from, req.to, "Too many failed executions");
            _executing = false;
            revert ExecutionFailed();
        }

        // SECURITY: Verify signature
        if (!verify(req, signature)) {
            _failedExecutions[req.from]++;
            emit InvalidExecution(req.from, req.to, "Invalid signature");
            _executing = false;
            revert InvalidSignature();
        }

        // SECURITY: Update nonce before external call
        _nonces[req.from] = req.nonce + 1;

        // SECURITY: More conservative gas checking before execution
        uint256 gasBeforeExecution = gasleft();
        if (gasBeforeExecution < req.gas + (req.gas / GAS_BUFFER_RATIO)) {
            _failedExecutions[req.from]++;
            emit InvalidExecution(req.from, req.to, "Insufficient gas provided");
            _executing = false;
            revert InsufficientGasProvided(gasBeforeExecution, req.gas + (req.gas / GAS_BUFFER_RATIO));
        }

        // Execute the call with enhanced security
        (bool success, bytes memory returndata) = _executeCall(req);

        // SECURITY: Enhanced gas validation after execution
        uint256 gasAfterExecution = gasleft();
        uint256 gasUsed = gasBeforeExecution - gasAfterExecution;

        if (gasAfterExecution <= req.gas / GAS_BUFFER_RATIO) {
            // SECURITY: More conservative gas validation
            /// @solidity memory-safe-assembly
            assembly {
                invalid()
            }
        }

        // SECURITY: Track failed executions
        if (!success) {
            _failedExecutions[req.from]++;
        } else {
            // Reset counter on successful execution
            _failedExecutions[req.from] = 0;
        }

        emit MetaTransactionExecuted(req.from, req.to, keccak256(req.data), success, gasUsed);

        _executing = false;
        return (success, returndata);
    }

    // ============ INTERNAL FUNCTIONS ============

    function _validateRequest(ForwardRequest calldata req) private pure {
        if (req.from == address(0)) {
            revert InvalidAddress("from");
        }
        if (req.to == address(0)) {
            revert InvalidAddress("to");
        }
        if (req.gas < MIN_GAS_LIMIT || req.gas > MAX_GAS_LIMIT) {
            revert InvalidGasLimit(req.gas, MIN_GAS_LIMIT, MAX_GAS_LIMIT);
        }
        if (req.data.length > MAX_DATA_SIZE) {
            revert InvalidDataSize(req.data.length, MAX_DATA_SIZE);
        }
        if (req.value > MAX_VALUE) {
            revert InvalidValue(req.value, MAX_VALUE);
        }
    }

    function _executeCall(ForwardRequest calldata req) private returns (bool success, bytes memory returndata) {
        // SECURITY: Use call with explicit gas limit and value
        (success, returndata) = req.to.call{
            gas: req.gas,
            value: req.value
        }(abi.encodePacked(req.data, req.from));

        return (success, returndata);
    }

    // ============ BATCH EXECUTION ============

    function executeBatch(
        ForwardRequest[] calldata requests,
        bytes[] calldata signatures
    ) external payable returns (bool[] memory successes, bytes[] memory returndatas) {
        // SECURITY: Limit batch size to prevent DoS
        if (requests.length > 10) {
            revert InvalidValue(requests.length, 10);
        }
        if (requests.length != signatures.length) {
            revert InvalidValue(signatures.length, requests.length);
        }

        successes = new bool[](requests.length);
        returndatas = new bytes[](requests.length);

        for (uint256 i = 0; i < requests.length; i++) {
            try this.execute(requests[i], signatures[i]) returns (bool success, bytes memory returndata) {
                successes[i] = success;
                returndatas[i] = returndata;
            } catch {
                successes[i] = false;
                returndatas[i] = "";
            }
        }

        return (successes, returndatas);
    }

    // ============ ADMIN FUNCTIONS ============

    function resetFailedExecutions(address user) external {
        // SECURITY: Only allow users to reset their own counter or implement proper access control
        require(msg.sender == user, "Can only reset own failed executions");
        _failedExecutions[user] = 0;
    }

    // ============ VERSION FUNCTION ============

    function version() external pure returns (string memory) {
        return "2.0.0-secure";
    }
}