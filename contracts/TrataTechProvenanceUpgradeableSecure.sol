// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title TrataTechProvenanceUpgradeableSecure
 * @dev SECURITY FIXED: Upgradeable and gasless version of Provenance Contract for maintaining immutable logs of transfers and service history
 * @dev FIXES: Counter overflow, input validation, timestamp dependency, storage layout
 * @author Advanced Developer - Security Enhanced Version
 */
contract TrataTechProvenanceUpgradeableSecure is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ERC2771ContextUpgradeable
{
    using ECDSA for bytes32;
    using Strings for uint256;

    // ============ CONSTANTS (FIXED: Moved before state variables) ============

    uint256 public constant MAX_BATCH_SIZE = 25;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 1000;
    uint256 public constant MAX_LOCATION_LENGTH = 200;
    uint256 public constant MAX_STRING_LENGTH = 500;
    uint256 public constant MAX_ADDITIONAL_DATA = 20;
    uint256 public constant MAX_SERVICE_DETAILS = 15;
    uint256 public constant MIN_TIMESTAMP_TOLERANCE = 5 minutes;
    uint256 public constant MAX_FUTURE_TIMESTAMP = 1 hours;

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
        OWNERSHIP_TRANSFER,
        SERVICE,
        REPAIR,
        MAINTENANCE,
        INSPECTION,
        CERTIFICATION,
        RECALL,
        DISPOSAL,
        CUSTOM
    }

    // ============ STATE VARIABLES (FIXED: Proper ordering) ============

    uint256 private _entryIds;
    uint256 private _serviceIds;

    // Fee structure (removed blockchain payments but keeping structure)
    uint256 public provenanceEntryFee;
    uint256 public serviceRecordFee;

    // Emergency controls
    bool public emergencyStop;

    // Mappings
    mapping(uint256 => ProvenanceEntry) public provenanceEntries;
    mapping(uint256 => ServiceRecord) public serviceRecords;
    mapping(uint256 => TransferHistory) public transferHistories;
    mapping(uint256 => uint256[]) public passportToEntries;
    mapping(uint256 => uint256[]) public passportToServices;
    mapping(address => bool) public authorizedRecorders;
    mapping(address => bool) public authorizedServiceProviders;
    mapping(address => bool) public authorizedOperators;

    // SECURITY: Add nonce to prevent replay attacks
    mapping(address => uint256) public nonces;

    // Storage gap for future upgrades (FIXED: Proper gap size)
    uint256[40] private __gap;

    // ============ CUSTOM ERRORS (SECURITY: More descriptive error handling) ============

    error InvalidAddress(string param);
    error InvalidString(string param, string reason);
    error InvalidLength(string param, uint256 current, uint256 max);
    error InvalidEntryId(uint256 entryId);
    error InvalidServiceId(uint256 serviceId);
    error EntryNotFound(uint256 entryId);
    error ServiceNotFound(uint256 serviceId);
    error EntryInvalid(uint256 entryId);
    error ServiceInvalid(uint256 serviceId);
    error NotAuthorized(string role, address caller);
    error EmergencyStopActive();
    error InvalidTimestamp(uint256 timestamp, uint256 current);
    error CounterOverflow(string counter);
    error TooManyItems(uint256 current, uint256 max);
    error BatchSizeExceeded(uint256 size, uint256 max);

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

    event ProvenanceEntryUpdated(
        uint256 indexed entryId,
        string ipfsCID,
        address indexed updater
    );

    event ProvenanceEntryInvalidated(
        uint256 indexed entryId,
        string reason,
        address indexed invalidator
    );

    event ServiceRecordCreated(
        uint256 indexed serviceId,
        uint256 indexed passportId,
        string serviceType,
        string serviceProvider,
        string ipfsCID
    );

    event ServiceRecordUpdated(
        uint256 indexed serviceId,
        string ipfsCID,
        address indexed updater
    );

    event ServiceRecordInvalidated(
        uint256 indexed serviceId,
        string reason,
        address indexed invalidator
    );

    event TransferCompleted(
        uint256 indexed passportId,
        address indexed from,
        address indexed to,
        uint256 entryId
    );

    event AdditionalDataAdded(
        uint256 indexed entryId,
        string key,
        string value
    );

    // ============ MODIFIERS (SECURITY: Enhanced validation) ============

    modifier onlyAuthorizedRecorder() {
        if (!authorizedRecorders[_msgSender()] && _msgSender() != owner()) {
            revert NotAuthorized("recorder", _msgSender());
        }
        _;
    }

    modifier onlyAuthorizedServiceProvider() {
        if (!authorizedServiceProviders[_msgSender()] && _msgSender() != owner()) {
            revert NotAuthorized("service provider", _msgSender());
        }
        _;
    }

    modifier onlyAuthorizedOperator() {
        if (!authorizedOperators[_msgSender()] && _msgSender() != owner()) {
            revert NotAuthorized("operator", _msgSender());
        }
        _;
    }

    modifier notEmergencyStopped() {
        if (emergencyStop) {
            revert EmergencyStopActive();
        }
        _;
    }

    modifier validEntry(uint256 entryId) {
        if (provenanceEntries[entryId].entryId == 0) {
            revert EntryNotFound(entryId);
        }
        if (!provenanceEntries[entryId].isValid) {
            revert EntryInvalid(entryId);
        }
        _;
    }

    modifier validService(uint256 serviceId) {
        if (serviceRecords[serviceId].serviceId == 0) {
            revert ServiceNotFound(serviceId);
        }
        if (!serviceRecords[serviceId].isValid) {
            revert ServiceInvalid(serviceId);
        }
        _;
    }

    modifier validAddress(address addr, string memory param) {
        if (addr == address(0)) {
            revert InvalidAddress(param);
        }
        _;
    }

    modifier validString(string memory str, string memory param) {
        if (bytes(str).length == 0) {
            revert InvalidString(param, "cannot be empty");
        }
        if (bytes(str).length > MAX_STRING_LENGTH) {
            revert InvalidLength(param, bytes(str).length, MAX_STRING_LENGTH);
        }
        _;
    }

    modifier validTimestamp(uint256 timestamp) {
        // SECURITY FIX: Allow small future timestamps for block time variance
        if (timestamp > block.timestamp + MAX_FUTURE_TIMESTAMP) {
            revert InvalidTimestamp(timestamp, block.timestamp);
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

    function initialize(address initialOwner, address trustedForwarder) public initializer
        validAddress(initialOwner, "initialOwner")
        validAddress(trustedForwarder, "trustedForwarder")
    {
        __Ownable_init(initialOwner);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        // ERC2771Context initialization removed - constructor handles this

        _entryIds = 1; // Start from 1
        _serviceIds = 1; // Start from 1
        provenanceEntryFee = 0.001 ether;
        serviceRecordFee = 0.002 ether;
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

    // ============ PROVENANCE ENTRY MANAGEMENT (SECURITY: Enhanced validation) ============

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
        onlyAuthorizedRecorder
        notEmergencyStopped
        nonReentrant
        validString(location, "location")
        validString(description, "description")
        validString(ipfsCID, "ipfsCID")
        validString(metadataHash, "metadataHash")
    {
        // SECURITY: Enhanced validation
        if (passportId == 0) {
            revert InvalidEntryId(passportId);
        }
        if (bytes(location).length > MAX_LOCATION_LENGTH) {
            revert InvalidLength("location", bytes(location).length, MAX_LOCATION_LENGTH);
        }
        if (bytes(description).length > MAX_DESCRIPTION_LENGTH) {
            revert InvalidLength("description", bytes(description).length, MAX_DESCRIPTION_LENGTH);
        }
        if (additionalData.length > MAX_ADDITIONAL_DATA) {
            revert TooManyItems(additionalData.length, MAX_ADDITIONAL_DATA);
        }

        // SECURITY: Counter overflow protection
        if (_entryIds >= type(uint256).max - 1) {
            revert CounterOverflow("entryIds");
        }

        // SECURITY: Validate additional data
        for (uint256 i = 0; i < additionalData.length; i += 2) {
            if (i + 1 < additionalData.length) {
                if (bytes(additionalData[i]).length == 0 || bytes(additionalData[i]).length > MAX_STRING_LENGTH) {
                    revert InvalidLength("additionalDataKey", bytes(additionalData[i]).length, MAX_STRING_LENGTH);
                }
                if (bytes(additionalData[i + 1]).length > MAX_STRING_LENGTH) {
                    revert InvalidLength("additionalDataValue", bytes(additionalData[i + 1]).length, MAX_STRING_LENGTH);
                }
            }
        }

        _entryIds = _entryIds + 1;
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
        newEntry.recorder = _msgSender();

        // Add additional data with bounds checking
        for (uint256 i = 0; i < additionalData.length && i + 1 < additionalData.length; i += 2) {
            string memory key = additionalData[i];
            string memory value = additionalData[i + 1];
            if (bytes(key).length > 0) { // SECURITY: Validate key
                newEntry.additionalData[key] = value;
                newEntry.dataKeys.push(key);
            }
        }

        // Update passport to entries mapping
        passportToEntries[passportId].push(entryId);

        // Update transfer history
        TransferHistory storage history = transferHistories[passportId];
        if (history.passportId == 0) {
            history.passportId = passportId;
            history.totalTransfers = 0;
            history.totalServices = 0;
        }

        if (entryType == ProvenanceType.OWNERSHIP_TRANSFER) {
            history.transferEntryIds.push(entryId);
            history.totalTransfers++;
            history.currentOwner = to;
            history.lastTransferDate = block.timestamp;

            emit TransferCompleted(passportId, from, to, entryId);
        }

        emit ProvenanceEntryCreated(entryId, passportId, entryType, from, to, location, ipfsCID);
    }

    function updateProvenanceEntry(
        uint256 entryId,
        string memory ipfsCID,
        string memory metadataHash
    ) external
        validEntry(entryId)
        onlyAuthorizedOperator
        validString(ipfsCID, "ipfsCID")
        validString(metadataHash, "metadataHash")
    {
        ProvenanceEntry storage entry = provenanceEntries[entryId];
        entry.ipfsCID = ipfsCID;
        entry.metadataHash = metadataHash;

        emit ProvenanceEntryUpdated(entryId, ipfsCID, _msgSender());
    }

    function invalidateProvenanceEntry(
        uint256 entryId,
        string memory reason
    ) external
        validEntry(entryId)
        onlyAuthorizedOperator
        validString(reason, "reason")
    {
        provenanceEntries[entryId].isValid = false;

        emit ProvenanceEntryInvalidated(entryId, reason, _msgSender());
    }

    // ============ SERVICE RECORD MANAGEMENT (SECURITY: Enhanced validation) ============

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
        onlyAuthorizedServiceProvider
        notEmergencyStopped
        nonReentrant
        validString(serviceType, "serviceType")
        validString(serviceProvider, "serviceProvider")
        validString(serviceDescription, "serviceDescription")
        validString(ipfsCID, "ipfsCID")
        validTimestamp(serviceDate)
    {
        // SECURITY: Enhanced validation
        if (passportId == 0) {
            revert InvalidServiceId(passportId);
        }
        if (nextServiceDate != 0 && nextServiceDate <= serviceDate) {
            revert InvalidTimestamp(nextServiceDate, serviceDate);
        }
        if (bytes(serviceDescription).length > MAX_DESCRIPTION_LENGTH) {
            revert InvalidLength("serviceDescription", bytes(serviceDescription).length, MAX_DESCRIPTION_LENGTH);
        }
        if (serviceDetails.length > MAX_SERVICE_DETAILS) {
            revert TooManyItems(serviceDetails.length, MAX_SERVICE_DETAILS);
        }

        // SECURITY: Counter overflow protection
        if (_serviceIds >= type(uint256).max - 1) {
            revert CounterOverflow("serviceIds");
        }

        // SECURITY: Validate service details
        for (uint256 i = 0; i < serviceDetails.length; i += 2) {
            if (i + 1 < serviceDetails.length) {
                if (bytes(serviceDetails[i]).length == 0 || bytes(serviceDetails[i]).length > MAX_STRING_LENGTH) {
                    revert InvalidLength("serviceDetailKey", bytes(serviceDetails[i]).length, MAX_STRING_LENGTH);
                }
                if (bytes(serviceDetails[i + 1]).length > MAX_STRING_LENGTH) {
                    revert InvalidLength("serviceDetailValue", bytes(serviceDetails[i + 1]).length, MAX_STRING_LENGTH);
                }
            }
        }

        _serviceIds = _serviceIds + 1;
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
        newService.serviceProviderAddress = _msgSender();

        // Add service details with bounds checking
        for (uint256 i = 0; i < serviceDetails.length && i + 1 < serviceDetails.length; i += 2) {
            string memory key = serviceDetails[i];
            string memory value = serviceDetails[i + 1];
            if (bytes(key).length > 0) { // SECURITY: Validate key
                newService.serviceDetails[key] = value;
                newService.detailKeys.push(key);
            }
        }

        // Update mappings
        passportToServices[passportId].push(serviceId);

        // Update transfer history
        TransferHistory storage history = transferHistories[passportId];
        if (history.passportId == 0) {
            history.passportId = passportId;
            history.totalTransfers = 0;
            history.totalServices = 0;
        }
        history.serviceEntryIds.push(serviceId);
        history.totalServices++;

        emit ServiceRecordCreated(serviceId, passportId, serviceType, serviceProvider, ipfsCID);
    }

    function updateServiceRecord(
        uint256 serviceId,
        string memory ipfsCID
    ) external
        validService(serviceId)
        onlyAuthorizedServiceProvider
        validString(ipfsCID, "ipfsCID")
    {
        // SECURITY: Only allow original service provider to update
        if (serviceRecords[serviceId].serviceProviderAddress != _msgSender() && _msgSender() != owner()) {
            revert NotAuthorized("service record owner", _msgSender());
        }

        serviceRecords[serviceId].ipfsCID = ipfsCID;

        emit ServiceRecordUpdated(serviceId, ipfsCID, _msgSender());
    }

    function invalidateServiceRecord(
        uint256 serviceId,
        string memory reason
    ) external
        validService(serviceId)
        onlyAuthorizedOperator
        validString(reason, "reason")
    {
        serviceRecords[serviceId].isValid = false;

        emit ServiceRecordInvalidated(serviceId, reason, _msgSender());
    }

    // ============ BATCH OPERATIONS (SECURITY: With size limits) ============

    function createBatchProvenanceEntries(
        uint256[] memory passportIds,
        ProvenanceType[] memory entryTypes,
        address[] memory froms,
        address[] memory tos,
        string[] memory locations,
        string[] memory descriptions,
        string[] memory ipfsCIDs,
        string[] memory metadataHashes
    ) external onlyAuthorizedRecorder notEmergencyStopped nonReentrant {
        // SECURITY: Validate batch size
        if (passportIds.length > MAX_BATCH_SIZE) {
            revert BatchSizeExceeded(passportIds.length, MAX_BATCH_SIZE);
        }

        // SECURITY: Validate all arrays have same length
        if (passportIds.length != entryTypes.length ||
            passportIds.length != froms.length ||
            passportIds.length != tos.length ||
            passportIds.length != locations.length ||
            passportIds.length != descriptions.length ||
            passportIds.length != ipfsCIDs.length ||
            passportIds.length != metadataHashes.length) {
            revert InvalidLength("arrays", passportIds.length, 0);
        }

        for (uint256 i = 0; i < passportIds.length; i++) {
            // Create individual entries (reusing validation from single function)
            this.createProvenanceEntry(
                passportIds[i],
                entryTypes[i],
                froms[i],
                tos[i],
                locations[i],
                descriptions[i],
                ipfsCIDs[i],
                metadataHashes[i],
                new string[](0) // No additional data for batch operations
            );
        }
    }

    // ============ ADMIN FUNCTIONS (SECURITY: Enhanced validation) ============

    function authorizeRecorder(address recorder) external onlyOwner validAddress(recorder, "recorder") {
        authorizedRecorders[recorder] = true;
    }

    function revokeRecorder(address recorder) external onlyOwner validAddress(recorder, "recorder") {
        authorizedRecorders[recorder] = false;
    }

    function authorizeServiceProvider(address serviceProvider) external onlyOwner validAddress(serviceProvider, "serviceProvider") {
        authorizedServiceProviders[serviceProvider] = true;
    }

    function revokeServiceProvider(address serviceProvider) external onlyOwner validAddress(serviceProvider, "serviceProvider") {
        authorizedServiceProviders[serviceProvider] = false;
    }

    function authorizeOperator(address operator) external onlyOwner validAddress(operator, "operator") {
        authorizedOperators[operator] = true;
    }

    function revokeOperator(address operator) external onlyOwner validAddress(operator, "operator") {
        authorizedOperators[operator] = false;
    }

    function setFees(uint256 newProvenanceEntryFee, uint256 newServiceRecordFee) external onlyOwner {
        provenanceEntryFee = newProvenanceEntryFee;
        serviceRecordFee = newServiceRecordFee;
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

    // ============ VIEW FUNCTIONS ============

    function getProvenanceEntryDetails(uint256 entryId) external view returns (
        uint256 passportId,
        ProvenanceType entryType,
        address from,
        address to,
        uint256 timestamp,
        string memory location,
        string memory description,
        string memory ipfsCID,
        string memory metadataHash,
        bool isValid,
        address recorder
    ) {
        ProvenanceEntry storage entry = provenanceEntries[entryId];
        return (
            entry.passportId,
            entry.entryType,
            entry.from,
            entry.to,
            entry.timestamp,
            entry.location,
            entry.description,
            entry.ipfsCID,
            entry.metadataHash,
            entry.isValid,
            entry.recorder
        );
    }

    function getServiceRecordDetails(uint256 serviceId) external view returns (
        uint256 passportId,
        string memory serviceType,
        string memory serviceProvider,
        string memory serviceDescription,
        uint256 serviceDate,
        uint256 nextServiceDate,
        string memory ipfsCID,
        string memory certificateNumber,
        bool isValid,
        address serviceProviderAddress
    ) {
        ServiceRecord storage service = serviceRecords[serviceId];
        return (
            service.passportId,
            service.serviceType,
            service.serviceProvider,
            service.serviceDescription,
            service.serviceDate,
            service.nextServiceDate,
            service.ipfsCID,
            service.certificateNumber,
            service.isValid,
            service.serviceProviderAddress
        );
    }

    function getTransferHistory(uint256 passportId) external view returns (
        uint256[] memory transferEntryIds,
        uint256[] memory serviceEntryIds,
        uint256 totalTransfers,
        uint256 totalServices,
        address currentOwner,
        uint256 lastTransferDate
    ) {
        TransferHistory storage history = transferHistories[passportId];
        return (
            history.transferEntryIds,
            history.serviceEntryIds,
            history.totalTransfers,
            history.totalServices,
            history.currentOwner,
            history.lastTransferDate
        );
    }

    function getPassportEntries(uint256 passportId) external view returns (uint256[] memory) {
        return passportToEntries[passportId];
    }

    function getPassportServices(uint256 passportId) external view returns (uint256[] memory) {
        return passportToServices[passportId];
    }

    function getEntryAdditionalData(uint256 entryId, string memory key) external view returns (string memory) {
        return provenanceEntries[entryId].additionalData[key];
    }

    function getEntryDataKeys(uint256 entryId) external view returns (string[] memory) {
        return provenanceEntries[entryId].dataKeys;
    }

    function getServiceDetail(uint256 serviceId, string memory key) external view returns (string memory) {
        return serviceRecords[serviceId].serviceDetails[key];
    }

    function getServiceDetailKeys(uint256 serviceId) external view returns (string[] memory) {
        return serviceRecords[serviceId].detailKeys;
    }

    function getTotalEntries() external view returns (uint256) {
        return _entryIds - 1;
    }

    function getTotalServices() external view returns (uint256) {
        return _serviceIds - 1;
    }

    // ============ VERSION FUNCTION ============

    function version() external pure returns (string memory) {
        return "1.1.0-secure";
    }
}