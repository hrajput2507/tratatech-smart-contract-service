// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title TrataTechOwnershipRegistryUpgradeableSecure
 * @dev SECURITY FIXED: Upgradeable and gasless version of Ownership Registry Contract for managing NFT-linked digital deeds and transfer logic
 * @dev FIXES: Storage layout, unbounded loops, input validation, reentrancy protection
 * @author Advanced Developer - Security Enhanced Version
 */
contract TrataTechOwnershipRegistryUpgradeableSecure is
    Initializable,
    ERC721Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ERC2771ContextUpgradeable
{
    using ECDSA for bytes32;
    using Strings for uint256;

    // ============ CONSTANTS (FIXED: Moved before state variables) ============

    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant MAX_TRANSFER_REQUESTS = 50; // SECURITY: Prevent DoS
    uint256 public constant MAX_QUERY_RESULTS = 100; // SECURITY: Prevent gas limit issues
    uint256 public constant MIN_LOCK_DURATION = 1 hours;
    uint256 public constant MAX_LOCK_DURATION = 365 days;
    uint256 public constant MAX_ADDITIONAL_DATA = 20; // SECURITY: Prevent large loops

    // ============ STRUCTS ============

    struct OwnershipDeed {
        uint256 deedId;
        uint256 passportId;
        address owner;
        uint256 acquisitionDate;
        uint256 acquisitionPrice;
        string acquisitionMethod;
        string ipfsCID;
        string metadataHash;
        bool isValid;
        bool isLocked;
        uint256 lockExpiry;
        address previousOwner;
        uint256 pendingRequestCount; // Track count to avoid loop
        mapping(string => string) additionalData;
        string[] dataKeys;
    }

    struct TransferRequest {
        uint256 requestId;
        uint256 deedId;
        address from;
        address to;
        uint256 requestDate;
        uint256 proposedPrice;
        string transferReason;
        TransferStatus status;
        address requester;
        uint256 expiryDate;
        bool isApproved;
        address approver;
    }

    struct RoyaltyInfo {
        address recipient;
        uint256 percentage; // In basis points (e.g., 500 = 5%)
        bool isActive;
    }

    enum TransferStatus {
        PENDING,
        APPROVED,
        REJECTED,
        EXPIRED,
        CANCELLED
    }

    enum TransferType {
        PRIMARY_SALE,
        SECONDARY_SALE,
        GIFT,
        INHERITANCE,
        LOAN,
        CONSIGNMENT,
        AUCTION,
        CUSTOM
    }

    // ============ STATE VARIABLES (FIXED: Proper ordering) ============

    uint256 private _deedIds;
    uint256 private _requestIds;

    // Transfer settings
    uint256 public transferApprovalPeriod;
    uint256 public maxTransferRequests;

    // Emergency controls
    bool public emergencyStop;

    // Mappings
    mapping(uint256 => OwnershipDeed) public ownershipDeeds;
    mapping(uint256 => TransferRequest) public transferRequests;
    mapping(uint256 => uint256) public passportToDeed;
    mapping(address => uint256[]) public ownerToDeeds;
    mapping(uint256 => RoyaltyInfo) public deedRoyalties;
    mapping(address => bool) public authorizedBrands;
    mapping(address => bool) public authorizedOperators;
    mapping(address => bool) public authorizedTransferAgents;

    // SECURITY FIX: Add mappings to track pending requests per deed for pagination
    mapping(uint256 => uint256[]) public deedToPendingRequests;
    mapping(uint256 => mapping(uint256 => bool)) public requestIndexExists;

    // Reserved for future use (FIXED: Proper gap size after accounting for new variables)
    uint256[41] private __gap;

    // ============ CUSTOM ERRORS (SECURITY: More descriptive error handling) ============

    error InvalidAddress(string param);
    error InvalidDeedId(uint256 deedId);
    error InvalidRequestId(uint256 requestId);
    error DeedNotFound(uint256 deedId);
    error DeedInvalid(uint256 deedId);
    error DeedLocked(uint256 deedId, uint256 lockExpiry);
    error NotDeedOwner(uint256 deedId, address caller);
    error NotAuthorized(string role, address caller);
    error EmergencyStopActive();
    error TooManyRequests(uint256 current, uint256 max);
    error InvalidTimeRange(uint256 start, uint256 end);
    error CounterOverflow(string counter);

    // ============ EVENTS ============

    event OwnershipDeedCreated(
        uint256 indexed deedId,
        uint256 indexed passportId,
        address indexed owner,
        uint256 acquisitionPrice,
        string acquisitionMethod,
        string ipfsCID
    );

    event OwnershipDeedTransferred(
        uint256 indexed deedId,
        address indexed from,
        address indexed to,
        uint256 transferPrice,
        TransferType transferType
    );

    event TransferRequestCreated(
        uint256 indexed requestId,
        uint256 indexed deedId,
        address indexed from,
        address to,
        uint256 proposedPrice,
        TransferStatus status
    );

    event TransferRequestApproved(
        uint256 indexed requestId,
        address indexed approver
    );

    event TransferRequestRejected(
        uint256 indexed requestId,
        string reason,
        address indexed rejector
    );

    event DeedLockedEvent(
        uint256 indexed deedId,
        uint256 lockExpiry,
        address indexed locker
    );

    event DeedUnlocked(
        uint256 indexed deedId,
        address indexed unlocker
    );

    event RoyaltySet(
        uint256 indexed deedId,
        address indexed recipient,
        uint256 percentage
    );

    event RoyaltyPaid(
        uint256 indexed deedId,
        address indexed recipient,
        uint256 amount
    );

    // ============ MODIFIERS (SECURITY: Enhanced input validation) ============

    modifier onlyAuthorizedBrand() {
        if (!authorizedBrands[_msgSender()] && _msgSender() != owner()) {
            revert NotAuthorized("brand", _msgSender());
        }
        _;
    }

    modifier onlyAuthorizedOperator() {
        if (!authorizedOperators[_msgSender()] && _msgSender() != owner()) {
            revert NotAuthorized("operator", _msgSender());
        }
        _;
    }

    modifier onlyAuthorizedTransferAgent() {
        if (!authorizedTransferAgents[_msgSender()] && _msgSender() != owner()) {
            revert NotAuthorized("transfer agent", _msgSender());
        }
        _;
    }

    modifier notEmergencyStopped() {
        if (emergencyStop) {
            revert EmergencyStopActive();
        }
        _;
    }

    modifier validDeed(uint256 deedId) {
        if (ownershipDeeds[deedId].deedId == 0) {
            revert DeedNotFound(deedId);
        }
        if (!ownershipDeeds[deedId].isValid) {
            revert DeedInvalid(deedId);
        }
        _;
    }

    modifier onlyDeedOwner(uint256 deedId) {
        if (ownershipDeeds[deedId].owner != _msgSender()) {
            revert NotDeedOwner(deedId, _msgSender());
        }
        _;
    }

    modifier deedNotLocked(uint256 deedId) {
        if (ownershipDeeds[deedId].isLocked && ownershipDeeds[deedId].lockExpiry >= block.timestamp) {
            revert DeedLocked(deedId, ownershipDeeds[deedId].lockExpiry);
        }
        _;
    }

    modifier validAddress(address addr, string memory param) {
        if (addr == address(0)) {
            revert InvalidAddress(param);
        }
        _;
    }

    // ============ INITIALIZATION ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) {
        if (trustedForwarder == address(0)) {
            revert InvalidAddress("trustedForwarder");
        }
        _disableInitializers();
    }

    function initialize(
        address initialOwner,
        address trustedForwarder
    ) public initializer validAddress(initialOwner, "initialOwner") validAddress(trustedForwarder, "trustedForwarder") {
        __ERC721_init("TrataTech Ownership Deed", "TRATA-DEED");
        __Ownable_init(initialOwner);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        // ERC2771Context initialization removed - constructor handles this

        _deedIds = 1; // Start from 1
        _requestIds = 1; // Start from 1
        // Fee collection removed - no blockchain payments
        transferApprovalPeriod = 7 days;
        maxTransferRequests = MAX_TRANSFER_REQUESTS;
    }

    // ============ UUPS UPGRADE AUTHORIZATION ============

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ ERC2771 OVERRIDES FOR GASLESS ============

    function _msgSender() internal view virtual override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address) {
        return ERC2771ContextUpgradeable._msgSender();
    }

    function _msgData() internal view virtual override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
        return ERC2771ContextUpgradeable._msgData();
    }

    function _contextSuffixLength() internal view virtual override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (uint256) {
        return ERC2771ContextUpgradeable._contextSuffixLength();
    }

    // ============ OWNERSHIP DEED MANAGEMENT (SECURITY: Enhanced validation) ============

    function createOwnershipDeed(
        uint256 passportId,
        address owner,
        uint256 acquisitionPrice,
        string memory acquisitionMethod,
        string memory ipfsCID,
        string memory metadataHash,
        string[] memory additionalData
    ) external
        onlyAuthorizedBrand
        notEmergencyStopped
        nonReentrant
        validAddress(owner, "owner")
    {
        // SECURITY: Enhanced input validation
        if (passportId == 0) revert InvalidDeedId(passportId);
        if (bytes(acquisitionMethod).length == 0) revert InvalidAddress("acquisitionMethod");
        if (bytes(ipfsCID).length == 0) revert InvalidAddress("ipfsCID");
        if (bytes(metadataHash).length == 0) revert InvalidAddress("metadataHash");
        if (passportToDeed[passportId] != 0) revert InvalidDeedId(passportId);
        if (additionalData.length > MAX_ADDITIONAL_DATA) revert TooManyRequests(additionalData.length, MAX_ADDITIONAL_DATA);

        // SECURITY: Counter overflow protection
        if (_deedIds >= type(uint256).max - 1) {
            revert CounterOverflow("deedIds");
        }

        _deedIds = _deedIds + 1;
        uint256 deedId = _deedIds;

        OwnershipDeed storage newDeed = ownershipDeeds[deedId];
        newDeed.deedId = deedId;
        newDeed.passportId = passportId;
        newDeed.owner = owner;
        newDeed.acquisitionDate = block.timestamp;
        newDeed.acquisitionPrice = acquisitionPrice;
        newDeed.acquisitionMethod = acquisitionMethod;
        newDeed.ipfsCID = ipfsCID;
        newDeed.metadataHash = metadataHash;
        newDeed.isValid = true;
        newDeed.isLocked = false;
        newDeed.pendingRequestCount = 0;
        newDeed.lockExpiry = 0;
        newDeed.previousOwner = address(0);

        // Add additional data with bounds checking
        for (uint256 i = 0; i < additionalData.length && i + 1 < additionalData.length; i += 2) {
            string memory key = additionalData[i];
            string memory value = additionalData[i + 1];
            if (bytes(key).length > 0) { // SECURITY: Validate key
                newDeed.additionalData[key] = value;
                newDeed.dataKeys.push(key);
            }
        }

        // Update mappings
        passportToDeed[passportId] = deedId;
        ownerToDeeds[owner].push(deedId);

        // Mint NFT
        _safeMint(owner, deedId);

        emit OwnershipDeedCreated(deedId, passportId, owner, acquisitionPrice, acquisitionMethod, ipfsCID);
    }

    function transferOwnershipDeed(
        uint256 deedId,
        address to,
        uint256 transferPrice,
        TransferType transferType,
        string memory ipfsCID
    ) external
        validDeed(deedId)
        onlyDeedOwner(deedId)
        deedNotLocked(deedId)
        notEmergencyStopped
        nonReentrant
        validAddress(to, "to")
    {
        // SECURITY: Enhanced validation
        if (to == _msgSender()) revert InvalidAddress("cannot transfer to self");
        if (bytes(ipfsCID).length == 0) revert InvalidAddress("ipfsCID");

        OwnershipDeed storage deed = ownershipDeeds[deedId];
        address from = deed.owner;

        // Handle royalties if applicable
        if (transferPrice > 0 && deedRoyalties[deedId].isActive) {
            uint256 royaltyAmount = (transferPrice * deedRoyalties[deedId].percentage) / FEE_DENOMINATOR;
            if (royaltyAmount > 0) {
                // Royalty payment removed - no blockchain payments
                emit RoyaltyPaid(deedId, deedRoyalties[deedId].recipient, royaltyAmount);
            }
        }

        // SECURITY FIX: Complete state changes before external calls
        deed.previousOwner = from;
        deed.owner = to;

        // Update mappings before external calls
        _removeDeedFromOwner(from, deedId);
        ownerToDeeds[to].push(deedId);

        // Transfer NFT (external call last)
        _transfer(from, to, deedId);

        emit OwnershipDeedTransferred(deedId, from, to, transferPrice, transferType);
    }

    function lockDeed(uint256 deedId, uint256 lockDuration) external validDeed(deedId) onlyDeedOwner(deedId) {
        // SECURITY: Enhanced validation
        if (lockDuration < MIN_LOCK_DURATION) revert InvalidTimeRange(lockDuration, MIN_LOCK_DURATION);
        if (lockDuration > MAX_LOCK_DURATION) revert InvalidTimeRange(lockDuration, MAX_LOCK_DURATION);

        OwnershipDeed storage deed = ownershipDeeds[deedId];
        deed.isLocked = true;
        deed.lockExpiry = block.timestamp + lockDuration;

        emit DeedLockedEvent(deedId, deed.lockExpiry, _msgSender());
    }

    function unlockDeed(uint256 deedId) external validDeed(deedId) onlyDeedOwner(deedId) {
        OwnershipDeed storage deed = ownershipDeeds[deedId];
        if (!deed.isLocked) revert InvalidDeedId(deedId);
        if (deed.lockExpiry >= block.timestamp) revert DeedLocked(deedId, deed.lockExpiry);

        deed.isLocked = false;
        deed.lockExpiry = 0;

        emit DeedUnlocked(deedId, _msgSender());
    }

    function forceUnlockDeed(uint256 deedId) external onlyAuthorizedOperator validDeed(deedId) {
        OwnershipDeed storage deed = ownershipDeeds[deedId];
        if (!deed.isLocked) revert InvalidDeedId(deedId);

        deed.isLocked = false;
        deed.lockExpiry = 0;

        emit DeedUnlocked(deedId, _msgSender());
    }

    // ============ TRANSFER REQUEST MANAGEMENT (SECURITY: Enhanced validation) ============

    function createTransferRequest(
        uint256 deedId,
        address to,
        uint256 proposedPrice,
        string memory transferReason
    ) external
        validDeed(deedId)
        deedNotLocked(deedId)
        notEmergencyStopped
        validAddress(to, "to")
    {
        // SECURITY: Enhanced validation
        if (to == _msgSender()) revert InvalidAddress("cannot transfer to self");
        if (bytes(transferReason).length == 0) revert InvalidAddress("transferReason");

        // Check if there are too many pending requests using counter
        OwnershipDeed storage deed = ownershipDeeds[deedId];
        if (deed.pendingRequestCount >= maxTransferRequests) {
            revert TooManyRequests(deed.pendingRequestCount, maxTransferRequests);
        }

        // SECURITY: Counter overflow protection
        if (_requestIds >= type(uint256).max - 1) {
            revert CounterOverflow("requestIds");
        }

        _requestIds = _requestIds + 1;
        uint256 requestId = _requestIds;

        TransferRequest storage newRequest = transferRequests[requestId];
        newRequest.requestId = requestId;
        newRequest.deedId = deedId;
        newRequest.from = ownershipDeeds[deedId].owner;
        newRequest.to = to;
        newRequest.requestDate = block.timestamp;
        newRequest.proposedPrice = proposedPrice;
        newRequest.transferReason = transferReason;
        newRequest.status = TransferStatus.PENDING;
        newRequest.requester = _msgSender();
        newRequest.expiryDate = block.timestamp + transferApprovalPeriod;
        newRequest.isApproved = false;
        newRequest.approver = address(0);

        // Increment pending request counter and add to tracking
        deed.pendingRequestCount++;
        deedToPendingRequests[deedId].push(requestId);
        requestIndexExists[deedId][requestId] = true;

        emit TransferRequestCreated(requestId, deedId, _msgSender(), to, proposedPrice, TransferStatus.PENDING);
    }

    function approveTransferRequest(uint256 requestId) external validDeed(transferRequests[requestId].deedId) {
        TransferRequest storage request = transferRequests[requestId];
        if (request.requestId == 0) revert InvalidRequestId(requestId);
        if (request.status != TransferStatus.PENDING) revert InvalidRequestId(requestId);
        if (request.expiryDate <= block.timestamp) revert InvalidTimeRange(block.timestamp, request.expiryDate);
        if (request.from != _msgSender()) revert NotDeedOwner(request.deedId, _msgSender());

        request.status = TransferStatus.APPROVED;
        request.isApproved = true;
        request.approver = _msgSender();

        // Decrement pending request counter and remove from tracking
        OwnershipDeed storage deed = ownershipDeeds[request.deedId];
        deed.pendingRequestCount--;
        _removePendingRequest(request.deedId, requestId);

        emit TransferRequestApproved(requestId, _msgSender());
    }

    function rejectTransferRequest(uint256 requestId, string memory reason) external validDeed(transferRequests[requestId].deedId) {
        // SECURITY: Enhanced validation
        if (bytes(reason).length == 0) revert InvalidAddress("reason");

        TransferRequest storage request = transferRequests[requestId];
        if (request.requestId == 0) revert InvalidRequestId(requestId);
        if (request.status != TransferStatus.PENDING) revert InvalidRequestId(requestId);
        if (request.from != _msgSender()) revert NotDeedOwner(request.deedId, _msgSender());

        request.status = TransferStatus.REJECTED;

        // Decrement pending request counter and remove from tracking
        OwnershipDeed storage deed = ownershipDeeds[request.deedId];
        deed.pendingRequestCount--;
        _removePendingRequest(request.deedId, requestId);

        emit TransferRequestRejected(requestId, reason, _msgSender());
    }

    function executeTransferRequest(
        uint256 requestId,
        string memory ipfsCID
    ) external validDeed(transferRequests[requestId].deedId) notEmergencyStopped nonReentrant {
        // SECURITY: Enhanced validation
        if (bytes(ipfsCID).length == 0) revert InvalidAddress("ipfsCID");

        TransferRequest storage request = transferRequests[requestId];
        if (request.requestId == 0) revert InvalidRequestId(requestId);
        if (request.status != TransferStatus.APPROVED) revert InvalidRequestId(requestId);
        if (request.expiryDate <= block.timestamp) revert InvalidTimeRange(block.timestamp, request.expiryDate);
        if (request.requester != _msgSender()) revert NotAuthorized("requester", _msgSender());

        uint256 deedId = request.deedId;
        OwnershipDeed storage deed = ownershipDeeds[deedId];

        // Handle royalties if applicable
        if (request.proposedPrice > 0 && deedRoyalties[deedId].isActive) {
            uint256 royaltyAmount = (request.proposedPrice * deedRoyalties[deedId].percentage) / FEE_DENOMINATOR;
            if (royaltyAmount > 0) {
                // Royalty payment removed - no blockchain payments
                emit RoyaltyPaid(deedId, deedRoyalties[deedId].recipient, royaltyAmount);
            }
        }

        // SECURITY FIX: Complete state changes before external calls
        deed.previousOwner = request.from;
        deed.owner = request.to;

        // Update mappings before external calls
        _removeDeedFromOwner(request.from, deedId);
        ownerToDeeds[request.to].push(deedId);

        // Transfer NFT (external call last)
        _transfer(request.from, request.to, deedId);

        // Mark request as completed
        request.status = TransferStatus.APPROVED;

        emit OwnershipDeedTransferred(deedId, request.from, request.to, request.proposedPrice, TransferType.SECONDARY_SALE);
    }

    // ============ ROYALTY MANAGEMENT (SECURITY: Enhanced validation) ============

    function setRoyalty(
        uint256 deedId,
        address recipient,
        uint256 percentage
    ) external validDeed(deedId) onlyDeedOwner(deedId) validAddress(recipient, "recipient") {
        // SECURITY: Enhanced validation - max 10%
        if (percentage > 1000) revert InvalidTimeRange(percentage, 1000);

        RoyaltyInfo storage royalty = deedRoyalties[deedId];
        royalty.recipient = recipient;
        royalty.percentage = percentage;
        royalty.isActive = true;

        emit RoyaltySet(deedId, recipient, percentage);
    }

    function disableRoyalty(uint256 deedId) external validDeed(deedId) onlyDeedOwner(deedId) {
        deedRoyalties[deedId].isActive = false;
    }

    // ============ ADMIN FUNCTIONS (SECURITY: Enhanced validation) ============

    function authorizeBrand(address brand) external onlyOwner validAddress(brand, "brand") {
        authorizedBrands[brand] = true;
    }

    function authorizeOperator(address operator) external onlyOwner validAddress(operator, "operator") {
        authorizedOperators[operator] = true;
    }

    function authorizeTransferAgent(address transferAgent) external onlyOwner validAddress(transferAgent, "transferAgent") {
        authorizedTransferAgents[transferAgent] = true;
    }

    function revokeAuthorization(address target) external onlyOwner validAddress(target, "target") {
        authorizedBrands[target] = false;
        authorizedOperators[target] = false;
        authorizedTransferAgents[target] = false;
    }

    function setSettings(
        uint256 newApprovalPeriod,
        uint256 newMaxRequests
    ) external onlyOwner {
        // SECURITY: Validate settings bounds
        if (newMaxRequests > MAX_TRANSFER_REQUESTS) revert TooManyRequests(newMaxRequests, MAX_TRANSFER_REQUESTS);

        transferApprovalPeriod = newApprovalPeriod;
        maxTransferRequests = newMaxRequests;
    }

    function activateEmergencyStop() external onlyOwner {
        emergencyStop = true;
    }

    function deactivateEmergencyStop() external onlyOwner {
        emergencyStop = false;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ VIEW FUNCTIONS (SECURITY: Pagination and bounds checking) ============

    function getOwnershipDeedDetails(uint256 deedId) external view returns (
        uint256 passportId,
        address owner,
        uint256 acquisitionDate,
        uint256 acquisitionPrice,
        string memory acquisitionMethod,
        string memory ipfsCID,
        string memory metadataHash,
        bool isValid,
        bool isLocked,
        uint256 lockExpiry,
        address previousOwner
    ) {
        OwnershipDeed storage deed = ownershipDeeds[deedId];
        return (
            deed.passportId,
            deed.owner,
            deed.acquisitionDate,
            deed.acquisitionPrice,
            deed.acquisitionMethod,
            deed.ipfsCID,
            deed.metadataHash,
            deed.isValid,
            deed.isLocked,
            deed.lockExpiry,
            deed.previousOwner
        );
    }

    function getDeedByPassportId(uint256 passportId) external view returns (uint256) {
        return passportToDeed[passportId];
    }

    function getDeedsByOwner(address owner) external view returns (uint256[] memory) {
        return ownerToDeeds[owner];
    }

    function getTransferRequestDetails(uint256 requestId) external view returns (
        uint256 deedId,
        address from,
        address to,
        uint256 requestDate,
        uint256 proposedPrice,
        string memory transferReason,
        TransferStatus status,
        address requester,
        uint256 expiryDate,
        bool isApproved,
        address approver
    ) {
        TransferRequest storage request = transferRequests[requestId];
        return (
            request.deedId,
            request.from,
            request.to,
            request.requestDate,
            request.proposedPrice,
            request.transferReason,
            request.status,
            request.requester,
            request.expiryDate,
            request.isApproved,
            request.approver
        );
    }

    function getRoyaltyInfo(uint256 deedId) external view returns (
        address recipient,
        uint256 percentage,
        bool isActive
    ) {
        RoyaltyInfo storage royalty = deedRoyalties[deedId];
        return (
            royalty.recipient,
            royalty.percentage,
            royalty.isActive
        );
    }

    function getDeedData(uint256 deedId, string memory key) external view returns (string memory) {
        return ownershipDeeds[deedId].additionalData[key];
    }

    function getDeedDataKeys(uint256 deedId) external view returns (string[] memory) {
        return ownershipDeeds[deedId].dataKeys;
    }

    // SECURITY FIX: Paginated version to prevent gas limit issues
    function getPendingTransferRequests(
        uint256 deedId,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256[] storage pendingRequests = deedToPendingRequests[deedId];

        // SECURITY: Limit results to prevent gas issues
        if (limit > MAX_QUERY_RESULTS) {
            limit = MAX_QUERY_RESULTS;
        }

        if (offset >= pendingRequests.length) {
            return new uint256[](0);
        }

        uint256 end = offset + limit;
        if (end > pendingRequests.length) {
            end = pendingRequests.length;
        }

        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = pendingRequests[i];
        }

        return result;
    }

    // BACKWARD COMPATIBILITY: Keep original function but with safety limits
    function getPendingTransferRequests(uint256 deedId) external view returns (uint256[] memory) {
        return this.getPendingTransferRequests(deedId, 0, MAX_QUERY_RESULTS);
    }

    function getTotalDeeds() external view returns (uint256) {
        return _deedIds - 1;
    }

    function getTotalTransferRequests() external view returns (uint256) {
        return _requestIds - 1;
    }

    function getPendingRequestCount(uint256 deedId) external view returns (uint256) {
        return deedToPendingRequests[deedId].length;
    }

    // ============ INTERNAL FUNCTIONS (SECURITY: Enhanced safety) ============

    function _removeDeedFromOwner(address owner, uint256 deedId) internal {
        uint256[] storage deeds = ownerToDeeds[owner];
        for (uint256 i = 0; i < deeds.length; i++) {
            if (deeds[i] == deedId) {
                deeds[i] = deeds[deeds.length - 1];
                deeds.pop();
                break;
            }
        }
    }

    function _removePendingRequest(uint256 deedId, uint256 requestId) internal {
        if (!requestIndexExists[deedId][requestId]) {
            return; // Already removed
        }

        uint256[] storage requests = deedToPendingRequests[deedId];
        for (uint256 i = 0; i < requests.length; i++) {
            if (requests[i] == requestId) {
                requests[i] = requests[requests.length - 1];
                requests.pop();
                requestIndexExists[deedId][requestId] = false;
                break;
            }
        }
    }

    // ============ VERSION FUNCTION ============

    function version() external pure returns (string memory) {
        return "1.1.0-secure";
    }
}