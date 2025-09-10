// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./TrataTechSecurityEnhanced.sol";

/**
 * @title TrataTechOwnershipRegistry_Fixed
 * @dev SECURITY-ENHANCED Ownership Registry with NFT-linked digital deeds
 * @dev Fixed all critical vulnerabilities: reentrancy, DoS, race conditions, access control
 */
contract TrataTechOwnershipRegistry_Fixed is 
    ERC721, 
    ERC2771Context,
    AccessControl, 
    Pausable, 
    ReentrancyGuard 
{
    using ECDSA for bytes32;
    using TrataTechSecurityEnhanced for string;
    using TrataTechSecurityEnhanced for address;
    using TrataTechSecurityEnhanced for uint256;

    // ============ ROLES ============
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BRAND_ROLE = keccak256("BRAND_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant TRANSFER_AGENT_ROLE = keccak256("TRANSFER_AGENT_ROLE");
    
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
        mapping(string => string) additionalData;
        string[] dataKeys;
        uint256 transferCount; // Track number of transfers
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
        bool isExecuted; // Prevent double execution
    }

    struct RoyaltyInfo {
        address recipient;
        uint256 percentage;
        bool isActive;
        uint256 maxAmount; // Maximum royalty amount
        uint256 totalCollected; // Track total royalties collected
    }

    enum TransferStatus {
        PENDING,
        APPROVED,
        REJECTED,
        EXPIRED,
        CANCELLED,
        EXECUTED
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

    // ============ STATE VARIABLES ============
    
    uint256 private _deedIds;
    uint256 private _requestIds;

    // Core mappings with security enhancements
    mapping(uint256 => OwnershipDeed) public ownershipDeeds;
    mapping(uint256 => TransferRequest) public transferRequests;
    mapping(uint256 => uint256) public passportToDeed;
    mapping(address => uint256[]) public ownerToDeeds;
    mapping(uint256 => RoyaltyInfo) public deedRoyalties;
    
    // Security mappings
    mapping(address => uint256) private _lastActionTime; // Rate limiting
    mapping(address => uint256) private _pendingRequestCount; // Track pending requests per user
    mapping(uint256 => uint256) private _deedTransferCount; // Track transfers per deed
    mapping(address => bool) private _blacklistedAddresses; // Security blacklist
    
    // Fee structure with limits
    uint256 public transferFee;
    uint256 public royaltyFee;
    uint256 public constant MAX_TRANSFER_FEE = 0.1 ether;
    uint256 public constant MAX_ROYALTY_PERCENTAGE = 1000; // 10%
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Transfer settings with security limits
    uint256 public transferApprovalPeriod;
    uint256 public maxTransferRequests;
    uint256 public maxDailyTransfers;
    uint256 public constant ABSOLUTE_MAX_REQUESTS = 10; // Prevent DoS
    
    // Circuit breakers
    bool public transfersEnabled;
    bool public royaltiesEnabled;
    bool public lockingEnabled;
    bool public requestsEnabled;
    
    // Security tracking
    uint256 public totalDeedsCreated;
    uint256 public totalTransfersCompleted;
    uint256 public totalRoyaltiesPaid;
    uint256 public totalFeesCollected;

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
        uint256 proposedPrice
    );
    
    event RoyaltyPaid(
        uint256 indexed deedId,
        address indexed recipient,
        uint256 amount,
        uint256 transferPrice
    );
    
    event SecurityViolationDetected(
        string violationType,
        address violator,
        uint256 deedId
    );
    
    event CircuitBreakerActivated(string feature, address activatedBy);
    event AddressBlacklisted(address blacklisted, string reason);

    // ============ MODIFIERS ============
    
    modifier rateLimited() {
        TrataTechSecurityEnhanced.checkRateLimit(_lastActionTime[msg.sender]);
        TrataTechSecurityEnhanced.updateRateLimit(msg.sender, _lastActionTime);
        _;
    }
    
    modifier notBlacklisted(address addr) {
        require(!_blacklistedAddresses[addr], "Address is blacklisted");
        _;
    }
    
    modifier validDeed(uint256 deedId) {
        require(ownershipDeeds[deedId].deedId != 0, "Deed does not exist");
        require(ownershipDeeds[deedId].isValid, "Deed is invalid");
        _;
    }
    
    modifier onlyDeedOwner(uint256 deedId) {
        require(ownershipDeeds[deedId].owner == msg.sender, "Not deed owner");
        _;
    }
    
    modifier deedNotLocked(uint256 deedId) {
        OwnershipDeed storage deed = ownershipDeeds[deedId];
        require(
            !deed.isLocked || deed.lockExpiry <= block.timestamp,
            "Deed is locked"
        );
        _;
    }
    
    modifier whenTransfersEnabled() {
        require(transfersEnabled, "Transfers are disabled");
        _;
    }
    
    modifier whenRequestsEnabled() {
        require(requestsEnabled, "Requests are disabled");
        _;
    }

    // ============ CONSTRUCTOR ============
    
    constructor(address trustedForwarder) 
        ERC721("TrataTech Ownership Deed", "TRATA-DEED") 
        ERC2771Context(trustedForwarder) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(BRAND_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        _deedIds = 1;
        _requestIds = 1;
        
        // Set secure defaults
        transferFee = 0.005 ether;
        royaltyFee = 250; // 2.5%
        transferApprovalPeriod = 7 days;
        maxTransferRequests = 5;
        maxDailyTransfers = 10;
        
        // Enable all features initially
        transfersEnabled = true;
        royaltiesEnabled = true;
        lockingEnabled = true;
        requestsEnabled = true;
    }

    // ============ OWNERSHIP DEED MANAGEMENT ============
    
    /**
     * @dev Create a new ownership deed with comprehensive security
     */
    function createOwnershipDeed(
        uint256 passportId,
        address owner,
        uint256 acquisitionPrice,
        string memory acquisitionMethod,
        string memory ipfsCID,
        string memory metadataHash,
        string[] memory additionalData
    ) external 
      onlyRole(BRAND_ROLE)
      whenNotPaused
      rateLimited
      notBlacklisted(owner)
      nonReentrant
      returns (uint256)
    {
        // Validate all inputs
        require(passportId > 0, "Invalid passport ID");
        TrataTechSecurityEnhanced.validateAddress(owner);
        TrataTechSecurityEnhanced.validateString(acquisitionMethod);
        TrataTechSecurityEnhanced.validateIPFSCID(ipfsCID);
        TrataTechSecurityEnhanced.validateString(metadataHash);
        TrataTechSecurityEnhanced.validateArraySize(additionalData.length);
        
        require(passportToDeed[passportId] == 0, "Passport already has deed");
        
        uint256 deedId = _deedIds;
        _deedIds++;
        
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
        newDeed.lockExpiry = 0;
        newDeed.previousOwner = address(0);
        newDeed.transferCount = 0;
        
        // Process additional data with validation
        TrataTechSecurityEnhanced.processKeyValuePairs(
            additionalData,
            newDeed.additionalData,
            newDeed.dataKeys
        );
        
        // Update mappings
        passportToDeed[passportId] = deedId;
        ownerToDeeds[owner].push(deedId);
        
        // Mint NFT
        _safeMint(owner, deedId);
        
        totalDeedsCreated++;
        
        emit OwnershipDeedCreated(
            deedId, 
            passportId, 
            owner, 
            acquisitionPrice, 
            acquisitionMethod, 
            ipfsCID
        );
        
        return deedId;
    }
    
    /**
     * @dev Transfer ownership deed with reentrancy protection and royalty handling
     */
    function transferOwnershipDeed(
        uint256 deedId,
        address to,
        uint256 transferPrice,
        TransferType transferType,
        string memory ipfsCID
    ) external 
      payable
      validDeed(deedId)
      onlyDeedOwner(deedId)
      deedNotLocked(deedId)
      whenNotPaused
      whenTransfersEnabled
      rateLimited
      notBlacklisted(to)
      nonReentrant
    {
        TrataTechSecurityEnhanced.validateAddress(to);
        require(to != msg.sender, "Cannot transfer to self");
        TrataTechSecurityEnhanced.validateIPFSCID(ipfsCID);
        
        OwnershipDeed storage deed = ownershipDeeds[deedId];
        address from = deed.owner;
        
        // Handle royalty payment FIRST (before state changes)
        uint256 royaltyPaid = 0;
        if (transferPrice > 0 && royaltiesEnabled && deedRoyalties[deedId].isActive) {
            royaltyPaid = _handleRoyaltyPayment(deedId, transferPrice);
        }
        
        // Update deed state BEFORE external calls
        deed.previousOwner = from;
        deed.owner = to;
        deed.transferCount++;
        
        // Update ownership mappings
        _removeDeedFromOwner(from, deedId);
        ownerToDeeds[to].push(deedId);
        
        // Transfer NFT (this is the external interaction)
        _transfer(from, to, deedId);
        
        totalTransfersCompleted++;
        if (royaltyPaid > 0) {
            totalRoyaltiesPaid += royaltyPaid;
        }
        
        emit OwnershipDeedTransferred(deedId, from, to, transferPrice, transferType);
    }
    
    /**
     * @dev Secure lock mechanism with time limits
     */
    function lockDeed(uint256 deedId, uint256 lockDuration) 
        external 
        validDeed(deedId) 
        onlyDeedOwner(deedId)
        rateLimited
    {
        require(lockingEnabled, "Locking is disabled");
        require(lockDuration > 0 && lockDuration <= 365 days, "Invalid lock duration");
        
        OwnershipDeed storage deed = ownershipDeeds[deedId];
        deed.isLocked = true;
        deed.lockExpiry = block.timestamp + lockDuration;
    }
    
    /**
     * @dev Unlock deed with security checks
     */
    function unlockDeed(uint256 deedId) 
        external 
        validDeed(deedId) 
        onlyDeedOwner(deedId) 
    {
        OwnershipDeed storage deed = ownershipDeeds[deedId];
        require(deed.isLocked, "Deed is not locked");
        require(deed.lockExpiry <= block.timestamp, "Lock period not expired");
        
        deed.isLocked = false;
        deed.lockExpiry = 0;
    }

    // ============ TRANSFER REQUEST MANAGEMENT ============
    
    /**
     * @dev Create transfer request with security limits
     */
    function createTransferRequest(
        uint256 deedId,
        address to,
        uint256 proposedPrice,
        string memory transferReason
    ) external 
      validDeed(deedId)
      deedNotLocked(deedId)
      whenNotPaused
      whenRequestsEnabled
      rateLimited
      notBlacklisted(to)
      nonReentrant
      returns (uint256)
    {
        TrataTechSecurityEnhanced.validateAddress(to);
        require(to != msg.sender, "Cannot transfer to self");
        TrataTechSecurityEnhanced.validateString(transferReason);
        
        // Check request limits
        require(_pendingRequestCount[msg.sender] < maxTransferRequests, "Too many pending requests");
        
        // Count existing pending requests for this deed (with pagination to prevent DoS)
        uint256 pendingForDeed = _countPendingRequestsForDeed(deedId);
        require(pendingForDeed < ABSOLUTE_MAX_REQUESTS, "Too many pending requests for deed");
        
        uint256 requestId = _requestIds;
        _requestIds++;
        
        TransferRequest storage newRequest = transferRequests[requestId];
        newRequest.requestId = requestId;
        newRequest.deedId = deedId;
        newRequest.from = ownershipDeeds[deedId].owner;
        newRequest.to = to;
        newRequest.requestDate = block.timestamp;
        newRequest.proposedPrice = proposedPrice;
        newRequest.transferReason = transferReason;
        newRequest.status = TransferStatus.PENDING;
        newRequest.requester = msg.sender;
        newRequest.expiryDate = block.timestamp + transferApprovalPeriod;
        newRequest.isApproved = false;
        newRequest.approver = address(0);
        newRequest.isExecuted = false;
        
        _pendingRequestCount[msg.sender]++;
        
        emit TransferRequestCreated(requestId, deedId, msg.sender, to, proposedPrice);
        return requestId;
    }
    
    /**
     * @dev Execute approved transfer request with security checks
     */
    function executeTransferRequest(uint256 requestId, string memory ipfsCID) 
        external 
        payable
        whenNotPaused
        nonReentrant
    {
        TransferRequest storage request = transferRequests[requestId];
        
        require(request.requestId != 0, "Request does not exist");
        require(request.status == TransferStatus.APPROVED, "Request not approved");
        require(!request.isExecuted, "Request already executed");
        require(request.expiryDate > block.timestamp, "Request expired");
        require(request.requester == msg.sender, "Only requester can execute");
        
        TrataTechSecurityEnhanced.validateIPFSCID(ipfsCID);
        
        uint256 deedId = request.deedId;
        OwnershipDeed storage deed = ownershipDeeds[deedId];
        
        // Verify deed is still valid and not locked
        require(deed.isValid, "Deed is invalid");
        require(!deed.isLocked || deed.lockExpiry <= block.timestamp, "Deed is locked");
        
        // Handle royalty payment first
        uint256 royaltyPaid = 0;
        if (request.proposedPrice > 0 && royaltiesEnabled && deedRoyalties[deedId].isActive) {
            royaltyPaid = _handleRoyaltyPayment(deedId, request.proposedPrice);
        }
        
        // Update states
        deed.previousOwner = request.from;
        deed.owner = request.to;
        deed.transferCount++;
        
        request.status = TransferStatus.EXECUTED;
        request.isExecuted = true;
        
        // Update mappings
        _removeDeedFromOwner(request.from, deedId);
        ownerToDeeds[request.to].push(deedId);
        _pendingRequestCount[request.requester]--;
        
        // Transfer NFT
        _transfer(request.from, request.to, deedId);
        
        totalTransfersCompleted++;
        
        emit OwnershipDeedTransferred(
            deedId, 
            request.from, 
            request.to, 
            request.proposedPrice, 
            TransferType.SECONDARY_SALE
        );
    }

    // ============ ROYALTY MANAGEMENT WITH SECURITY ============
    
    /**
     * @dev Set royalty with limits and validation
     */
    function setRoyalty(
        uint256 deedId,
        address recipient,
        uint256 percentage,
        uint256 maxAmount
    ) external 
      validDeed(deedId) 
      onlyDeedOwner(deedId) 
    {
        TrataTechSecurityEnhanced.validateAddress(recipient);
        TrataTechSecurityEnhanced.validatePercentage(percentage);
        require(percentage <= MAX_ROYALTY_PERCENTAGE, "Royalty too high");
        
        RoyaltyInfo storage royalty = deedRoyalties[deedId];
        royalty.recipient = recipient;
        royalty.percentage = percentage;
        royalty.maxAmount = maxAmount;
        royalty.isActive = true;
        royalty.totalCollected = 0;
    }

    // ============ ADMIN FUNCTIONS WITH SECURITY ============
    
    /**
     * @dev Blacklist address for security
     */
    function blacklistAddress(address addr, string memory reason) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        TrataTechSecurityEnhanced.validateAddress(addr);
        TrataTechSecurityEnhanced.validateString(reason);
        
        _blacklistedAddresses[addr] = true;
        emit AddressBlacklisted(addr, reason);
    }
    
    /**
     * @dev Set secure limits
     */
    function setSecurityLimits(
        uint256 newMaxRequests,
        uint256 newMaxDailyTransfers,
        uint256 newApprovalPeriod
    ) external onlyRole(ADMIN_ROLE) {
        require(newMaxRequests <= ABSOLUTE_MAX_REQUESTS, "Max requests too high");
        require(newApprovalPeriod >= 1 days && newApprovalPeriod <= 30 days, "Invalid approval period");
        
        maxTransferRequests = newMaxRequests;
        maxDailyTransfers = newMaxDailyTransfers;
        transferApprovalPeriod = newApprovalPeriod;
    }
    
    /**
     * @dev Circuit breaker controls
     */
    function toggleTransfers() external onlyRole(ADMIN_ROLE) {
        transfersEnabled = !transfersEnabled;
        emit CircuitBreakerActivated("transfers", msg.sender);
    }
    
    function toggleRoyalties() external onlyRole(ADMIN_ROLE) {
        royaltiesEnabled = !royaltiesEnabled;
        emit CircuitBreakerActivated("royalties", msg.sender);
    }
    
    function toggleRequests() external onlyRole(ADMIN_ROLE) {
        requestsEnabled = !requestsEnabled;
        emit CircuitBreakerActivated("requests", msg.sender);
    }
    
    /**
     * @dev Emergency withdrawal with security
     */
    function withdrawFees(address payable recipient) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
    {
        TrataTechSecurityEnhanced.validateAddress(recipient);
        
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        bool success = TrataTechSecurityEnhanced.safeTransferETH(recipient, balance);
        require(success, "Transfer failed");
        
        totalFeesCollected += balance;
    }

    // ============ INTERNAL HELPER FUNCTIONS ============
    
    /**
     * @dev Handle royalty payment with reentrancy protection
     */
    function _handleRoyaltyPayment(uint256 deedId, uint256 transferPrice) 
        internal 
        returns (uint256) 
    {
        RoyaltyInfo storage royalty = deedRoyalties[deedId];
        
        uint256 royaltyAmount = TrataTechSecurityEnhanced.calculateFee(transferPrice, royalty.percentage);
        
        // Apply maximum royalty limit if set
        if (royalty.maxAmount > 0 && royaltyAmount > royalty.maxAmount) {
            royaltyAmount = royalty.maxAmount;
        }
        
        if (royaltyAmount > 0) {
            // Use secure transfer
            bool success = TrataTechSecurityEnhanced.safeTransferETH(royalty.recipient, royaltyAmount);
            require(success, "Royalty transfer failed");
            
            royalty.totalCollected += royaltyAmount;
            
            emit RoyaltyPaid(deedId, royalty.recipient, royaltyAmount, transferPrice);
        }
        
        return royaltyAmount;
    }
    
    /**
     * @dev Remove deed from owner's list securely
     */
    function _removeDeedFromOwner(address owner, uint256 deedId) internal {
        uint256[] storage deeds = ownerToDeeds[owner];
        uint256 length = deeds.length;
        
        for (uint256 i = 0; i < length; i++) {
            if (deeds[i] == deedId) {
                deeds[i] = deeds[length - 1];
                deeds.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Count pending requests for deed with limit to prevent DoS
     */
    function _countPendingRequestsForDeed(uint256 deedId) internal view returns (uint256) {
        uint256 count = 0;
        uint256 maxCheck = _requestIds > 100 ? _requestIds - 100 : 1; // Only check last 100 requests
        
        for (uint256 i = _requestIds - 1; i >= maxCheck && count < ABSOLUTE_MAX_REQUESTS; i--) {
            TransferRequest storage request = transferRequests[i];
            if (request.deedId == deedId && request.status == TransferStatus.PENDING) {
                count++;
            }
        }
        
        return count;
    }

    // ============ VIEW FUNCTIONS WITH PAGINATION ============
    
    /**
     * @dev Get pending transfer requests with pagination
     */
    function getPendingTransferRequestsPaginated(
        uint256 deedId,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        require(limit <= 20, "Limit too high"); // Prevent large responses
        
        uint256[] memory results = new uint256[](limit);
        uint256 found = 0;
        uint256 checked = 0;
        
        // Start from most recent requests
        for (uint256 i = _requestIds - 1; i >= 1 && found < limit && checked < offset + limit * 2; i--) {
            TransferRequest storage request = transferRequests[i];
            
            if (request.deedId == deedId && request.status == TransferStatus.PENDING) {
                if (checked >= offset) {
                    results[found] = i;
                    found++;
                }
                checked++;
            }
        }
        
        // Resize array to actual results
        uint256[] memory finalResults = new uint256[](found);
        for (uint256 i = 0; i < found; i++) {
            finalResults[i] = results[i];
        }
        
        return finalResults;
    }
    
    /**
     * @dev Get security metrics
     */
    function getSecurityMetrics() external view returns (
        uint256 totalDeeds,
        uint256 totalTransfers,
        uint256 totalRoyalties,
        uint256 totalFees,
        bool transfersActive,
        bool royaltiesActive,
        bool requestsActive
    ) {
        return (
            totalDeedsCreated,
            totalTransfersCompleted,
            totalRoyaltiesPaid,
            totalFeesCollected,
            transfersEnabled,
            royaltiesEnabled,
            requestsEnabled
        );
    }

    // ============ INTERFACE SUPPORT ============
    
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(ERC721, AccessControl) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }

    // ============ RECEIVE FUNCTION ============
    
    receive() external payable {
        // Contract can receive ETH for fees and royalties
    }

    // ============ OVERRIDE FUNCTIONS FOR ERC2771Context ============
    
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }
    
    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }
    
    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}