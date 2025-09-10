// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./TrataTechSecurityEnhanced.sol";

/**
 * @title TrataTechProvenance_Fixed
 * @dev SECURITY-ENHANCED Provenance Contract for maintaining immutable logs of transfers and service history
 * @dev Fixed all critical vulnerabilities from security audit
 */
contract TrataTechProvenance_Fixed is AccessControl, ERC2771Context, Pausable, ReentrancyGuard {
    
    using ECDSA for bytes32;
    using TrataTechSecurityEnhanced for string;
    using TrataTechSecurityEnhanced for address;
    using TrataTechSecurityEnhanced for uint256;

    // ============ ROLES ============
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
    bytes32 public constant SERVICE_PROVIDER_ROLE = keccak256("SERVICE_PROVIDER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // ============ STRUCTS ============
    
    struct ProvenanceEntry {
        uint256 entryId;
        uint256 passportId;
        ProvenanceType entryType;
        address from;
        address to;
        uint256 timestamp;
        string location;
        string description;
        string ipfsCID;
        string metadataHash;
        bool isValid;
        address recorder;
        mapping(string => string) additionalData;
        string[] dataKeys;
    }

    struct ServiceRecord {
        uint256 serviceId;
        uint256 passportId;
        string serviceType;
        string serviceProvider;
        string serviceDescription;
        uint256 serviceDate;
        uint256 nextServiceDate;
        string ipfsCID;
        string certificateNumber;
        bool isValid;
        address serviceProviderAddress;
        mapping(string => string) serviceDetails;
        string[] detailKeys;
    }

    struct TransferHistory {
        uint256 passportId;
        uint256[] transferEntryIds;
        uint256[] serviceEntryIds;
        uint256 totalTransfers;
        uint256 totalServices;
        address currentOwner;
        uint256 lastTransferDate;
    }

    enum ProvenanceType {
        MANUFACTURING,
        TRANSFER,
        SERVICE,
        REPAIR,
        MAINTENANCE,
        INSPECTION,
        CERTIFICATION,
        RECALL,
        DISPOSAL,
        CUSTOM
    }

    // ============ STATE VARIABLES ============
    
    uint256 private _entryIds = 0;
    uint256 private _serviceIds = 0;

    // Mappings
    mapping(uint256 => ProvenanceEntry) public provenanceEntries;
    mapping(uint256 => ServiceRecord) public serviceRecords;
    mapping(uint256 => TransferHistory) public transferHistories;
    mapping(uint256 => uint256[]) public passportToEntries;
    mapping(uint256 => uint256[]) public passportToServices;
    
    // Security enhancements
    mapping(address => uint256) private _lastActionTime;
    mapping(uint256 => uint256) private _entryCreationTime;
    mapping(uint256 => uint256) private _serviceCreationTime;
    
    // Fee structure with limits
    uint256 public provenanceEntryFee = 0.001 ether;
    uint256 public serviceRecordFee = 0.002 ether;
    uint256 public constant MAX_FEE = 0.1 ether;
    
    // Circuit breakers
    bool public transfersEnabled = true;
    bool public serviceCreationEnabled = true;
    bool public batchOperationsEnabled = true;
    
    // Counters for monitoring
    uint256 public totalEntriesCreated;
    uint256 public totalServicesCreated;
    uint256 public totalFeesCollected;
    
    // ============ EVENTS ============
    
    event ProvenanceEntryCreated(
        uint256 indexed entryId,
        uint256 indexed passportId,
        ProvenanceType entryType,
        address indexed from,
        address to,
        string location,
        string ipfsCID
    );
    
    event ServiceRecordCreated(
        uint256 indexed serviceId,
        uint256 indexed passportId,
        string serviceType,
        string serviceProvider,
        string ipfsCID
    );
    
    event BatchOperationCompleted(uint256 entriesCreated, uint256 gasUsed);
    event CircuitBreakerTriggered(string operation, address triggeredBy);
    event SecurityViolationDetected(string violationType, address violator);
    event FeesWithdrawn(address recipient, uint256 amount);

    // ============ MODIFIERS ============
    
    modifier onlyAuthorizedRole(bytes32 role) {
        require(hasRole(role, msg.sender), "AccessControl: account missing role");
        _;
    }
    
    modifier rateLimited() {
        TrataTechSecurityEnhanced.checkRateLimit(_lastActionTime[msg.sender]);
        TrataTechSecurityEnhanced.updateRateLimit(msg.sender, _lastActionTime);
        _;
    }
    
    modifier whenTransfersEnabled() {
        require(transfersEnabled, "Transfers are disabled");
        _;
    }
    
    modifier whenServiceCreationEnabled() {
        require(serviceCreationEnabled, "Service creation is disabled");
        _;
    }
    
    modifier whenBatchOperationsEnabled() {
        require(batchOperationsEnabled, "Batch operations are disabled");
        _;
    }
    
    modifier validEntry(uint256 entryId) {
        require(provenanceEntries[entryId].entryId != 0, "Entry does not exist");
        require(provenanceEntries[entryId].isValid, "Entry is invalid");
        _;
    }

    // ============ CONSTRUCTOR ============
    
    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(RECORDER_ROLE, msg.sender);
        _grantRole(SERVICE_PROVIDER_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        _entryIds = 1;
        _serviceIds = 1;
    }

    // ============ PROVENANCE ENTRY MANAGEMENT ============
    
    /**
     * @dev Create a new provenance entry with comprehensive security checks
     */
    function createProvenanceEntry(
        uint256 passportId,
        ProvenanceType entryType,
        address from,
        address to,
        string memory location,
        string memory description,
        string memory ipfsCID,
        string memory metadataHash,
        string[] memory additionalData
    ) external 
      payable
      onlyAuthorizedRole(RECORDER_ROLE)
      whenNotPaused
      whenTransfersEnabled
      rateLimited
      nonReentrant 
    {
        // Process payment with automatic refund
        TrataTechSecurityEnhanced.processPaymentWithRefund(provenanceEntryFee);
        
        // Validate all inputs
        require(passportId > 0, "Invalid passport ID");
        TrataTechSecurityEnhanced.validateAddress(from);
        TrataTechSecurityEnhanced.validateAddress(to);
        TrataTechSecurityEnhanced.validateString(location);
        TrataTechSecurityEnhanced.validateString(description);
        TrataTechSecurityEnhanced.validateIPFSCID(ipfsCID);
        TrataTechSecurityEnhanced.validateString(metadataHash);
        TrataTechSecurityEnhanced.validateArraySize(additionalData.length);
        
        _entryIds++;
        uint256 entryId = _entryIds;
        
        ProvenanceEntry storage newEntry = provenanceEntries[entryId];
        newEntry.entryId = entryId;
        newEntry.passportId = passportId;
        newEntry.entryType = entryType;
        newEntry.from = from;
        newEntry.to = to;
        newEntry.timestamp = block.timestamp;
        newEntry.location = location;
        newEntry.description = description;
        newEntry.ipfsCID = ipfsCID;
        newEntry.metadataHash = metadataHash;
        newEntry.isValid = true;
        newEntry.recorder = msg.sender;
        
        // Process additional data with size validation
        TrataTechSecurityEnhanced.processKeyValuePairs(
            additionalData,
            newEntry.additionalData,
            newEntry.dataKeys
        );
        
        // Update mappings and history
        passportToEntries[passportId].push(entryId);
        _updateTransferHistory(passportId, entryId, to, entryType);
        
        // Update counters
        totalEntriesCreated++;
        totalFeesCollected += provenanceEntryFee;
        _entryCreationTime[entryId] = block.timestamp;
        
        emit ProvenanceEntryCreated(entryId, passportId, entryType, from, to, location, ipfsCID);
    }
    
    /**
     * @dev Create multiple provenance entries with enhanced security
     */
    function createBatchProvenanceEntries(
        uint256[] memory passportIds,
        ProvenanceType[] memory entryTypes,
        address[] memory froms,
        address[] memory tos,
        string[] memory locations,
        string[] memory descriptions,
        string[] memory ipfsCIDs,
        string[] memory metadataHashes
    ) external 
      payable
      onlyAuthorizedRole(RECORDER_ROLE)
      whenNotPaused
      whenBatchOperationsEnabled
      rateLimited
      nonReentrant 
    {
        uint256 batchSize = passportIds.length;
        TrataTechSecurityEnhanced.validateBatchSize(batchSize);
        
        // Validate array lengths match
        require(
            batchSize == entryTypes.length &&
            batchSize == froms.length &&
            batchSize == tos.length &&
            batchSize == locations.length &&
            batchSize == descriptions.length &&
            batchSize == ipfsCIDs.length &&
            batchSize == metadataHashes.length,
            "Array lengths must match"
        );
        
        uint256 totalCost = provenanceEntryFee * batchSize;
        TrataTechSecurityEnhanced.processPaymentWithRefund(totalCost);
        
        uint256 startGas = gasleft();
        uint256 entriesCreated = 0;
        
        for (uint256 i = 0; i < batchSize; i++) {
            _createSingleEntry(
                passportIds[i],
                entryTypes[i], 
                froms[i],
                tos[i],
                locations[i],
                descriptions[i],
                ipfsCIDs[i],
                metadataHashes[i]
            );
            entriesCreated++;
        }
        
        uint256 gasUsed = startGas - gasleft();
        totalFeesCollected += totalCost;
        
        emit BatchOperationCompleted(entriesCreated, gasUsed);
    }

    /**
     * @dev Internal function to create single entry with validation
     */
    function _createSingleEntry(
        uint256 passportId,
        ProvenanceType entryType,
        address from,
        address to,
        string memory location,
        string memory description,
        string memory ipfsCID,
        string memory metadataHash
    ) internal {
        require(passportId > 0, "Invalid passport ID");
        TrataTechSecurityEnhanced.validateAddress(from);
        TrataTechSecurityEnhanced.validateAddress(to);
        TrataTechSecurityEnhanced.validateString(location);
        TrataTechSecurityEnhanced.validateString(description);
        TrataTechSecurityEnhanced.validateIPFSCID(ipfsCID);
        TrataTechSecurityEnhanced.validateString(metadataHash);
        
        _entryIds++;
        uint256 entryId = _entryIds;
        
        ProvenanceEntry storage newEntry = provenanceEntries[entryId];
        newEntry.entryId = entryId;
        newEntry.passportId = passportId;
        newEntry.entryType = entryType;
        newEntry.from = from;
        newEntry.to = to;
        newEntry.timestamp = block.timestamp;
        newEntry.location = location;
        newEntry.description = description;
        newEntry.ipfsCID = ipfsCID;
        newEntry.metadataHash = metadataHash;
        newEntry.isValid = true;
        newEntry.recorder = msg.sender;
        
        passportToEntries[passportId].push(entryId);
        _updateTransferHistory(passportId, entryId, to, entryType);
        
        totalEntriesCreated++;
        _entryCreationTime[entryId] = block.timestamp;
        
        emit ProvenanceEntryCreated(entryId, passportId, entryType, from, to, location, ipfsCID);
    }

    // ============ SERVICE RECORD MANAGEMENT ============
    
    /**
     * @dev Create a service record with security enhancements
     */
    function createServiceRecord(
        uint256 passportId,
        string memory serviceType,
        string memory serviceProvider,
        string memory serviceDescription,
        uint256 serviceDate,
        uint256 nextServiceDate,
        string memory ipfsCID,
        string memory certificateNumber,
        string[] memory serviceDetails
    ) external 
      payable
      onlyAuthorizedRole(SERVICE_PROVIDER_ROLE)
      whenNotPaused
      whenServiceCreationEnabled
      rateLimited
      nonReentrant 
    {
        TrataTechSecurityEnhanced.processPaymentWithRefund(serviceRecordFee);
        
        // Validate inputs
        require(passportId > 0, "Invalid passport ID");
        TrataTechSecurityEnhanced.validateString(serviceType);
        TrataTechSecurityEnhanced.validateString(serviceProvider);
        TrataTechSecurityEnhanced.validateString(serviceDescription);
        TrataTechSecurityEnhanced.validateTimestamp(serviceDate);
        TrataTechSecurityEnhanced.validateDateRange(serviceDate, nextServiceDate);
        TrataTechSecurityEnhanced.validateIPFSCID(ipfsCID);
        TrataTechSecurityEnhanced.validateArraySize(serviceDetails.length);
        
        _serviceIds++;
        uint256 serviceId = _serviceIds;
        
        ServiceRecord storage newService = serviceRecords[serviceId];
        newService.serviceId = serviceId;
        newService.passportId = passportId;
        newService.serviceType = serviceType;
        newService.serviceProvider = serviceProvider;
        newService.serviceDescription = serviceDescription;
        newService.serviceDate = serviceDate;
        newService.nextServiceDate = nextServiceDate;
        newService.ipfsCID = ipfsCID;
        newService.certificateNumber = certificateNumber;
        newService.isValid = true;
        newService.serviceProviderAddress = msg.sender;
        
        // Process service details with validation
        TrataTechSecurityEnhanced.processKeyValuePairs(
            serviceDetails,
            newService.serviceDetails,
            newService.detailKeys
        );
        
        // Update mappings and history
        passportToServices[passportId].push(serviceId);
        _updateServiceHistory(passportId, serviceId);
        
        totalServicesCreated++;
        totalFeesCollected += serviceRecordFee;
        _serviceCreationTime[serviceId] = block.timestamp;
        
        emit ServiceRecordCreated(serviceId, passportId, serviceType, serviceProvider, ipfsCID);
    }

    // ============ ADMIN FUNCTIONS WITH SECURITY ============
    
    /**
     * @dev Set fees with validation and limits
     */
    function setFees(uint256 newProvenanceFee, uint256 newServiceFee) 
        external 
        onlyAuthorizedRole(ADMIN_ROLE) 
    {
        require(newProvenanceFee <= MAX_FEE, "Provenance fee too high");
        require(newServiceFee <= MAX_FEE, "Service fee too high");
        
        provenanceEntryFee = newProvenanceFee;
        serviceRecordFee = newServiceFee;
    }
    
    /**
     * @dev Emergency controls with role-based access
     */
    function toggleTransfers() external onlyRole(ADMIN_ROLE) {
        transfersEnabled = !transfersEnabled;
        emit CircuitBreakerTriggered("transfers", msg.sender);
    }
    
    function toggleServiceCreation() external onlyRole(ADMIN_ROLE) {
        serviceCreationEnabled = !serviceCreationEnabled;
        emit CircuitBreakerTriggered("service_creation", msg.sender);
    }
    
    function toggleBatchOperations() external onlyRole(ADMIN_ROLE) {
        batchOperationsEnabled = !batchOperationsEnabled;
        emit CircuitBreakerTriggered("batch_operations", msg.sender);
    }
    
    /**
     * @dev Secure fee withdrawal with reentrancy protection
     */
    function withdrawFees(address payable recipient) 
        external 
        onlyAuthorizedRole(ADMIN_ROLE) 
        nonReentrant 
    {
        TrataTechSecurityEnhanced.validateAddress(recipient);
        
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        // Use secure transfer
        bool success = TrataTechSecurityEnhanced.safeTransferETH(recipient, balance);
        require(success, "Transfer failed");
        
        emit FeesWithdrawn(recipient, balance);
    }
    
    /**
     * @dev Emergency pause
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ============ INTERNAL HELPER FUNCTIONS ============
    
    /**
     * @dev Update transfer history with validation
     */
    function _updateTransferHistory(
        uint256 passportId, 
        uint256 entryId, 
        address to, 
        ProvenanceType /* entryType */
    ) internal {
        TransferHistory storage history = transferHistories[passportId];
        
        if (history.passportId == 0) {
            history.passportId = passportId;
            history.totalTransfers = 0;
            history.totalServices = 0;
        }
        
        history.transferEntryIds.push(entryId);
        history.totalTransfers++;
        history.currentOwner = to;
        history.lastTransferDate = block.timestamp;
    }
    
    /**
     * @dev Update service history
     */
    function _updateServiceHistory(uint256 passportId, uint256 serviceId) internal {
        TransferHistory storage history = transferHistories[passportId];
        
        if (history.passportId == 0) {
            history.passportId = passportId;
            history.totalTransfers = 0;
            history.totalServices = 0;
        }
        
        history.serviceEntryIds.push(serviceId);
        history.totalServices++;
    }

    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get paginated entries to prevent DoS
     */
    function getPassportEntriesPaginated(
        uint256 passportId, 
        uint256 offset, 
        uint256 limit
    ) external view returns (uint256[] memory) {
        require(limit <= 50, "Limit too high"); // Prevent large data retrieval
        
        uint256[] storage allEntries = passportToEntries[passportId];
        uint256 totalEntries = allEntries.length;
        
        if (offset >= totalEntries) {
            return new uint256[](0);
        }
        
        uint256 end = offset + limit;
        if (end > totalEntries) {
            end = totalEntries;
        }
        
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allEntries[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get security metrics
     */
    function getSecurityMetrics() external view returns (
        uint256 totalEntries,
        uint256 totalServices,
        uint256 totalFees,
        bool transfersActive,
        bool servicesActive,
        bool batchActive
    ) {
        return (
            totalEntriesCreated,
            totalServicesCreated,
            totalFeesCollected,
            transfersEnabled,
            serviceCreationEnabled,
            batchOperationsEnabled
        );
    }

    // ============ RECEIVE FUNCTION ============
    
    receive() external payable {
        // Contract can receive ETH for fees
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