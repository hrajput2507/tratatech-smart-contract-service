// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";


/**
 * @title TrataTechProductPassportUpgradeable
 * @dev Upgradeable contract for managing digital product passports, brands, and manufacturing certificates
 * @dev Uses UUPS upgradeable pattern for future upgrades
 */
contract TrataTechProductPassportUpgradeable is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ERC2771ContextUpgradeable
{


    // ============ STRUCTS ============

    struct ProductPassport {
        uint256 id;
        string serialNumber;
        string brandId;
        string productName;
        string productDescription;
        string materials;
        string manufacturingLocation;
        uint256 manufacturingDate;
        string ipfsCID;
        bytes32 metadataHash;
        string[] additionalAttributes;
        bool isValid;
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct Brand {
        string id;
        string name;
        string description;
        string ipfsCID;
        string[] authorizedCountries;
        bool isVerified;
        bool isActive;
        uint256 reserved; // was registrationFee
        uint256 createdAt;
    }

    struct ManufacturingCertificate {
        uint256 id;
        uint256 passportId;
        string certificateType;
        string certificateNumber;
        string issuingAuthority;
        uint256 issueDate;
        uint256 expiryDate;
        string ipfsCID;
        bool isValid;
        uint256 createdAt;
    }

    // ============ STATE VARIABLES ============

    uint256 private _passportIds;
    uint256 private _certificateIds;

    // Brand management
    mapping(string => Brand) public brands;
    mapping(address => bool) public authorizedBrands;
    mapping(address => bool) public authorizedOperators;
    mapping(address => bool) public authorizedManufacturers;
    mapping(address => bool) public authorizedCertifiers;

    // Product passport management
    mapping(uint256 => ProductPassport) public productPassports;
    mapping(string => uint256) public serialNumberToPassportId;
    mapping(string => uint256[]) public brandPassports;

    // Manufacturing certificate management
    mapping(uint256 => ManufacturingCertificate) public certificates;
    mapping(uint256 => uint256[]) public passportCertificates;

    // Reserved for future use
    uint256[50] private __gap;

    // Emergency controls
    bool public emergencyStop;

    // ============ EVENTS ============

    event BrandRegistered(string indexed brandId, string name, address indexed registrant, uint256 fee);
    event BrandVerified(string indexed brandId, address indexed verifier);
    event BrandRevoked(string indexed brandId, address indexed revoker, string reason);
    event ProductPassportCreated(uint256 indexed passportId, string serialNumber, string indexed brandId, string ipfsCID);
    event ProductPassportUpdated(uint256 indexed passportId, string ipfsCID, uint256 updatedAt);
    event ProductPassportInvalidated(uint256 indexed passportId, string reason, address indexed invalidator);
    event ManufacturingCertificateCreated(uint256 indexed certificateId, uint256 indexed passportId, string certificateType, string ipfsCID);
    event ManufacturingCertificateInvalidated(uint256 indexed certificateId, string reason, address indexed invalidator);
    event OperatorAuthorized(address indexed operator, address indexed authorizer);
    event OperatorRevoked(address indexed operator, address indexed revoker);
    event EmergencyStopActivated(address indexed activator);
    event EmergencyStopDeactivated(address indexed deactivator);
    event FeesUpdated(uint256 brandRegistrationFee, uint256 passportCreationFee, uint256 certificateCreationFee);
    event FeeCollected(address indexed collector, uint256 amount);

    // ============ MODIFIERS ============

    modifier onlyAuthorizedBrand() {
        require(authorizedBrands[_msgSender()] || owner() == _msgSender(), "Not authorized brand");
        _;
    }

    modifier onlyAuthorizedOperator() {
        require(authorizedOperators[_msgSender()] || owner() == _msgSender(), "Not authorized operator");
        _;
    }

    modifier onlyAuthorizedManufacturer() {
        require(authorizedManufacturers[_msgSender()] || owner() == _msgSender(), "Not authorized manufacturer");
        _;
    }

    modifier onlyAuthorizedCertifier() {
        require(authorizedCertifiers[_msgSender()] || owner() == _msgSender(), "Not authorized certifier");
        _;
    }

    modifier whenNotEmergencyStopped() {
        require(!emergencyStop, "Contract is emergency stopped");
        _;
    }

    modifier validPassportId(uint256 passportId) {
        require(passportId > 0 && passportId <= _passportIds, "Invalid passport ID");
        _;
    }

    modifier validCertificateId(uint256 certificateId) {
        require(certificateId > 0 && certificateId <= _certificateIds, "Invalid certificate ID");
        _;
    }

    // ============ INITIALIZATION ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        // Initialize counters in the initializer
        _passportIds = 0;
        _certificateIds = 0;
        
        // Fee initialization removed - no blockchain payments

        // Authorize initial owner as operator
        authorizedOperators[initialOwner] = true;
        authorizedBrands[initialOwner] = true;
        authorizedManufacturers[initialOwner] = true;
        authorizedCertifiers[initialOwner] = true;
    }

    // ============ UUPS UPGRADEABLE ============

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ BRAND MANAGEMENT ============

    /**
     * @dev Register a new brand with fee payment
     * @param brandId Unique brand identifier
     * @param brandName Brand name
     * @param brandDescription Brand description
     * @param ipfsCID IPFS CID for brand metadata
     * @param authorizedCountries Array of authorized countries
     */
    function registerBrand(
        string memory brandId,
        string memory brandName,
        string memory brandDescription,
        string memory ipfsCID,
        string[] memory authorizedCountries
    ) external whenNotPaused whenNotEmergencyStopped nonReentrant {
        // Registration fee requirement removed
        require(bytes(brandId).length > 0, "Brand ID cannot be empty");
        require(bytes(brandName).length > 0, "Brand name cannot be empty");
        require(brands[brandId].createdAt == 0, "Brand already exists");

        // Create brand
        brands[brandId] = Brand({
            id: brandId,
            name: brandName,
            description: brandDescription,
            ipfsCID: ipfsCID,
            authorizedCountries: authorizedCountries,
            isVerified: false,
            isActive: true,
            reserved: 0, // was registrationFee
            createdAt: block.timestamp
        });

        // Authorize registrant as brand operator
        authorizedBrands[_msgSender()] = true;

        // Fee collection removed

        emit BrandRegistered(brandId, brandName, _msgSender(), 0);
    }

    /**
     * @dev Verify a brand (owner only)
     * @param brandId Brand identifier to verify
     */
    function verifyBrand(string memory brandId) external onlyOwner {
        require(brands[brandId].createdAt > 0, "Brand does not exist");
        require(!brands[brandId].isVerified, "Brand already verified");

        brands[brandId].isVerified = true;

        emit BrandVerified(brandId, _msgSender());
    }

    /**
     * @dev Revoke a brand (owner only)
     * @param brandId Brand identifier to revoke
     * @param reason Reason for revocation
     */
    function revokeBrand(string memory brandId, string memory reason) external onlyOwner {
        require(brands[brandId].createdAt > 0, "Brand does not exist");

        brands[brandId].isActive = false;

        emit BrandRevoked(brandId, _msgSender(), reason);
    }

    // ============ PRODUCT PASSPORT MANAGEMENT ============

    /**
     * @dev Create a new product passport
     * @param serialNumber Product serial number
     * @param brandId Associated brand ID
     * @param productName Product name
     * @param productDescription Product description
     * @param materials Materials used
     * @param manufacturingLocation Manufacturing location
     * @param manufacturingDate Manufacturing date
     * @param ipfsCID IPFS CID for passport metadata
     * @param metadataHash Hash of metadata for verification
     * @param additionalAttributes Additional product attributes
     */
    function createProductPassport(
        string memory serialNumber,
        string memory brandId,
        string memory productName,
        string memory productDescription,
        string memory materials,
        string memory manufacturingLocation,
        uint256 manufacturingDate,
        string memory ipfsCID,
        bytes32 metadataHash,
        string[] memory additionalAttributes
    ) external whenNotPaused whenNotEmergencyStopped nonReentrant onlyAuthorizedBrand {
        // Creation fee requirement removed
        require(bytes(serialNumber).length > 0, "Serial number cannot be empty");
        require(brands[brandId].isActive, "Brand is not active");
        require(serialNumberToPassportId[serialNumber] == 0, "Serial number already exists");
        require(manufacturingDate <= block.timestamp, "Manufacturing date cannot be in future");

        _passportIds = _passportIds + 1;
        uint256 passportId = _passportIds;

        // Create product passport
        productPassports[passportId] = ProductPassport({
            id: passportId,
            serialNumber: serialNumber,
            brandId: brandId,
            productName: productName,
            productDescription: productDescription,
            materials: materials,
            manufacturingLocation: manufacturingLocation,
            manufacturingDate: manufacturingDate,
            ipfsCID: ipfsCID,
            metadataHash: metadataHash,
            additionalAttributes: additionalAttributes,
            isValid: true,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        // Update mappings
        serialNumberToPassportId[serialNumber] = passportId;
        brandPassports[brandId].push(passportId);

        // Fee collection removed

        emit ProductPassportCreated(passportId, serialNumber, brandId, ipfsCID);
    }

    /**
     * @dev Update product passport metadata
     * @param passportId Passport ID to update
     * @param ipfsCID New IPFS CID
     * @param metadataHash New metadata hash
     * @param additionalAttributes New additional attributes
     */
    function updateProductPassport(
        uint256 passportId,
        string memory ipfsCID,
        bytes32 metadataHash,
        string[] memory additionalAttributes
    ) external validPassportId(passportId) onlyAuthorizedOperator {
        require(productPassports[passportId].isValid, "Passport is invalid");

        ProductPassport storage passport = productPassports[passportId];
        passport.ipfsCID = ipfsCID;
        passport.metadataHash = metadataHash;
        passport.additionalAttributes = additionalAttributes;
        passport.updatedAt = block.timestamp;

        emit ProductPassportUpdated(passportId, ipfsCID, block.timestamp);
    }

    /**
     * @dev Invalidate a product passport
     * @param passportId Passport ID to invalidate
     * @param reason Reason for invalidation
     */
    function invalidateProductPassport(
        uint256 passportId,
        string memory reason
    ) external validPassportId(passportId) onlyAuthorizedOperator {
        require(productPassports[passportId].isValid, "Passport already invalid");

        productPassports[passportId].isValid = false;
        productPassports[passportId].updatedAt = block.timestamp;

        emit ProductPassportInvalidated(passportId, reason, _msgSender());
    }

    // ============ MANUFACTURING CERTIFICATE MANAGEMENT ============

    /**
     * @dev Create a manufacturing certificate
     * @param passportId Associated passport ID
     * @param certificateType Type of certificate
     * @param certificateNumber Certificate number
     * @param issuingAuthority Issuing authority
     * @param issueDate Issue date
     * @param expiryDate Expiry date
     * @param ipfsCID IPFS CID for certificate metadata
     */
    function createManufacturingCertificate(
        uint256 passportId,
        string memory certificateType,
        string memory certificateNumber,
        string memory issuingAuthority,
        uint256 issueDate,
        uint256 expiryDate,
        string memory ipfsCID
    ) external validPassportId(passportId) whenNotPaused whenNotEmergencyStopped nonReentrant onlyAuthorizedCertifier {
        // Creation fee requirement removed
        require(productPassports[passportId].isValid, "Passport is invalid");
        require(issueDate <= block.timestamp, "Issue date cannot be in future");
        require(expiryDate > issueDate, "Expiry date must be after issue date");

        _certificateIds = _certificateIds + 1;
        uint256 certificateId = _certificateIds;

        // Create certificate
        certificates[certificateId] = ManufacturingCertificate({
            id: certificateId,
            passportId: passportId,
            certificateType: certificateType,
            certificateNumber: certificateNumber,
            issuingAuthority: issuingAuthority,
            issueDate: issueDate,
            expiryDate: expiryDate,
            ipfsCID: ipfsCID,
            isValid: true,
            createdAt: block.timestamp
        });

        // Update passport certificates mapping
        passportCertificates[passportId].push(certificateId);

        // Fee collection removed

        emit ManufacturingCertificateCreated(certificateId, passportId, certificateType, ipfsCID);
    }

    /**
     * @dev Invalidate a manufacturing certificate
     * @param certificateId Certificate ID to invalidate
     * @param reason Reason for invalidation
     */
    function invalidateCertificate(
        uint256 certificateId,
        string memory reason
    ) external validCertificateId(certificateId) onlyAuthorizedCertifier {
        require(certificates[certificateId].isValid, "Certificate already invalid");

        certificates[certificateId].isValid = false;

        emit ManufacturingCertificateInvalidated(certificateId, reason, _msgSender());
    }

    // ============ ACCESS CONTROL ============

    /**
     * @dev Authorize an operator
     * @param operator Address to authorize
     */
    function authorizeOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid operator address");
        authorizedOperators[operator] = true;
        emit OperatorAuthorized(operator, _msgSender());
    }

    /**
     * @dev Revoke operator authorization
     * @param operator Address to revoke
     */
    function revokeOperator(address operator) external onlyOwner {
        authorizedOperators[operator] = false;
        emit OperatorRevoked(operator, _msgSender());
    }

    /**
     * @dev Authorize a brand
     * @param brand Address to authorize
     */
    function authorizeBrand(address brand) external onlyOwner {
        require(brand != address(0), "Invalid brand address");
        authorizedBrands[brand] = true;
    }

    /**
     * @dev Revoke brand authorization
     * @param brand Address to revoke
     */
    function revokeBrand(address brand) external onlyOwner {
        authorizedBrands[brand] = false;
    }

    /**
     * @dev Authorize a manufacturer
     * @param manufacturer Address to authorize
     */
    function authorizeManufacturer(address manufacturer) external onlyOwner {
        require(manufacturer != address(0), "Invalid manufacturer address");
        authorizedManufacturers[manufacturer] = true;
    }

    /**
     * @dev Revoke manufacturer authorization
     * @param manufacturer Address to revoke
     */
    function revokeManufacturer(address manufacturer) external onlyOwner {
        authorizedManufacturers[manufacturer] = false;
    }

    /**
     * @dev Authorize a certifier
     * @param certifier Address to authorize
     */
    function authorizeCertifier(address certifier) external onlyOwner {
        require(certifier != address(0), "Invalid certifier address");
        authorizedCertifiers[certifier] = true;
    }

    /**
     * @dev Revoke certifier authorization
     * @param certifier Address to revoke
     */
    function revokeCertifier(address certifier) external onlyOwner {
        authorizedCertifiers[certifier] = false;
    }

    // ============ EMERGENCY CONTROLS ============

    /**
     * @dev Activate emergency stop
     */
    function activateEmergencyStop() external onlyOwner {
        emergencyStop = true;
        emit EmergencyStopActivated(_msgSender());
    }

    /**
     * @dev Deactivate emergency stop
     */
    function deactivateEmergencyStop() external onlyOwner {
        emergencyStop = false;
        emit EmergencyStopDeactivated(_msgSender());
    }

    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ FEE MANAGEMENT ============

    // Fee update functions removed - no blockchain payments

    // Fee collector functions removed - no blockchain payments

    // Fee withdrawal functions removed - no blockchain payments

    // ============ INTERNAL FUNCTIONS ============

    // Fee collection internal functions removed - no blockchain payments

    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Get product passport details
     * @param passportId Passport ID
     * @return passport Product passport details
     */
    function getProductPassportDetails(uint256 passportId) external view validPassportId(passportId) returns (ProductPassport memory passport) {
        return productPassports[passportId];
    }

    /**
     * @dev Get brand details
     * @param brandId Brand ID
     * @return brand Brand details
     */
    function getBrandDetails(string memory brandId) external view returns (Brand memory brand) {
        require(brands[brandId].createdAt > 0, "Brand does not exist");
        return brands[brandId];
    }

    /**
     * @dev Get certificate details
     * @param certificateId Certificate ID
     * @return certificate Certificate details
     */
    function getCertificateDetails(uint256 certificateId) external view validCertificateId(certificateId) returns (ManufacturingCertificate memory certificate) {
        return certificates[certificateId];
    }

    /**
     * @dev Get passports for a brand
     * @param brandId Brand ID
     * @return passportIds Array of passport IDs
     */
    function getBrandPassports(string memory brandId) external view returns (uint256[] memory passportIds) {
        return brandPassports[brandId];
    }

    /**
     * @dev Get certificates for a passport
     * @param passportId Passport ID
     * @return certificateIds Array of certificate IDs
     */
    function getPassportCertificates(uint256 passportId) external view validPassportId(passportId) returns (uint256[] memory certificateIds) {
        return passportCertificates[passportId];
    }

    /**
     * @dev Get passport ID by serial number
     * @param serialNumber Serial number
     * @return passportId Passport ID
     */
    function getPassportIdBySerialNumber(string memory serialNumber) external view returns (uint256 passportId) {
        return serialNumberToPassportId[serialNumber];
    }

    /**
     * @dev Get total number of passports
     * @return count Total passport count
     */
    function getTotalPassports() external view returns (uint256 count) {
        return _passportIds;
    }

    /**
     * @dev Get total number of certificates
     * @return count Total certificate count
     */
    function getTotalCertificates() external view returns (uint256 count) {
        return _certificateIds;
    }

    /**
     * @dev Check if address is authorized brand
     * @param account Address to check
     * @return isAuthorized Whether address is authorized
     */
    function isAuthorizedBrand(address account) external view returns (bool isAuthorized) {
        return authorizedBrands[account];
    }

    /**
     * @dev Check if address is authorized operator
     * @param account Address to check
     * @return isAuthorized Whether address is authorized
     */
    function isAuthorizedOperator(address account) external view returns (bool isAuthorized) {
        return authorizedOperators[account];
    }

    // ============ EMERGENCY RECOVERY ============

    /**
     * @dev Emergency function to recover tokens
     * @param tokenAddress Token contract address
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function emergencyRecoverTokens(
        address tokenAddress,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(to != address(0), "Invalid recipient address");
        
        // This would require IERC20 interface implementation
        // For now, this is a placeholder for emergency token recovery
    }

    /**
     * @dev Emergency function to recover ETH
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function emergencyRecoverETH(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient address");
        require(amount <= address(this).balance, "Insufficient balance");

        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH recovery failed");
    }

    // ============ ERC2771 CONTEXT OVERRIDE FUNCTIONS ============

    function _msgSender() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address) {
        return ERC2771ContextUpgradeable._msgSender();
    }

    function _msgData() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
        return ERC2771ContextUpgradeable._msgData();
    }

    function _contextSuffixLength() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (uint256) {
        return ERC2771ContextUpgradeable._contextSuffixLength();
    }

    // Duplicate gap removed
} 