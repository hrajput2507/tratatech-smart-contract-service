// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./TrataTechSecurityEnhanced.sol";

/**
 * @title TrataTechProductPassport_Fixed
 * @dev SECURITY-ENHANCED Product Passport Contract with comprehensive security fixes
 * @dev Fixed all critical vulnerabilities: access control, fee handling, brand registration
 */
contract TrataTechProductPassport_Fixed is AccessControl, ERC2771Context, Pausable, ReentrancyGuard {

    using ECDSA for bytes32;
    using TrataTechSecurityEnhanced for string;
    using TrataTechSecurityEnhanced for address;
    using TrataTechSecurityEnhanced for uint256;

    // ============ ROLES ============
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BRAND_ROLE = keccak256("BRAND_ROLE");
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant BRAND_APPROVER_ROLE = keccak256("BRAND_APPROVER_ROLE");

    // ============ STRUCTS ============
    
    struct ProductPassport {
        uint256 passportId;
        string serialNumber;
        string brandId;
        string productName;
        string productDescription;
        string materials;
        string manufacturingLocation;
        uint256 manufacturingDate;
        uint256 creationTimestamp;
        string ipfsCID;
        string metadataHash;
        bool isValid;
        bool isRecalled;
        address creator;
        address brandAddress;
        mapping(string => string) additionalAttributes;
        string[] attributeKeys;
        uint256 updateCount; // Track number of updates
        bool isLocked; // Prevent unauthorized changes
    }

    struct Brand {
        string brandId;
        string brandName;
        string brandDescription;
        string ipfsCID;
        bool isActive;
        bool isVerified;
        bool isPending; // Pending approval
        address brandAddress;
        uint256 registrationDate;
        string[] authorizedCountries;
        mapping(string => bool) countryAuthorizations;
        uint256 passportCount; // Number of passports created
        uint256 registrationFee; // Fee paid during registration
        address approver; // Who approved this brand
        uint256 approvalDate;
    }

    struct ManufacturingCertificate {
        uint256 certificateId;
        uint256 passportId;
        string certificateType;
        string certificateNumber;
        string issuingAuthority;
        uint256 issueDate;
        uint256 expiryDate;
        string ipfsCID;
        bool isValid;
        address issuer;
        bool isExpired; // Auto-calculated expiry status
        uint256 validationCount; // Track validations
    }

    // ============ STATE VARIABLES ============
    
    uint256 private _passportIds;
    uint256 private _certificateIds;

    // Core mappings
    mapping(uint256 => ProductPassport) public productPassports;
    mapping(string => Brand) public brands;
    mapping(uint256 => ManufacturingCertificate) public certificates;
    mapping(string => uint256) public serialNumberToPassportId;
    
    // Brand management with security
    mapping(address => string[]) public ownerToBrands; // Track brands per owner
    mapping(string => address) public brandIdToAddress;
    mapping(address => string) public addressToBrandId;
    mapping(string => uint256[]) public brandToPassports; // Track passports per brand
    mapping(uint256 => uint256[]) public passportToCertificates; // Track certificates per passport
    
    // Security mappings
    mapping(address => uint256) private _lastActionTime; // Rate limiting
    mapping(address => uint256) private _dailyActionCount; // Daily limits
    mapping(address => uint256) private _lastResetTime;
    mapping(address => bool) private _blacklistedAddresses;
    mapping(string => bool) private _reservedBrandIds; // Prevent squatting
    
    // Fee structure with security limits
    uint256 public passportCreationFee;
    uint256 public certificateCreationFee;
    uint256 public brandRegistrationFee;
    uint256 public brandVerificationFee;
    uint256 public constant MAX_FEE = 1 ether;
    uint256 public constant DAILY_ACTION_LIMIT = 50;
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Circuit breakers and controls
    bool public brandRegistrationEnabled;
    bool public passportCreationEnabled;
    bool public certificateCreationEnabled;
    bool public brandApprovalRequired; // Require admin approval for new brands
    bool public automaticVerification; // Auto-verify upon payment of verification fee
    
    // Treasury and fee management
    address public treasury;
    address public feeCollector;
    bool public treasuryLocked;
    
    // Security tracking
    uint256 public totalBrandsRegistered;
    uint256 public totalBrandsVerified;
    uint256 public totalPassportsCreated;
    uint256 public totalCertificatesCreated;
    uint256 public totalFeesCollected;

    // ============ EVENTS ============
    
    event BrandRegistered(
        string indexed brandId,
        string brandName,
        address indexed brandAddress,
        string ipfsCID,
        bool requiresApproval,
        uint256 fee
    );
    
    event BrandApproved(
        string indexed brandId,
        address indexed approver,
        uint256 approvalDate
    );
    
    event BrandVerified(
        string indexed brandId,
        address indexed verifier,
        uint256 verificationFee
    );
    
    event ProductPassportCreated(
        uint256 indexed passportId,
        string serialNumber,
        string brandId,
        string productName,
        string ipfsCID,
        address indexed creator
    );
    
    event ManufacturingCertificateCreated(
        uint256 indexed certificateId,
        uint256 indexed passportId,
        string certificateType,
        string certificateNumber,
        string ipfsCID,
        address indexed issuer
    );
    
    event SecurityViolationDetected(string violationType, address violator);
    event CircuitBreakerActivated(string feature, address activatedBy);
    event BrandIdReserved(string brandId, address reservedBy);
    event DailyLimitExceeded(address user, uint256 attempts);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

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
    
    modifier notBlacklisted(address addr) {
        require(!_blacklistedAddresses[addr], "Address is blacklisted");
        _;
    }
    
    modifier validPassport(uint256 passportId) {
        require(productPassports[passportId].passportId != 0, "Passport does not exist");
        require(productPassports[passportId].isValid, "Passport is invalid");
        require(!productPassports[passportId].isRecalled, "Passport is recalled");
        _;
    }
    
    modifier validBrand(string memory brandId) {
        require(bytes(brands[brandId].brandId).length > 0, "Brand does not exist");
        require(brands[brandId].isActive, "Brand is not active");
        _;
    }
    
    modifier passportNotLocked(uint256 passportId) {
        require(!productPassports[passportId].isLocked, "Passport is locked");
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

    // ============ CONSTRUCTOR ============
    
    constructor(address _treasury, address _feeCollector, address trustedForwarder) 
        ERC2771Context(trustedForwarder) {
        TrataTechSecurityEnhanced.validateAddress(_treasury);
        TrataTechSecurityEnhanced.validateAddress(_feeCollector);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(BRAND_APPROVER_ROLE, msg.sender);
        
        treasury = _treasury;
        feeCollector = _feeCollector;
        
        // Set secure initial fees
        passportCreationFee = 0.01 ether;
        certificateCreationFee = 0.005 ether;
        brandRegistrationFee = 0.02 ether;
        brandVerificationFee = 0.01 ether;
        
        // Enable features with security defaults
        brandRegistrationEnabled = true;
        passportCreationEnabled = true;
        certificateCreationEnabled = true;
        brandApprovalRequired = true; // Require approval by default
        automaticVerification = false; // Manual verification by default
        
        _passportIds = 1;
        _certificateIds = 1;
    }

    // ============ BRAND MANAGEMENT WITH SECURITY ============
    
    /**
     * @dev Register a new brand with approval workflow and security checks
     */
    function registerBrand(
        string memory brandId,
        string memory brandName,
        string memory brandDescription,
        string memory ipfsCID,
        string[] memory authorizedCountries
    ) external 
      payable
      whenNotPaused
      whenBrandRegistrationEnabled
      rateLimited
      dailyLimited
      notBlacklisted(msg.sender)
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
        
        require(bytes(brands[brandId].brandId).length == 0, "Brand ID already exists");
        require(!_reservedBrandIds[brandId], "Brand ID is reserved");
        require(brandIdToAddress[brandId] == address(0), "Brand ID already registered");
        
        // Validate authorized countries
        for (uint256 i = 0; i < authorizedCountries.length; i++) {
            TrataTechSecurityEnhanced.validateString(authorizedCountries[i]);
        }

        Brand storage newBrand = brands[brandId];
        newBrand.brandId = brandId;
        newBrand.brandName = brandName;
        newBrand.brandDescription = brandDescription;
        newBrand.ipfsCID = ipfsCID;
        newBrand.isActive = true;
        newBrand.isVerified = false;
        newBrand.isPending = brandApprovalRequired;
        newBrand.brandAddress = msg.sender;
        newBrand.registrationDate = block.timestamp;
        newBrand.authorizedCountries = authorizedCountries;
        newBrand.registrationFee = brandRegistrationFee;
        
        // Set country authorizations
        for (uint256 i = 0; i < authorizedCountries.length; i++) {
            newBrand.countryAuthorizations[authorizedCountries[i]] = true;
        }
        
        // Update mappings
        brandIdToAddress[brandId] = msg.sender;
        addressToBrandId[msg.sender] = brandId;
        ownerToBrands[msg.sender].push(brandId);
        
        // If approval not required, grant brand role immediately
        if (!brandApprovalRequired) {
            _grantRole(BRAND_ROLE, msg.sender);
            newBrand.isPending = false;
        }
        
        totalBrandsRegistered++;
        totalFeesCollected += brandRegistrationFee;
        
        emit BrandRegistered(
            brandId, 
            brandName, 
            msg.sender, 
            ipfsCID, 
            brandApprovalRequired,
            brandRegistrationFee
        );
    }
    
    /**
     * @dev Approve a pending brand (admin only)
     */
    function approveBrand(string memory brandId) 
        external 
        onlyRole(BRAND_APPROVER_ROLE)
        validBrand(brandId)
    {
        Brand storage brand = brands[brandId];
        require(brand.isPending, "Brand is not pending approval");
        
        brand.isPending = false;
        brand.approver = msg.sender;
        brand.approvalDate = block.timestamp;
        
        // Grant brand role to brand owner
        _grantRole(BRAND_ROLE, brand.brandAddress);
        
        emit BrandApproved(brandId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Verify a brand with fee payment or admin action
     */
    function verifyBrand(string memory brandId) 
        external 
        payable
        validBrand(brandId)
        nonReentrant
    {
        Brand storage brand = brands[brandId];
        require(!brand.isVerified, "Brand already verified");
        require(!brand.isPending, "Brand pending approval");
        
        bool isAdmin = hasRole(ADMIN_ROLE, msg.sender);
        bool isBrandOwner = brand.brandAddress == msg.sender;
        
        if (isAdmin) {
            // Admin can verify without payment
            if (msg.value > 0) {
                // Refund any payment sent by admin
                (bool success, ) = payable(msg.sender).call{value: msg.value}("");
                require(success, "Refund failed");
            }
        } else if (isBrandOwner && automaticVerification) {
            // Brand owner can pay for automatic verification
            TrataTechSecurityEnhanced.processPaymentWithRefund(brandVerificationFee);
            totalFeesCollected += brandVerificationFee;
        } else {
            revert("Not authorized to verify brand");
        }
        
        brand.isVerified = true;
        totalBrandsVerified++;
        
        emit BrandVerified(brandId, msg.sender, msg.value);
    }
    
    /**
     * @dev Reserve brand ID to prevent squatting (admin only)
     */
    function reserveBrandId(string memory brandId) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        TrataTechSecurityEnhanced.validateString(brandId);
        require(bytes(brands[brandId].brandId).length == 0, "Brand ID already exists");
        
        _reservedBrandIds[brandId] = true;
        emit BrandIdReserved(brandId, msg.sender);
    }

    // ============ PRODUCT PASSPORT MANAGEMENT ============
    
    /**
     * @dev Create a new product passport with enhanced security
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
        string memory metadataHash
    ) external 
      payable
      whenNotPaused
      whenPassportCreationEnabled
      rateLimited
      dailyLimited
      validBrand(brandId)
      notBlacklisted(msg.sender)
      nonReentrant
      returns (uint256)
    {
        // Check authorization
        bool isAuthorized = hasRole(BRAND_ROLE, msg.sender) || 
                           brands[brandId].brandAddress == msg.sender ||
                           hasRole(MANUFACTURER_ROLE, msg.sender);
        require(isAuthorized, "Not authorized for this brand");
        
        Brand storage brand = brands[brandId];
        require(!brand.isPending, "Brand is pending approval");
        
        // Process payment with automatic refund
        TrataTechSecurityEnhanced.processPaymentWithRefund(passportCreationFee);
        
        // Validate all inputs
        TrataTechSecurityEnhanced.validateString(serialNumber);
        TrataTechSecurityEnhanced.validateString(productName);
        TrataTechSecurityEnhanced.validateString(productDescription);
        TrataTechSecurityEnhanced.validateString(materials);
        TrataTechSecurityEnhanced.validateString(manufacturingLocation);
        TrataTechSecurityEnhanced.validateTimestamp(manufacturingDate);
        TrataTechSecurityEnhanced.validateIPFSCID(ipfsCID);
        TrataTechSecurityEnhanced.validateString(metadataHash);
        
        require(serialNumberToPassportId[serialNumber] == 0, "Serial number already exists");
        
        uint256 passportId = _passportIds;
        _passportIds++;
        
        ProductPassport storage newPassport = productPassports[passportId];
        newPassport.passportId = passportId;
        newPassport.serialNumber = serialNumber;
        newPassport.brandId = brandId;
        newPassport.productName = productName;
        newPassport.productDescription = productDescription;
        newPassport.materials = materials;
        newPassport.manufacturingLocation = manufacturingLocation;
        newPassport.manufacturingDate = manufacturingDate;
        newPassport.creationTimestamp = block.timestamp;
        newPassport.ipfsCID = ipfsCID;
        newPassport.metadataHash = metadataHash;
        newPassport.isValid = true;
        newPassport.isRecalled = false;
        newPassport.creator = msg.sender;
        newPassport.brandAddress = brandIdToAddress[brandId];
        newPassport.updateCount = 0;
        newPassport.isLocked = false;
        
        // Update mappings
        serialNumberToPassportId[serialNumber] = passportId;
        brandToPassports[brandId].push(passportId);
        brand.passportCount++;
        
        totalPassportsCreated++;
        totalFeesCollected += passportCreationFee;
        
        emit ProductPassportCreated(
            passportId,
            serialNumber,
            brandId,
            productName,
            ipfsCID,
            msg.sender
        );
        
        return passportId;
    }
    
    /**
     * @dev Update product passport metadata with security checks
     */
    function updateProductPassport(
        uint256 passportId,
        string memory ipfsCID,
        string memory metadataHash
    ) external 
      validPassport(passportId) 
      passportNotLocked(passportId)
      rateLimited
      whenNotPaused 
    {
        ProductPassport storage passport = productPassports[passportId];
        
        // Check authorization
        bool isAuthorized = msg.sender == passport.creator || 
                           msg.sender == passport.brandAddress || 
                           hasRole(ADMIN_ROLE, msg.sender) ||
                           hasRole(OPERATOR_ROLE, msg.sender);
        require(isAuthorized, "Not authorized to update passport");
        
        TrataTechSecurityEnhanced.validateIPFSCID(ipfsCID);
        TrataTechSecurityEnhanced.validateString(metadataHash);
        
        passport.ipfsCID = ipfsCID;
        passport.metadataHash = metadataHash;
        passport.updateCount++;
    }
    
    /**
     * @dev Lock passport to prevent further modifications
     */
    function lockPassport(uint256 passportId) 
        external 
        validPassport(passportId)
        onlyRole(ADMIN_ROLE)
    {
        productPassports[passportId].isLocked = true;
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
      validPassport(passportId)
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
        newCert.certificateId = certificateId;
        newCert.passportId = passportId;
        newCert.certificateType = certificateType;
        newCert.certificateNumber = certificateNumber;
        newCert.issuingAuthority = issuingAuthority;
        newCert.issueDate = issueDate;
        newCert.expiryDate = expiryDate;
        newCert.ipfsCID = ipfsCID;
        newCert.isValid = true;
        newCert.issuer = msg.sender;
        newCert.isExpired = block.timestamp > expiryDate;
        newCert.validationCount = 0;
        
        // Update mappings
        passportToCertificates[passportId].push(certificateId);
        
        totalCertificatesCreated++;
        totalFeesCollected += certificateCreationFee;
        
        emit ManufacturingCertificateCreated(
            certificateId,
            passportId,
            certificateType,
            certificateNumber,
            ipfsCID,
            msg.sender
        );
        
        return certificateId;
    }

    // ============ ADMIN FUNCTIONS WITH SECURITY ============
    
    /**
     * @dev Update fees with validation
     */
    function updateFees(
        uint256 newPassportFee,
        uint256 newCertificateFee,
        uint256 newBrandRegistrationFee,
        uint256 newBrandVerificationFee
    ) external onlyRole(ADMIN_ROLE) {
        require(newPassportFee <= MAX_FEE, "Passport fee too high");
        require(newCertificateFee <= MAX_FEE, "Certificate fee too high");
        require(newBrandRegistrationFee <= MAX_FEE, "Brand registration fee too high");
        require(newBrandVerificationFee <= MAX_FEE, "Brand verification fee too high");
        
        passportCreationFee = newPassportFee;
        certificateCreationFee = newCertificateFee;
        brandRegistrationFee = newBrandRegistrationFee;
        brandVerificationFee = newBrandVerificationFee;
    }
    
    /**
     * @dev Blacklist address for security
     */
    function blacklistAddress(address addr, bool status) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        TrataTechSecurityEnhanced.validateAddress(addr);
        _blacklistedAddresses[addr] = status;
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
    
    function toggleApprovalRequired() external onlyRole(ADMIN_ROLE) {
        brandApprovalRequired = !brandApprovalRequired;
    }
    
    function toggleAutomaticVerification() external onlyRole(ADMIN_ROLE) {
        automaticVerification = !automaticVerification;
    }
    
    /**
     * @dev Set treasury with security
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
     * @dev Secure fee withdrawal
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
     * @dev Get brand details with security info
     */
    function getBrandDetailsWithSecurity(string memory brandId) 
        external 
        view 
        returns (
            string memory name,
            bool isActive,
            bool isVerified,
            bool isPending,
            address brandAddress,
            uint256 passportCount,
            uint256 registrationDate
        ) 
    {
        Brand storage brand = brands[brandId];
        return (
            brand.brandName,
            brand.isActive,
            brand.isVerified,
            brand.isPending,
            brand.brandAddress,
            brand.passportCount,
            brand.registrationDate
        );
    }
    
    /**
     * @dev Get security metrics
     */
    function getSecurityMetrics() external view returns (
        uint256 totalBrands,
        uint256 totalVerified,
        uint256 totalPassports,
        uint256 totalCertificates,
        uint256 totalFees,
        bool brandRegEnabled,
        bool passportEnabled,
        bool certEnabled,
        bool approvalRequired
    ) {
        return (
            totalBrandsRegistered,
            totalBrandsVerified,
            totalPassportsCreated,
            totalCertificatesCreated,
            totalFeesCollected,
            brandRegistrationEnabled,
            passportCreationEnabled,
            certificateCreationEnabled,
            brandApprovalRequired
        );
    }
    
    /**
     * @dev Check if address is blacklisted
     */
    function isBlacklisted(address addr) external view returns (bool) {
        return _blacklistedAddresses[addr];
    }
    
    /**
     * @dev Check user action status
     */
    function getUserActionStatus(address user) external view returns (
        uint256 lastActionTime,
        uint256 dailyCount,
        bool canAct
    ) {
        return (
            _lastActionTime[user],
            _dailyActionCount[user],
            block.timestamp >= _lastActionTime[user] + TrataTechSecurityEnhanced.RATE_LIMIT_DURATION &&
            _dailyActionCount[user] < DAILY_ACTION_LIMIT
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