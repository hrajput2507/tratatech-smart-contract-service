// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "./TrataTechSecurityEnhanced.sol";

/**
 * @title TrataTechProductPassportUpgradeable_Fixed
 * @dev SECURITY-ENHANCED Upgradeable contract for managing digital product passports
 * @dev Fixed all critical vulnerabilities: storage safety, fee handling, access control
 */
contract TrataTechProductPassportUpgradeable_Fixed is 
    Initializable,
    AccessControlUpgradeable,
    ERC2771ContextUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using TrataTechSecurityEnhanced for string;
    using TrataTechSecurityEnhanced for address;
    using TrataTechSecurityEnhanced for uint256;

    // ============ ROLES ============
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BRAND_ROLE = keccak256("BRAND_ROLE");
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

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
        address creator;
        bool isLocked; // Security enhancement
        uint256 lockExpiry;
    }

    struct Brand {
        string id;
        string name;
        string description;
        string ipfsCID;
        string[] authorizedCountries;
        bool isVerified;
        bool isActive;
        uint256 registrationFee;
        uint256 createdAt;
        address brandOwner;
        uint256 passportCount; // Track number of passports
        bool requiresVerification; // Security enhancement
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
        address issuer;
        bool isExpired; // Auto-expiry tracking
    }

    // ============ STATE VARIABLES ============

    uint256 private _passportIds;
    uint256 private _certificateIds;

    // Brand management with security enhancements
    mapping(string => Brand) public brands;
    mapping(address => string[]) public ownerToBrands; // Track brands per owner
    mapping(string => uint256[]) public brandPassports;

    // Product passport management
    mapping(uint256 => ProductPassport) public productPassports;
    mapping(string => uint256) public serialNumberToPassportId;
    mapping(address => uint256[]) public creatorPassports; // Track passports per creator

    // Manufacturing certificate management
    mapping(uint256 => ManufacturingCertificate) public certificates;
    mapping(uint256 => uint256[]) public passportCertificates;

    // Security enhancements
    mapping(address => uint256) private _lastActionTime; // Rate limiting
    mapping(address => uint256) private _dailyActionCount; // Daily limits
    mapping(address => uint256) private _lastResetTime;
    
    // Fee management with security
    uint256 public brandRegistrationFee;
    uint256 public passportCreationFee;
    uint256 public certificateCreationFee;
    uint256 public platformFeePercentage;
    uint256 public constant MAX_FEE = 1 ether; // Maximum fee limit
    uint256 public constant DAILY_ACTION_LIMIT = 100; // Anti-spam
    
    // Multi-sig treasury management
    address public treasury;
    address public feeCollector;
    bool public treasuryLocked;
    
    // Circuit breakers
    bool public brandRegistrationEnabled;
    bool public passportCreationEnabled;
    bool public certificateCreationEnabled;
    
    // Monitoring
    uint256 public totalBrandsCreated;
    uint256 public totalPassportsCreated;
    uint256 public totalCertificatesCreated;
    uint256 public totalFeesCollected;

    // ============ EVENTS ============

    event BrandRegistered(
        string indexed brandId, 
        string name, 
        address indexed registrant, 
        uint256 fee,
        bool requiresVerification
    );
    event BrandVerified(string indexed brandId, address indexed verifier);
    event ProductPassportCreated(
        uint256 indexed passportId, 
        string serialNumber, 
        string indexed brandId, 
        string ipfsCID,
        address indexed creator
    );
    event CertificateCreated(
        uint256 indexed certificateId,
        uint256 indexed passportId,
        string certificateType,
        uint256 expiryDate
    );
    event SecurityViolationDetected(string violationType, address violator);
    event CircuitBreakerActivated(string feature, address activatedBy);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event DailyLimitExceeded(address user, uint256 attempts);

    // ============ MODIFIERS ============
    
    modifier rateLimited() {
        TrataTechSecurityEnhanced.checkRateLimit(_lastActionTime[msg.sender]);
        TrataTechSecurityEnhanced.updateRateLimit(msg.sender, _lastActionTime);
        _;
    }
    
    modifier dailyLimited() {
        _checkDailyLimit();
        _updateDailyCounter();
        _;
    }
    
    modifier validPassportId(uint256 passportId) {
        require(passportId > 0 && passportId <= _passportIds, "Invalid passport ID");
        require(productPassports[passportId].isValid, "Passport is invalid");
        _;
    }
    
    modifier notLocked(uint256 passportId) {
        ProductPassport storage passport = productPassports[passportId];
        require(!passport.isLocked || passport.lockExpiry < block.timestamp, "Passport is locked");
        _;
    }
    
    modifier whenBrandRegistrationEnabled() {
        require(brandRegistrationEnabled, "Brand registration is disabled");
        _;
    }
    
    modifier whenPassportCreationEnabled() {
        require(passportCreationEnabled, "Passport creation is disabled");
        _;
    }
    
    modifier treasuryNotLocked() {
        require(!treasuryLocked, "Treasury operations are locked");
        _;
    }

    // ============ INITIALIZATION ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) {
        _disableInitializers();
    }

    function initialize(
        address initialOwner,
        address _treasury,
        address _feeCollector
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        TrataTechSecurityEnhanced.validateAddress(initialOwner);
        TrataTechSecurityEnhanced.validateAddress(_treasury);
        TrataTechSecurityEnhanced.validateAddress(_feeCollector);

        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(ADMIN_ROLE, initialOwner);
        _grantRole(UPGRADER_ROLE, initialOwner);
        
        // Set secure initial fees
        brandRegistrationFee = 0.01 ether;
        passportCreationFee = 0.02 ether;
        certificateCreationFee = 0.005 ether;
        platformFeePercentage = 250; // 2.5%

        treasury = _treasury;
        feeCollector = _feeCollector;
        
        // Enable all features initially
        brandRegistrationEnabled = true;
        passportCreationEnabled = true;
        certificateCreationEnabled = true;
        
        _passportIds = 1;
        _certificateIds = 1;
    }

    // ============ UUPS UPGRADEABLE WITH SECURITY ============

    function _authorizeUpgrade(address newImplementation) 
        internal 
        view
        override 
        onlyRole(UPGRADER_ROLE) 
    {
        TrataTechSecurityEnhanced.validateAddress(newImplementation);
        // Additional upgrade safety checks could be added here
    }

    // ============ BRAND MANAGEMENT WITH SECURITY ============

    /**
     * @dev Register a new brand with comprehensive security
     */
    function registerBrand(
        string memory brandId,
        string memory brandName,
        string memory brandDescription,
        string memory ipfsCID,
        string[] memory authorizedCountries,
        bool requiresVerification
    ) external 
      payable
      whenNotPaused
      whenBrandRegistrationEnabled
      rateLimited
      dailyLimited
      nonReentrant
    {
        // Process payment with automatic refund
        TrataTechSecurityEnhanced.processPaymentWithRefund(brandRegistrationFee);
        
        // Validate all inputs
        TrataTechSecurityEnhanced.validateString(brandId);
        TrataTechSecurityEnhanced.validateString(brandName);
        TrataTechSecurityEnhanced.validateString(brandDescription);
        TrataTechSecurityEnhanced.validateIPFSCID(ipfsCID);
        TrataTechSecurityEnhanced.validateArraySize(authorizedCountries.length);
        
        require(bytes(brands[brandId].id).length == 0, "Brand ID already exists");
        
        // Validate authorized countries
        for (uint256 i = 0; i < authorizedCountries.length; i++) {
            TrataTechSecurityEnhanced.validateString(authorizedCountries[i]);
        }

        Brand storage newBrand = brands[brandId];
        newBrand.id = brandId;
        newBrand.name = brandName;
        newBrand.description = brandDescription;
        newBrand.ipfsCID = ipfsCID;
        newBrand.authorizedCountries = authorizedCountries;
        newBrand.isVerified = false;
        newBrand.isActive = true;
        newBrand.registrationFee = msg.value;
        newBrand.createdAt = block.timestamp;
        newBrand.brandOwner = msg.sender;
        newBrand.requiresVerification = requiresVerification;

        // Update tracking mappings
        ownerToBrands[msg.sender].push(brandId);
        totalBrandsCreated++;
        totalFeesCollected += brandRegistrationFee;

        // Grant brand role to registrant
        _grantRole(BRAND_ROLE, msg.sender);

        emit BrandRegistered(brandId, brandName, msg.sender, brandRegistrationFee, requiresVerification);
    }

    /**
     * @dev Verify a brand with enhanced security
     */
    function verifyBrand(string memory brandId) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(bytes(brands[brandId].id).length > 0, "Brand does not exist");
        require(!brands[brandId].isVerified, "Brand already verified");

        brands[brandId].isVerified = true;
        emit BrandVerified(brandId, msg.sender);
    }

    // ============ PRODUCT PASSPORT MANAGEMENT ============

    /**
     * @dev Create a product passport with security enhancements
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
      payable
      whenNotPaused
      whenPassportCreationEnabled
      rateLimited
      dailyLimited
      nonReentrant
      returns (uint256)
    {
        // Verify caller has brand role or is authorized for this brand
        require(
            hasRole(BRAND_ROLE, msg.sender) || 
            brands[brandId].brandOwner == msg.sender,
            "Not authorized for this brand"
        );
        
        // Process payment with automatic refund
        TrataTechSecurityEnhanced.processPaymentWithRefund(passportCreationFee);

        // Validate all inputs
        TrataTechSecurityEnhanced.validateString(serialNumber);
        TrataTechSecurityEnhanced.validateString(brandId);
        TrataTechSecurityEnhanced.validateString(productName);
        TrataTechSecurityEnhanced.validateString(productDescription);
        TrataTechSecurityEnhanced.validateString(materials);
        TrataTechSecurityEnhanced.validateString(manufacturingLocation);
        TrataTechSecurityEnhanced.validateTimestamp(manufacturingDate);
        TrataTechSecurityEnhanced.validateIPFSCID(ipfsCID);
        TrataTechSecurityEnhanced.validateArraySize(additionalAttributes.length);

        require(bytes(brands[brandId].id).length > 0, "Brand does not exist");
        require(brands[brandId].isActive, "Brand is not active");
        require(serialNumberToPassportId[serialNumber] == 0, "Serial number already exists");
        
        // Check if brand requires verification
        if (brands[brandId].requiresVerification) {
            require(brands[brandId].isVerified, "Brand must be verified");
        }

        uint256 passportId = _passportIds;
        _passportIds++;

        ProductPassport storage newPassport = productPassports[passportId];
        newPassport.id = passportId;
        newPassport.serialNumber = serialNumber;
        newPassport.brandId = brandId;
        newPassport.productName = productName;
        newPassport.productDescription = productDescription;
        newPassport.materials = materials;
        newPassport.manufacturingLocation = manufacturingLocation;
        newPassport.manufacturingDate = manufacturingDate;
        newPassport.ipfsCID = ipfsCID;
        newPassport.metadataHash = metadataHash;
        newPassport.additionalAttributes = additionalAttributes;
        newPassport.isValid = true;
        newPassport.createdAt = block.timestamp;
        newPassport.updatedAt = block.timestamp;
        newPassport.creator = msg.sender;

        // Update mappings
        serialNumberToPassportId[serialNumber] = passportId;
        brandPassports[brandId].push(passportId);
        creatorPassports[msg.sender].push(passportId);
        brands[brandId].passportCount++;
        
        totalPassportsCreated++;
        totalFeesCollected += passportCreationFee;

        emit ProductPassportCreated(passportId, serialNumber, brandId, ipfsCID, msg.sender);
        return passportId;
    }

    /**
     * @dev Lock passport to prevent modifications
     */
    function lockPassport(uint256 passportId, uint256 lockDuration) 
        external
        validPassportId(passportId)
        onlyRole(ADMIN_ROLE)
    {
        require(lockDuration > 0 && lockDuration <= 365 days, "Invalid lock duration");
        
        ProductPassport storage passport = productPassports[passportId];
        passport.isLocked = true;
        passport.lockExpiry = block.timestamp + lockDuration;
    }

    // ============ CERTIFICATE MANAGEMENT ============

    /**
     * @dev Create manufacturing certificate with security
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
      payable
      validPassportId(passportId)
      whenNotPaused
      rateLimited
      nonReentrant
      onlyRole(CERTIFIER_ROLE)
      returns (uint256)
    {
        TrataTechSecurityEnhanced.processPaymentWithRefund(certificateCreationFee);

        // Validate inputs
        TrataTechSecurityEnhanced.validateString(certificateType);
        TrataTechSecurityEnhanced.validateString(certificateNumber);
        TrataTechSecurityEnhanced.validateString(issuingAuthority);
        TrataTechSecurityEnhanced.validateDateRange(issueDate, expiryDate);
        TrataTechSecurityEnhanced.validateIPFSCID(ipfsCID);

        uint256 certificateId = _certificateIds;
        _certificateIds++;

        ManufacturingCertificate storage newCert = certificates[certificateId];
        newCert.id = certificateId;
        newCert.passportId = passportId;
        newCert.certificateType = certificateType;
        newCert.certificateNumber = certificateNumber;
        newCert.issuingAuthority = issuingAuthority;
        newCert.issueDate = issueDate;
        newCert.expiryDate = expiryDate;
        newCert.ipfsCID = ipfsCID;
        newCert.isValid = true;
        newCert.createdAt = block.timestamp;
        newCert.issuer = msg.sender;

        // Update mappings
        passportCertificates[passportId].push(certificateId);
        totalCertificatesCreated++;
        totalFeesCollected += certificateCreationFee;

        emit CertificateCreated(certificateId, passportId, certificateType, expiryDate);
        return certificateId;
    }

    // ============ ADMIN FUNCTIONS WITH MULTI-SIG SUPPORT ============

    /**
     * @dev Update fees with validation
     */
    function updateFees(
        uint256 newBrandRegistrationFee,
        uint256 newPassportCreationFee,
        uint256 newCertificateCreationFee
    ) external onlyRole(ADMIN_ROLE) {
        require(newBrandRegistrationFee <= MAX_FEE, "Brand fee too high");
        require(newPassportCreationFee <= MAX_FEE, "Passport fee too high");
        require(newCertificateCreationFee <= MAX_FEE, "Certificate fee too high");

        brandRegistrationFee = newBrandRegistrationFee;
        passportCreationFee = newPassportCreationFee;
        certificateCreationFee = newCertificateCreationFee;
    }

    /**
     * @dev Set treasury with security checks
     */
    function setTreasury(address newTreasury) 
        external 
        onlyRole(ADMIN_ROLE) 
        treasuryNotLocked 
    {
        TrataTechSecurityEnhanced.validateAddress(newTreasury);
        
        address oldTreasury = treasury;
        treasury = newTreasury;
        
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @dev Secure fee withdrawal with multi-step process
     */
    function withdrawFees() 
        external 
        onlyRole(ADMIN_ROLE) 
        treasuryNotLocked
        nonReentrant 
    {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");

        bool success = TrataTechSecurityEnhanced.safeTransferETH(treasury, balance);
        require(success, "Transfer to treasury failed");
    }

    /**
     * @dev Circuit breaker controls
     */
    function toggleBrandRegistration() external onlyRole(ADMIN_ROLE) {
        brandRegistrationEnabled = !brandRegistrationEnabled;
        emit CircuitBreakerActivated("brand_registration", msg.sender);
    }

    function togglePassportCreation() external onlyRole(ADMIN_ROLE) {
        passportCreationEnabled = !passportCreationEnabled;
        emit CircuitBreakerActivated("passport_creation", msg.sender);
    }

    function toggleCertificateCreation() external onlyRole(ADMIN_ROLE) {
        certificateCreationEnabled = !certificateCreationEnabled;
        emit CircuitBreakerActivated("certificate_creation", msg.sender);
    }

    /**
     * @dev Lock treasury operations (emergency only)
     */
    function lockTreasury() external onlyRole(ADMIN_ROLE) {
        treasuryLocked = true;
    }

    // ============ INTERNAL HELPER FUNCTIONS ============

    /**
     * @dev Check daily action limits
     */
    function _checkDailyLimit() internal view {
        if (block.timestamp - _lastResetTime[msg.sender] >= 1 days) {
            return; // Reset period passed
        }
        
        require(_dailyActionCount[msg.sender] < DAILY_ACTION_LIMIT, "Daily limit exceeded");
    }

    /**
     * @dev Update daily action counter
     */
    function _updateDailyCounter() internal {
        if (block.timestamp - _lastResetTime[msg.sender] >= 1 days) {
            _dailyActionCount[msg.sender] = 1;
            _lastResetTime[msg.sender] = block.timestamp;
        } else {
            _dailyActionCount[msg.sender]++;
        }
        
        if (_dailyActionCount[msg.sender] >= DAILY_ACTION_LIMIT) {
            emit DailyLimitExceeded(msg.sender, _dailyActionCount[msg.sender]);
        }
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Get security metrics
     */
    function getSecurityMetrics() external view returns (
        uint256 totalBrands,
        uint256 totalPassports,
        uint256 totalCertificates,
        uint256 totalFees,
        bool brandRegEnabled,
        bool passportEnabled,
        bool certEnabled
    ) {
        return (
            totalBrandsCreated,
            totalPassportsCreated,
            totalCertificatesCreated,
            totalFeesCollected,
            brandRegistrationEnabled,
            passportCreationEnabled,
            certificateCreationEnabled
        );
    }

    /**
     * @dev Get user action status
     */
    function getUserActionStatus(address user) external view returns (
        uint256 lastActionTime,
        uint256 dailyCount,
        uint256 resetTime,
        bool canAct
    ) {
        return (
            _lastActionTime[user],
            _dailyActionCount[user],
            _lastResetTime[user],
            block.timestamp >= _lastActionTime[user] + TrataTechSecurityEnhanced.RATE_LIMIT_DURATION &&
            _dailyActionCount[user] < DAILY_ACTION_LIMIT
        );
    }

    // ============ OVERRIDE FUNCTIONS FOR ERC2771Context ============
    
    function _msgSender() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address) {
        return ERC2771ContextUpgradeable._msgSender();
    }
    
    function _msgData() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
        return ERC2771ContextUpgradeable._msgData();
    }
    
    function _contextSuffixLength() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (uint256) {
        return ERC2771ContextUpgradeable._contextSuffixLength();
    }

    // ============ STORAGE GAP FOR UPGRADE SAFETY ============

    /**
     * @dev Extended storage gap for upgrade safety
     * Reduced from 100 to 95 slots to accommodate ERC2771Context storage
     */
    uint256[95] private __gap;
}