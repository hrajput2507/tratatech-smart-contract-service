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
 * @title TrataTechOwnershipRegistryUpgradeable
 * @dev Upgradeable and gasless version of Ownership Registry Contract for managing NFT-linked digital deeds and transfer logic
 * @author Advanced Developer
 */
contract TrataTechOwnershipRegistryUpgradeable is 
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

    // ============ STATE VARIABLES ============
    
    uint256 private _deedIds;
    uint256 private _requestIds;

    // Mappings
    mapping(uint256 => OwnershipDeed) public ownershipDeeds;
    mapping(uint256 => TransferRequest) public transferRequests;
    mapping(uint256 => uint256) public passportToDeed;
    mapping(address => uint256[]) public ownerToDeeds;
    mapping(uint256 => RoyaltyInfo) public deedRoyalties;
    mapping(address => bool) public authorizedBrands;
    mapping(address => bool) public authorizedOperators;
    mapping(address => bool) public authorizedTransferAgents;
    
    // Reserved for future use
    uint256[50] private __gap;
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Transfer settings
    uint256 public transferApprovalPeriod;
    uint256 public maxTransferRequests;
    
    // Emergency controls
    bool public emergencyStop;

    // Duplicate gap removed
    
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
    
    event DeedLocked(
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

    // ============ MODIFIERS ============
    
    modifier onlyAuthorizedBrand() {
        require(authorizedBrands[_msgSender()] || _msgSender() == owner(), "Not authorized brand");
        _;
    }
    
    modifier onlyAuthorizedOperator() {
        require(authorizedOperators[_msgSender()] || _msgSender() == owner(), "Not authorized operator");
        _;
    }
    
    modifier onlyAuthorizedTransferAgent() {
        require(authorizedTransferAgents[_msgSender()] || _msgSender() == owner(), "Not authorized transfer agent");
        _;
    }
    
    modifier notEmergencyStopped() {
        require(!emergencyStop, "Contract is emergency stopped");
        _;
    }
    
    modifier validDeed(uint256 deedId) {
        require(ownershipDeeds[deedId].deedId != 0, "Ownership deed does not exist");
        require(ownershipDeeds[deedId].isValid, "Ownership deed is invalid");
        _;
    }
    
    modifier onlyDeedOwner(uint256 deedId) {
        require(ownershipDeeds[deedId].owner == _msgSender(), "Not deed owner");
        _;
    }
    
    modifier deedNotLocked(uint256 deedId) {
        require(!ownershipDeeds[deedId].isLocked || ownershipDeeds[deedId].lockExpiry < block.timestamp, "Deed is locked");
        _;
    }

    // ============ INITIALIZATION ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) {
        require(trustedForwarder != address(0), "TrataTech: Invalid trusted forwarder");
        _disableInitializers();
    }

    function initialize(address initialOwner, address trustedForwarder) public initializer {
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
        maxTransferRequests = 5;
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

    // ============ OWNERSHIP DEED MANAGEMENT ============
    
    function createOwnershipDeed(
        uint256 passportId,
        address owner,
        uint256 acquisitionPrice,
        string memory acquisitionMethod,
        string memory ipfsCID,
        string memory metadataHash,
        string[] memory additionalData
    ) external onlyAuthorizedBrand notEmergencyStopped nonReentrant {
        require(passportId > 0, "Invalid passport ID");
        require(owner != address(0), "Invalid owner address");
        require(bytes(acquisitionMethod).length > 0, "Acquisition method cannot be empty");
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        require(bytes(metadataHash).length > 0, "Metadata hash cannot be empty");
        require(passportToDeed[passportId] == 0, "Passport already has ownership deed");
        
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
        
        // Add additional data
        for (uint256 i = 0; i < additionalData.length; i += 2) {
            if (i + 1 < additionalData.length) {
                string memory key = additionalData[i];
                string memory value = additionalData[i + 1];
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
    ) external validDeed(deedId) onlyDeedOwner(deedId) deedNotLocked(deedId) notEmergencyStopped nonReentrant {
        require(to != address(0), "Invalid recipient address");
        require(to != _msgSender(), "Cannot transfer to self");
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        
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
        
        // Update deed
        deed.previousOwner = from;
        deed.owner = to;
        
        // Update mappings
        _removeDeedFromOwner(from, deedId);
        ownerToDeeds[to].push(deedId);
        
        // Transfer NFT
        _transfer(from, to, deedId);
        
        emit OwnershipDeedTransferred(deedId, from, to, transferPrice, transferType);
    }
    
    function lockDeed(uint256 deedId, uint256 lockDuration) external validDeed(deedId) onlyDeedOwner(deedId) {
        require(lockDuration > 0, "Lock duration must be greater than 0");
        require(lockDuration <= 365 days, "Lock duration cannot exceed 1 year");
        
        OwnershipDeed storage deed = ownershipDeeds[deedId];
        deed.isLocked = true;
        deed.lockExpiry = block.timestamp + lockDuration;
        
        emit DeedLocked(deedId, deed.lockExpiry, _msgSender());
    }
    
    function unlockDeed(uint256 deedId) external validDeed(deedId) onlyDeedOwner(deedId) {
        OwnershipDeed storage deed = ownershipDeeds[deedId];
        require(deed.isLocked, "Deed is not locked");
        require(deed.lockExpiry < block.timestamp, "Lock period not expired");
        
        deed.isLocked = false;
        deed.lockExpiry = 0;
        
        emit DeedUnlocked(deedId, _msgSender());
    }
    
    function forceUnlockDeed(uint256 deedId) external onlyAuthorizedOperator validDeed(deedId) {
        OwnershipDeed storage deed = ownershipDeeds[deedId];
        require(deed.isLocked, "Deed is not locked");
        
        deed.isLocked = false;
        deed.lockExpiry = 0;
        
        emit DeedUnlocked(deedId, _msgSender());
    }

    // ============ TRANSFER REQUEST MANAGEMENT ============
    
    function createTransferRequest(
        uint256 deedId,
        address to,
        uint256 proposedPrice,
        string memory transferReason
    ) external validDeed(deedId) deedNotLocked(deedId) notEmergencyStopped {
        require(to != address(0), "Invalid recipient address");
        require(to != _msgSender(), "Cannot transfer to self");
        require(bytes(transferReason).length > 0, "Transfer reason cannot be empty");
        
        // Check if there are too many pending requests using counter
        OwnershipDeed storage deed = ownershipDeeds[deedId];
        require(deed.pendingRequestCount < maxTransferRequests, "Too many pending transfer requests");
        
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
        
        // Increment pending request counter
        deed.pendingRequestCount++;
        
        emit TransferRequestCreated(requestId, deedId, _msgSender(), to, proposedPrice, TransferStatus.PENDING);
    }
    
    function approveTransferRequest(uint256 requestId) external validDeed(transferRequests[requestId].deedId) {
        TransferRequest storage request = transferRequests[requestId];
        require(request.requestId != 0, "Transfer request does not exist");
        require(request.status == TransferStatus.PENDING, "Request is not pending");
        require(request.expiryDate > block.timestamp, "Request has expired");
        require(request.from == _msgSender(), "Only current owner can approve");
        
        request.status = TransferStatus.APPROVED;
        request.isApproved = true;
        request.approver = _msgSender();
        
        // Decrement pending request counter
        OwnershipDeed storage deed = ownershipDeeds[request.deedId];
        deed.pendingRequestCount--;
        
        emit TransferRequestApproved(requestId, _msgSender());
    }
    
    function rejectTransferRequest(uint256 requestId, string memory reason) external validDeed(transferRequests[requestId].deedId) {
        TransferRequest storage request = transferRequests[requestId];
        require(request.requestId != 0, "Transfer request does not exist");
        require(request.status == TransferStatus.PENDING, "Request is not pending");
        require(request.from == _msgSender(), "Only current owner can reject");
        require(bytes(reason).length > 0, "Rejection reason cannot be empty");
        
        request.status = TransferStatus.REJECTED;
        
        // Decrement pending request counter
        OwnershipDeed storage deed = ownershipDeeds[request.deedId];
        deed.pendingRequestCount--;
        
        emit TransferRequestRejected(requestId, reason, _msgSender());
    }
    
    function executeTransferRequest(
        uint256 requestId,
        string memory ipfsCID
    ) external validDeed(transferRequests[requestId].deedId) notEmergencyStopped nonReentrant {
        TransferRequest storage request = transferRequests[requestId];
        require(request.requestId != 0, "Transfer request does not exist");
        require(request.status == TransferStatus.APPROVED, "Request is not approved");
        require(request.expiryDate > block.timestamp, "Request has expired");
        require(request.requester == _msgSender(), "Only requester can execute");
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        
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
        
        // Update deed
        deed.previousOwner = request.from;
        deed.owner = request.to;
        
        // Update mappings
        _removeDeedFromOwner(request.from, deedId);
        ownerToDeeds[request.to].push(deedId);
        
        // Transfer NFT
        _transfer(request.from, request.to, deedId);
        
        // Mark request as completed
        request.status = TransferStatus.APPROVED;
        
        emit OwnershipDeedTransferred(deedId, request.from, request.to, request.proposedPrice, TransferType.SECONDARY_SALE);
    }

    // ============ ROYALTY MANAGEMENT ============
    
    function setRoyalty(
        uint256 deedId,
        address recipient,
        uint256 percentage
    ) external validDeed(deedId) onlyDeedOwner(deedId) {
        require(recipient != address(0), "Invalid recipient address");
        require(percentage <= 1000, "Royalty percentage cannot exceed 10%");
        
        RoyaltyInfo storage royalty = deedRoyalties[deedId];
        royalty.recipient = recipient;
        royalty.percentage = percentage;
        royalty.isActive = true;
        
        emit RoyaltySet(deedId, recipient, percentage);
    }
    
    function disableRoyalty(uint256 deedId) external validDeed(deedId) onlyDeedOwner(deedId) {
        deedRoyalties[deedId].isActive = false;
    }

    // ============ ADMIN FUNCTIONS ============
    
    function authorizeBrand(address brand) external onlyOwner {
        require(brand != address(0), "Invalid address");
        authorizedBrands[brand] = true;
    }
    
    function authorizeOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid address");
        authorizedOperators[operator] = true;
    }
    
    function authorizeTransferAgent(address transferAgent) external onlyOwner {
        require(transferAgent != address(0), "Invalid address");
        authorizedTransferAgents[transferAgent] = true;
    }
    
    function revokeAuthorization(address target) external onlyOwner {
        authorizedBrands[target] = false;
        authorizedOperators[target] = false;
        authorizedTransferAgents[target] = false;
    }
    
    function setSettings(
        uint256 newApprovalPeriod,
        uint256 newMaxRequests
    ) external onlyOwner {
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
    
    // Fee withdrawal removed - no blockchain payments

    // ============ VIEW FUNCTIONS ============
    
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
    
    function getPendingTransferRequests(uint256 deedId) external view returns (uint256[] memory) {
        uint256[] memory pendingRequests = new uint256[](_requestIds);
        uint256 count = 0;
        
        for (uint256 i = 1; i < _requestIds; i++) {
            TransferRequest storage request = transferRequests[i];
            if (request.deedId == deedId && request.status == TransferStatus.PENDING) {
                pendingRequests[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = pendingRequests[i];
        }
        
        return result;
    }
    
    function getTotalDeeds() external view returns (uint256) {
        return _deedIds - 1;
    }
    
    function getTotalTransferRequests() external view returns (uint256) {
        return _requestIds - 1;
    }

    // ============ INTERNAL FUNCTIONS ============
    
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

    // ============ VERSION FUNCTION ============
    
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    // ============ RECEIVE FUNCTION ============
    
    // Receive function removed - no blockchain payments
}