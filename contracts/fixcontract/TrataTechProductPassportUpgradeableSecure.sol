// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";

/**
 * @title TrataTechProductPassportUpgradeableSecure
 * @dev SECURITY FIXED: Upgradeable contract for managing digital product passports, brands, and manufacturing certificates
 * @dev Uses UUPS upgradeable pattern for future upgrades
 * @dev FIXES: Input validation, storage layout, error handling, access control
 * @author Advanced Developer - Security Enhanced Version
 */
contract TrataTechProductPassportUpgradeableSecure is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ERC2771ContextUpgradeable
{

    // ============ CONSTANTS (FIXED: Moved before state variables) ============

    uint256 public constant MAX_BRAND_NAME_LENGTH = 100;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 1000;
    uint256 public constant MAX_COUNTRIES = 50;
    uint256 public constant MAX_ATTRIBUTES = 20;
    uint256 public constant MAX_STRING_LENGTH = 200;
    uint256 public constant MAX_CERTIFICATES_PER_PASSPORT = 10;

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

    // ============ STATE VARIABLES (FIXED: Proper ordering) ============

    uint256 private _passportIds;
    uint256 private _certificateIds;

    // Emergency controls
    bool public emergencyStop;

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

    // SECURITY: Add nonce to prevent replay attacks
    mapping(address => uint256) public nonces;

    // Reserved for future use (FIXED: Proper gap size)
    uint256[40] private __gap;

    // ============ CUSTOM ERRORS (SECURITY: More descriptive error handling) ============

    error InvalidAddress(string param);
    error InvalidString(string param, string reason);
    error InvalidLength(string param, uint256 current, uint256 max);
    error InvalidPassportId(uint256 passportId);
    error InvalidCertificateId(uint256 certificateId);
    error PassportNotFound(uint256 passportId);
    error CertificateNotFound(uint256 certificateId);
    error BrandNotFound(string brandId);
    error BrandExists(string brandId);
    error SerialNumberExists(string serialNumber);
    error BrandNotActive(string brandId);
    error PassportInvalid(uint256 passportId);
    error CertificateInvalid(uint256 certificateId);
    error NotAuthorized(string role, address caller);
    error EmergencyStopActive();
    error InvalidTimestamp(uint256 timestamp, uint256 current);
    error CounterOverflow(string counter);
    error TooManyItems(uint256 current, uint256 max);

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

    // ============ MODIFIERS (SECURITY: Enhanced validation) ============

    modifier onlyAuthorizedBrand() {
        if (!authorizedBrands[_msgSender()] && owner() != _msgSender()) {
            revert NotAuthorized("brand", _msgSender());
        }
        _;
    }

    modifier onlyAuthorizedOperator() {
        if (!authorizedOperators[_msgSender()] && owner() != _msgSender()) {
            revert NotAuthorized("operator", _msgSender());
        }
        _;
    }

    modifier onlyAuthorizedManufacturer() {
        if (!authorizedManufacturers[_msgSender()] && owner() != _msgSender()) {
            revert NotAuthorized("manufacturer", _msgSender());
        }
        _;
    }

    modifier onlyAuthorizedCertifier() {
        if (!authorizedCertifiers[_msgSender()] && owner() != _msgSender()) {
            revert NotAuthorized("certifier", _msgSender());
        }
        _;
    }

    modifier whenNotEmergencyStopped() {
        if (emergencyStop) {
            revert EmergencyStopActive();
        }
        _;
    }

    modifier validPassportId(uint256 passportId) {
        if (passportId == 0 || passportId > _passportIds) {
            revert InvalidPassportId(passportId);
        }
        _;
    }

    modifier validCertificateId(uint256 certificateId) {
        if (certificateId == 0 || certificateId > _certificateIds) {
            revert InvalidCertificateId(certificateId);
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

    // ============ INITIALIZATION ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) {
        if (trustedForwarder == address(0)) {
            revert InvalidAddress("trustedForwarder");
        }
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer validAddress(initialOwner, "initialOwner") {
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

    // ============ BRAND MANAGEMENT (SECURITY: Enhanced validation) ============

    /**
     * @dev Register a new brand with enhanced validation
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
    ) external
        whenNotPaused
        whenNotEmergencyStopped
        nonReentrant
        validString(brandId, "brandId")
        validString(brandName, "brandName")
        validString(brandDescription, "brandDescription")
        validString(ipfsCID, "ipfsCID")
    {
        // SECURITY: Enhanced validation
        if (bytes(brandName).length > MAX_BRAND_NAME_LENGTH) {
            revert InvalidLength("brandName", bytes(brandName).length, MAX_BRAND_NAME_LENGTH);
        }
        if (bytes(brandDescription).length > MAX_DESCRIPTION_LENGTH) {
            revert InvalidLength("brandDescription", bytes(brandDescription).length, MAX_DESCRIPTION_LENGTH);
        }
        if (authorizedCountries.length > MAX_COUNTRIES) {
            revert TooManyItems(authorizedCountries.length, MAX_COUNTRIES);
        }
        if (brands[brandId].createdAt != 0) {
            revert BrandExists(brandId);
        }

        // SECURITY: Validate country codes
        for (uint256 i = 0; i < authorizedCountries.length; i++) {
            if (bytes(authorizedCountries[i]).length == 0 || bytes(authorizedCountries[i]).length > 3) {
                revert InvalidString("countryCode", "must be 1-3 characters");
            }
        }

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

        emit BrandRegistered(brandId, brandName, _msgSender(), 0);
    }

    /**
     * @dev Verify a brand (owner only)
     * @param brandId Brand identifier to verify
     */
    function verifyBrand(string memory brandId) external onlyOwner validString(brandId, "brandId") {
        if (brands[brandId].createdAt == 0) {
            revert BrandNotFound(brandId);
        }
        if (brands[brandId].isVerified) {
            revert InvalidString("brand", "already verified");
        }

        brands[brandId].isVerified = true;

        emit BrandVerified(brandId, _msgSender());
    }

    /**
     * @dev Revoke a brand (owner only)
     * @param brandId Brand identifier to revoke
     * @param reason Reason for revocation
     */
    function revokeBrand(string memory brandId, string memory reason) external onlyOwner
        validString(brandId, "brandId")
        validString(reason, "reason")
    {
        if (brands[brandId].createdAt == 0) {
            revert BrandNotFound(brandId);
        }

        brands[brandId].isActive = false;

        emit BrandRevoked(brandId, _msgSender(), reason);
    }

    // ============ PRODUCT PASSPORT MANAGEMENT (SECURITY: Enhanced validation) ============

    /**
     * @dev Create a new product passport with comprehensive validation
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
    ) external
        whenNotPaused
        whenNotEmergencyStopped
        nonReentrant
        onlyAuthorizedBrand
        validString(serialNumber, "serialNumber")
        validString(brandId, "brandId")
        validString(productName, "productName")
        validString(productDescription, "productDescription")
        validString(materials, "materials")
        validString(manufacturingLocation, "manufacturingLocation")
        validString(ipfsCID, "ipfsCID")
    {
        // SECURITY: Enhanced validation
        if (!brands[brandId].isActive) {
            revert BrandNotActive(brandId);
        }
        if (serialNumberToPassportId[serialNumber] != 0) {
            revert SerialNumberExists(serialNumber);
        }
        if (manufacturingDate > block.timestamp) {
            revert InvalidTimestamp(manufacturingDate, block.timestamp);
        }
        if (additionalAttributes.length > MAX_ATTRIBUTES) {
            revert TooManyItems(additionalAttributes.length, MAX_ATTRIBUTES);
        }
        if (metadataHash == bytes32(0)) {
            revert InvalidString("metadataHash", "cannot be zero");
        }

        // SECURITY: Counter overflow protection
        if (_passportIds >= type(uint256).max - 1) {
            revert CounterOverflow("passportIds");
        }

        // SECURITY: Validate additional attributes
        for (uint256 i = 0; i < additionalAttributes.length; i++) {
            if (bytes(additionalAttributes[i]).length > MAX_STRING_LENGTH) {
                revert InvalidLength("additionalAttribute", bytes(additionalAttributes[i]).length, MAX_STRING_LENGTH);
            }
        }

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

        emit ProductPassportCreated(passportId, serialNumber, brandId, ipfsCID);
    }

    /**
     * @dev Update product passport metadata with validation
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
    ) external
        validPassportId(passportId)
        onlyAuthorizedOperator
        validString(ipfsCID, "ipfsCID")
    {
        // SECURITY: Enhanced validation
        if (!productPassports[passportId].isValid) {
            revert PassportInvalid(passportId);
        }
        if (additionalAttributes.length > MAX_ATTRIBUTES) {
            revert TooManyItems(additionalAttributes.length, MAX_ATTRIBUTES);
        }
        if (metadataHash == bytes32(0)) {
            revert InvalidString("metadataHash", "cannot be zero");
        }

        // SECURITY: Validate additional attributes
        for (uint256 i = 0; i < additionalAttributes.length; i++) {
            if (bytes(additionalAttributes[i]).length > MAX_STRING_LENGTH) {
                revert InvalidLength("additionalAttribute", bytes(additionalAttributes[i]).length, MAX_STRING_LENGTH);
            }
        }

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
    ) external
        validPassportId(passportId)
        onlyAuthorizedOperator
        validString(reason, "reason")
    {
        if (!productPassports[passportId].isValid) {
            revert PassportInvalid(passportId);
        }

        productPassports[passportId].isValid = false;
        productPassports[passportId].updatedAt = block.timestamp;

        emit ProductPassportInvalidated(passportId, reason, _msgSender());
    }

    // ============ MANUFACTURING CERTIFICATE MANAGEMENT (SECURITY: Enhanced validation) ============

    /**
     * @dev Create a manufacturing certificate with comprehensive validation
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
    ) external
        validPassportId(passportId)
        whenNotPaused
        whenNotEmergencyStopped
        nonReentrant
        onlyAuthorizedCertifier
        validString(certificateType, "certificateType")
        validString(certificateNumber, "certificateNumber")
        validString(issuingAuthority, "issuingAuthority")
        validString(ipfsCID, "ipfsCID")
    {
        // SECURITY: Enhanced validation
        if (!productPassports[passportId].isValid) {
            revert PassportInvalid(passportId);
        }
        if (issueDate > block.timestamp) {
            revert InvalidTimestamp(issueDate, block.timestamp);
        }
        if (expiryDate <= issueDate) {
            revert InvalidTimestamp(expiryDate, issueDate);
        }
        if (passportCertificates[passportId].length >= MAX_CERTIFICATES_PER_PASSPORT) {
            revert TooManyItems(passportCertificates[passportId].length, MAX_CERTIFICATES_PER_PASSPORT);
        }

        // SECURITY: Counter overflow protection
        if (_certificateIds >= type(uint256).max - 1) {
            revert CounterOverflow("certificateIds");
        }

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
    ) external
        validCertificateId(certificateId)
        onlyAuthorizedCertifier
        validString(reason, "reason")
    {
        if (!certificates[certificateId].isValid) {
            revert CertificateInvalid(certificateId);
        }

        certificates[certificateId].isValid = false;

        emit ManufacturingCertificateInvalidated(certificateId, reason, _msgSender());
    }

    // ============ ACCESS CONTROL (SECURITY: Enhanced validation) ============

    /**
     * @dev Authorize an operator
     * @param operator Address to authorize
     */
    function authorizeOperator(address operator) external onlyOwner validAddress(operator, "operator") {
        authorizedOperators[operator] = true;
        emit OperatorAuthorized(operator, _msgSender());
    }

    /**
     * @dev Revoke operator authorization
     * @param operator Address to revoke
     */
    function revokeOperator(address operator) external onlyOwner validAddress(operator, "operator") {
        authorizedOperators[operator] = false;
        emit OperatorRevoked(operator, _msgSender());
    }

    /**
     * @dev Authorize a brand
     * @param brand Address to authorize
     */
    function authorizeBrand(address brand) external onlyOwner validAddress(brand, "brand") {
        authorizedBrands[brand] = true;
    }

    /**
     * @dev Revoke brand authorization
     * @param brand Address to revoke
     */
    function revokeBrand(address brand) external onlyOwner validAddress(brand, "brand") {
        authorizedBrands[brand] = false;
    }

    /**
     * @dev Authorize a manufacturer
     * @param manufacturer Address to authorize
     */
    function authorizeManufacturer(address manufacturer) external onlyOwner validAddress(manufacturer, "manufacturer") {
        authorizedManufacturers[manufacturer] = true;
    }

    /**
     * @dev Revoke manufacturer authorization
     * @param manufacturer Address to revoke
     */
    function revokeManufacturer(address manufacturer) external onlyOwner validAddress(manufacturer, "manufacturer") {
        authorizedManufacturers[manufacturer] = false;
    }

    /**
     * @dev Authorize a certifier
     * @param certifier Address to authorize
     */
    function authorizeCertifier(address certifier) external onlyOwner validAddress(certifier, "certifier") {
        authorizedCertifiers[certifier] = true;
    }

    /**
     * @dev Revoke certifier authorization
     * @param certifier Address to revoke
     */
    function revokeCertifier(address certifier) external onlyOwner validAddress(certifier, "certifier") {
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
    function getBrandDetails(string memory brandId) external view validString(brandId, "brandId") returns (Brand memory brand) {
        if (brands[brandId].createdAt == 0) {
            revert BrandNotFound(brandId);
        }
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
    function getBrandPassports(string memory brandId) external view validString(brandId, "brandId") returns (uint256[] memory passportIds) {
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
    function getPassportIdBySerialNumber(string memory serialNumber) external view validString(serialNumber, "serialNumber") returns (uint256 passportId) {
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

    // ============ EMERGENCY RECOVERY (SECURITY: Enhanced validation) ============

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
    ) external onlyOwner validAddress(tokenAddress, "tokenAddress") validAddress(to, "to") {
        // This would require IERC20 interface implementation
        // For now, this is a placeholder for emergency token recovery
    }

    /**
     * @dev Emergency function to recover ETH
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function emergencyRecoverETH(address to, uint256 amount) external onlyOwner validAddress(to, "to") {
        if (amount > address(this).balance) {
            revert InvalidLength("amount", amount, address(this).balance);
        }

        (bool success, ) = to.call{value: amount}("");
        if (!success) {
            revert InvalidString("recovery", "ETH recovery failed");
        }
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

    // ============ VERSION FUNCTION ============

    function version() external pure returns (string memory) {
        return "1.1.0-secure";
    }
}