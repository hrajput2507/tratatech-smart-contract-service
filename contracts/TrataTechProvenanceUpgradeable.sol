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
 * @title TrataTechProvenanceUpgradeable
 * @dev Upgradeable and gasless version of Provenance Contract for maintaining immutable logs of transfers and service history
 * @author Advanced Developer
 */
contract TrataTechProvenanceUpgradeable is 
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ERC2771ContextUpgradeable
{
    using ECDSA for bytes32;
    using Strings for uint256;

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
    
    uint256 private _entryIds;
    uint256 private _serviceIds;

    // Mappings
    mapping(uint256 => ProvenanceEntry) public provenanceEntries;
    mapping(uint256 => ServiceRecord) public serviceRecords;
    mapping(uint256 => TransferHistory) public transferHistories;
    mapping(uint256 => uint256[]) public passportToEntries;
    mapping(uint256 => uint256[]) public passportToServices;
    mapping(address => bool) public authorizedRecorders;
    mapping(address => bool) public authorizedServiceProviders;
    mapping(address => bool) public authorizedOperators;
    
    // Fee structure
    uint256 public provenanceEntryFee;
    uint256 public serviceRecordFee;
    
    // Emergency controls
    bool public emergencyStop;

    // Batch operation limits
    uint256 public constant MAX_BATCH_SIZE = 25;
    
    // Storage gap for future upgrades
    uint256[49] private __gap;
    
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

    // ============ MODIFIERS ============
    
    modifier onlyAuthorizedRecorder() {
        require(authorizedRecorders[_msgSender()] || _msgSender() == owner(), "Not authorized recorder");
        _;
    }
    
    modifier onlyAuthorizedServiceProvider() {
        require(authorizedServiceProviders[_msgSender()] || _msgSender() == owner(), "Not authorized service provider");
        _;
    }
    
    modifier onlyAuthorizedOperator() {
        require(authorizedOperators[_msgSender()] || _msgSender() == owner(), "Not authorized operator");
        _;
    }
    
    modifier notEmergencyStopped() {
        require(!emergencyStop, "Contract is emergency stopped");
        _;
    }
    
    modifier validEntry(uint256 entryId) {
        require(provenanceEntries[entryId].entryId != 0, "Provenance entry does not exist");
        require(provenanceEntries[entryId].isValid, "Provenance entry is invalid");
        _;
    }
    
    modifier validService(uint256 serviceId) {
        require(serviceRecords[serviceId].serviceId != 0, "Service record does not exist");
        require(serviceRecords[serviceId].isValid, "Service record is invalid");
        _;
    }

    // ============ INITIALIZATION ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) {
        require(trustedForwarder != address(0), "TrataTech: Invalid trusted forwarder");
        _disableInitializers();
    }

    function initialize(address initialOwner, address trustedForwarder) public initializer {
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

    // ============ PROVENANCE ENTRY MANAGEMENT ============
    
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
    ) external onlyAuthorizedRecorder notEmergencyStopped nonReentrant {
        require(passportId > 0, "Invalid passport ID");
        require(bytes(location).length > 0, "Location cannot be empty");
        require(bytes(description).length > 0, "Description cannot be empty");
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        require(bytes(metadataHash).length > 0, "Metadata hash cannot be empty");
        
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
        
        // Add additional data
        for (uint256 i = 0; i < additionalData.length; i += 2) {
            if (i + 1 < additionalData.length) {
                string memory key = additionalData[i];
                string memory value = additionalData[i + 1];
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
        
        history.transferEntryIds.push(entryId);
        history.totalTransfers++;
        history.currentOwner = to;
        history.lastTransferDate = block.timestamp;
        
        emit ProvenanceEntryCreated(entryId, passportId, entryType, from, to, location, ipfsCID);
        
        // Emit transfer event if it's a transfer
        if (entryType == ProvenanceType.TRANSFER) {
            emit TransferCompleted(passportId, from, to, entryId);
        }
    }
    
    function updateProvenanceEntry(
        uint256 entryId,
        string memory newIpfsCID,
        string memory newMetadataHash
    ) external validEntry(entryId) {
        ProvenanceEntry storage entry = provenanceEntries[entryId];
        require(entry.recorder == _msgSender(), "Not authorized to update this entry");
        require(bytes(newIpfsCID).length > 0, "IPFS CID cannot be empty");
        require(bytes(newMetadataHash).length > 0, "Metadata hash cannot be empty");
        
        entry.ipfsCID = newIpfsCID;
        entry.metadataHash = newMetadataHash;
        
        emit ProvenanceEntryUpdated(entryId, newIpfsCID, _msgSender());
    }
    
    function setProvenanceData(
        uint256 entryId,
        string memory key,
        string memory value
    ) external validEntry(entryId) {
        ProvenanceEntry storage entry = provenanceEntries[entryId];
        require(entry.recorder == _msgSender(), "Not authorized to update this entry");
        require(bytes(key).length > 0, "Data key cannot be empty");
        
        bool isNewData = bytes(entry.additionalData[key]).length == 0;
        
        entry.additionalData[key] = value;
        
        if (isNewData) {
            entry.dataKeys.push(key);
            emit AdditionalDataAdded(entryId, key, value);
        }
    }
    
    function invalidateProvenanceEntry(
        uint256 entryId,
        string memory reason
    ) external {
        require(provenanceEntries[entryId].entryId != 0, "Provenance entry does not exist");
        require(
            provenanceEntries[entryId].recorder == _msgSender() || _msgSender() == owner(),
            "Not authorized to invalidate this entry"
        );
        
        provenanceEntries[entryId].isValid = false;
        
        emit ProvenanceEntryInvalidated(entryId, reason, _msgSender());
    }

    // ============ SERVICE RECORD MANAGEMENT ============
    
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
    ) external onlyAuthorizedServiceProvider notEmergencyStopped nonReentrant {
        require(passportId > 0, "Invalid passport ID");
        require(bytes(serviceType).length > 0, "Service type cannot be empty");
        require(bytes(serviceProvider).length > 0, "Service provider cannot be empty");
        require(bytes(serviceDescription).length > 0, "Service description cannot be empty");
        require(serviceDate <= block.timestamp, "Service date cannot be in the future");
        require(nextServiceDate > serviceDate, "Next service date must be after service date");
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        
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
        
        // Add service details
        for (uint256 i = 0; i < serviceDetails.length; i += 2) {
            if (i + 1 < serviceDetails.length) {
                string memory key = serviceDetails[i];
                string memory value = serviceDetails[i + 1];
                newService.serviceDetails[key] = value;
                newService.detailKeys.push(key);
            }
        }
        
        // Update passport to services mapping
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
        string memory newIpfsCID
    ) external validService(serviceId) {
        ServiceRecord storage service = serviceRecords[serviceId];
        require(service.serviceProviderAddress == _msgSender(), "Not authorized to update this service");
        require(bytes(newIpfsCID).length > 0, "IPFS CID cannot be empty");
        
        service.ipfsCID = newIpfsCID;
        
        emit ServiceRecordUpdated(serviceId, newIpfsCID, _msgSender());
    }
    
    function invalidateServiceRecord(
        uint256 serviceId,
        string memory reason
    ) external {
        require(serviceRecords[serviceId].serviceId != 0, "Service record does not exist");
        require(
            serviceRecords[serviceId].serviceProviderAddress == _msgSender() || _msgSender() == owner(),
            "Not authorized to invalidate this service"
        );
        
        serviceRecords[serviceId].isValid = false;
        
        emit ServiceRecordInvalidated(serviceId, reason, _msgSender());
    }

    // ============ BATCH OPERATIONS ============
    
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
        require(passportIds.length <= MAX_BATCH_SIZE, "Batch size too large");
        require(passportIds.length > 0, "Empty batch not allowed");
        require(
            passportIds.length == entryTypes.length &&
            entryTypes.length == froms.length &&
            froms.length == tos.length &&
            tos.length == locations.length &&
            locations.length == descriptions.length &&
            descriptions.length == ipfsCIDs.length &&
            ipfsCIDs.length == metadataHashes.length,
            "Array lengths must match"
        );
        
        for (uint256 i = 0; i < passportIds.length; i++) {
            _createSingleProvenanceEntry(
                passportIds[i],
                entryTypes[i],
                froms[i],
                tos[i],
                locations[i],
                descriptions[i],
                ipfsCIDs[i],
                metadataHashes[i],
                new string[](0)
            );
        }
    }
    
    function _createSingleProvenanceEntry(
        uint256 passportId,
        ProvenanceType entryType,
        address from,
        address to,
        string memory location,
        string memory description,
        string memory ipfsCID,
        string memory metadataHash,
        string[] memory additionalData
    ) internal {
        require(passportId > 0, "Invalid passport ID");
        require(bytes(location).length > 0, "Location cannot be empty");
        require(bytes(description).length > 0, "Description cannot be empty");
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        require(bytes(metadataHash).length > 0, "Metadata hash cannot be empty");
        
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
        
        // Add additional data
        for (uint256 i = 0; i < additionalData.length; i += 2) {
            if (i + 1 < additionalData.length) {
                string memory key = additionalData[i];
                string memory value = additionalData[i + 1];
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
        
        history.transferEntryIds.push(entryId);
        history.totalTransfers++;
        history.currentOwner = to;
        history.lastTransferDate = block.timestamp;
        
        emit ProvenanceEntryCreated(entryId, passportId, entryType, from, to, location, ipfsCID);
        
        // Emit transfer event if it's a transfer
        if (entryType == ProvenanceType.TRANSFER) {
            emit TransferCompleted(passportId, from, to, entryId);
        }
    }

    // ============ ADMIN FUNCTIONS ============
    
    function authorizeRecorder(address recorder) external onlyOwner {
        require(recorder != address(0), "Invalid address");
        authorizedRecorders[recorder] = true;
    }
    
    function authorizeServiceProvider(address serviceProvider) external onlyOwner {
        require(serviceProvider != address(0), "Invalid address");
        authorizedServiceProviders[serviceProvider] = true;
    }
    
    function authorizeOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid address");
        authorizedOperators[operator] = true;
    }
    
    function revokeAuthorization(address target) external onlyOwner {
        authorizedRecorders[target] = false;
        authorizedServiceProviders[target] = false;
        authorizedOperators[target] = false;
    }
    
    function setFees(uint256 newProvenanceFee, uint256 newServiceFee) external onlyOwner {
        provenanceEntryFee = newProvenanceFee;
        serviceRecordFee = newServiceFee;
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
        uint256 totalTransfers,
        uint256 totalServices,
        address currentOwner,
        uint256 lastTransferDate,
        uint256[] memory transferEntryIds,
        uint256[] memory serviceEntryIds
    ) {
        TransferHistory storage history = transferHistories[passportId];
        return (
            history.totalTransfers,
            history.totalServices,
            history.currentOwner,
            history.lastTransferDate,
            history.transferEntryIds,
            history.serviceEntryIds
        );
    }
    
    function getPassportEntries(uint256 passportId) external view returns (uint256[] memory) {
        return passportToEntries[passportId];
    }
    
    function getPassportServices(uint256 passportId) external view returns (uint256[] memory) {
        return passportToServices[passportId];
    }
    
    function getProvenanceData(uint256 entryId, string memory key) external view returns (string memory) {
        return provenanceEntries[entryId].additionalData[key];
    }
    
    function getProvenanceDataKeys(uint256 entryId) external view returns (string[] memory) {
        return provenanceEntries[entryId].dataKeys;
    }
    
    function getServiceDetail(uint256 serviceId, string memory key) external view returns (string memory) {
        return serviceRecords[serviceId].serviceDetails[key];
    }
    
    function getServiceDetailKeys(uint256 serviceId) external view returns (string[] memory) {
        return serviceRecords[serviceId].detailKeys;
    }
    
    function getTotalProvenanceEntries() external view returns (uint256) {
        return _entryIds - 1;
    }
    
    function getTotalServiceRecords() external view returns (uint256) {
        return _serviceIds - 1;
    }
    
    function getEntriesByType(uint256 passportId, ProvenanceType entryType) external view returns (uint256[] memory) {
        uint256[] memory allEntries = passportToEntries[passportId];
        uint256[] memory filteredEntries = new uint256[](allEntries.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < allEntries.length; i++) {
            if (provenanceEntries[allEntries[i]].entryType == entryType && 
                provenanceEntries[allEntries[i]].isValid) {
                filteredEntries[count] = allEntries[i];
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = filteredEntries[i];
        }
        
        return result;
    }

    // ============ VERSION FUNCTION ============
    
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    // ============ RECEIVE FUNCTION ============
    
    // Receive function removed - no blockchain payments
}