// TrataTech Main Contract ABI
export const TRATATECH_MAIN_ABI = [
  // Events
  "event EventCreated(uint256 indexed eventId, bytes32 eventNameHash, uint256 eventDate, string ipfsCID)",
  "event EventCancelled(uint256 indexed eventId, address indexed canceller)",
  "event RSVPSubmitted(uint256 indexed eventId, address indexed attendee, uint256 tokenId)",
  "event RSVPCancelled(uint256 indexed eventId, address indexed attendee)",
  "event ProductLaunchCreated(uint256 indexed launchId, bytes32 productNameHash, uint256 launchDate, string ipfsCID)",
  "event EarlyAccessGranted(uint256 indexed launchId, address indexed user, uint256 tokenId)",
  "event PreOrderPlaced(uint256 indexed launchId, address indexed user, uint256 amount)",
  "event DPPCreated(uint256 indexed dppId, bytes32 productIdHash, bytes32 brandIdHash, string ipfsCID)",
  "event DPPInvalidated(uint256 indexed dppId, address indexed invalidator)",
  "event ArtDropCreated(uint256 indexed dropId, bytes32 artistNameHash, string artworkTitle, string ipfsCID)",
  "event ArtAirdropped(uint256 indexed dropId, address indexed recipient, uint256 tokenId)",
  "event OfferCreated(uint256 indexed offerId, bytes32 titleHash, uint256 discountPercentage, string ipfsCID)",
  "event OfferRedeemed(uint256 indexed offerId, address indexed user, uint256 tokenId)",
  "event OfferExpired(uint256 indexed offerId)",
  "event PlatformFeeUpdated(uint256 oldFee, uint256 newFee, address indexed updater)",
  "event FeeLimitsUpdated(uint256 minFee, uint256 maxFee, address indexed updater)",
  "event EmergencyWithdrawal(address indexed to, uint256 amount)",

  // Functions
  "function createEventInvite(string memory eventName, string memory eventDescription, uint256 eventDate, uint256 maxAttendees, string memory ipfsCID) external returns (uint256)",
  "function submitRSVP(uint256 eventId) external",
  "function cancelRSVP(uint256 eventId) external",
  "function cancelEvent(uint256 eventId) external",
  "function createProductLaunch(string memory productName, string memory productDescription, uint256 launchDate, uint256 earlyAccessEndDate, uint256 maxEarlyAccess, string memory ipfsCID) external returns (uint256)",
  "function placePreOrder(uint256 launchId) external payable",
  "function airdropArtwork(uint256 dropId, address[] memory recipients) external",
  "function redeemOffer(uint256 offerId, bytes32[] memory merkleProof) external",
  "function updatePlatformFee(uint256 newFee) external",
  "function updateFeeLimits(uint256 minFee, uint256 maxFee) external",
  "function pause() external",
  "function unpause() external",
  "function emergencyRecoverETH(address to, uint256 amount) external",
  "function platformFee() external view returns (uint256)",
  "function feeLimits() external view returns (uint256 min, uint256 max)",
  "function owner() external view returns (address)",
  "function supportsInterface(bytes4 interfaceId) external view returns (bool)",
];

// TrataTech Product Passport Contract ABI
export const TRATATECH_PRODUCT_PASSPORT_ABI = [
  // Events
  "event BrandRegistered(string indexed brandId, string brandName, address indexed brandAddress, string ipfsCID, bool requiresApproval, uint256 fee)",
  "event BrandApproved(string indexed brandId, address indexed approver, uint256 approvalDate)",
  "event BrandVerified(string indexed brandId, address indexed verifier, uint256 verificationFee)",
  "event ProductPassportCreated(uint256 indexed passportId, string serialNumber, string brandId, string productName, string ipfsCID, address indexed creator)",
  "event ManufacturingCertificateCreated(uint256 indexed certificateId, uint256 indexed passportId, string certificateType, string certificateNumber, string ipfsCID, address indexed issuer)",
  "event SecurityViolationDetected(string violationType, address violator)",
  "event CircuitBreakerActivated(string feature, address activatedBy)",
  "event BrandIdReserved(string brandId, address reservedBy)",
  "event DailyLimitExceeded(address user, uint256 attempts)",
  "event TreasuryUpdated(address oldTreasury, address newTreasury)",

  // Functions
  "function registerBrand(string memory brandId, string memory brandName, string memory brandDescription, string memory ipfsCID, string[] memory authorizedCountries) external payable",
  "function approveBrand(string memory brandId) external",
  "function verifyBrand(string memory brandId) external payable",
  "function reserveBrandId(string memory brandId) external",
  "function createProductPassport(string memory serialNumber, string memory brandId, string memory productName, string memory productDescription, string memory materials, string memory manufacturingLocation, uint256 manufacturingDate, string memory ipfsCID, string memory metadataHash) external payable returns (uint256)",
  "function updateProductPassport(uint256 passportId, string memory ipfsCID, string memory metadataHash) external",
  "function lockPassport(uint256 passportId) external",
  "function createManufacturingCertificate(uint256 passportId, string memory certificateType, string memory certificateNumber, string memory issuingAuthority, uint256 issueDate, uint256 expiryDate, string memory ipfsCID) external payable returns (uint256)",
  "function updateFees(uint256 newPassportFee, uint256 newCertificateFee, uint256 newBrandRegistrationFee, uint256 newBrandVerificationFee) external",
  "function blacklistAddress(address addr, bool status) external",
  "function toggleBrandRegistration() external",
  "function togglePassportCreation() external",
  "function toggleCertificateCreation() external",
  "function toggleApprovalRequired() external",
  "function toggleAutomaticVerification() external",
  "function setTreasury(address newTreasury) external",
  "function withdrawFees() external",
  "function pause() external",
  "function unpause() external",
  "function getBrandDetailsWithSecurity(string memory brandId) external view returns (string memory name, bool isActive, bool isVerified, bool isPending, address brandAddress, uint256 passportCount, uint256 registrationDate)",
  "function getSecurityMetrics() external view returns (uint256 totalBrands, uint256 totalVerified, uint256 totalPassports, uint256 totalCertificates, uint256 totalFees, bool brandRegEnabled, bool passportEnabled, bool certEnabled, bool approvalRequired)",
  "function isBlacklisted(address addr) external view returns (bool)",
  "function getUserActionStatus(address user) external view returns (uint256 lastActionTime, uint256 dailyCount, bool canAct)",
];

// TrataTech Ownership Registry Contract ABI
export const TRATATECH_OWNERSHIP_REGISTRY_ABI = [
  // Events
  "event OwnershipDeedCreated(uint256 indexed deedId, uint256 indexed passportId, address indexed owner, uint256 acquisitionPrice, string acquisitionMethod, string ipfsCID)",
  "event OwnershipDeedTransferred(uint256 indexed deedId, address indexed from, address indexed to, uint256 transferPrice, uint8 transferType)",
  "event TransferRequestCreated(uint256 indexed requestId, uint256 indexed deedId, address indexed from, address to, uint256 proposedPrice)",
  "event RoyaltyPaid(uint256 indexed deedId, address indexed recipient, uint256 amount, uint256 transferPrice)",
  "event SecurityViolationDetected(string violationType, address violator, uint256 deedId)",
  "event CircuitBreakerActivated(string feature, address activatedBy)",
  "event AddressBlacklisted(address blacklisted, string reason)",

  // Functions
  "function createOwnershipDeed(uint256 passportId, address owner, uint256 acquisitionPrice, string memory acquisitionMethod, string memory ipfsCID, string memory metadataHash, string[] memory additionalData) external returns (uint256)",
  "function transferOwnershipDeed(uint256 deedId, address to, uint256 transferPrice, uint8 transferType, string memory ipfsCID) external payable",
  "function lockDeed(uint256 deedId, uint256 lockDuration) external",
  "function unlockDeed(uint256 deedId) external",
  "function createTransferRequest(uint256 deedId, address to, uint256 proposedPrice, string memory transferReason) external returns (uint256)",
  "function executeTransferRequest(uint256 requestId, string memory ipfsCID) external payable",
  "function setRoyalty(uint256 deedId, address recipient, uint256 percentage, uint256 maxAmount) external",
  "function blacklistAddress(address addr, string memory reason) external",
  "function setSecurityLimits(uint256 newMaxRequests, uint256 newMaxDailyTransfers, uint256 newApprovalPeriod) external",
  "function toggleTransfers() external",
  "function toggleRoyalties() external",
  "function toggleRequests() external",
  "function withdrawFees(address payable recipient) external",
  "function getPendingTransferRequestsPaginated(uint256 deedId, uint256 offset, uint256 limit) external view returns (uint256[] memory)",
  "function getSecurityMetrics() external view returns (uint256 totalDeeds, uint256 totalTransfers, uint256 totalRoyalties, uint256 totalFees, bool transfersActive, bool royaltiesActive, bool requestsActive)",
  "function supportsInterface(bytes4 interfaceId) external view returns (bool)",
];

// TrataTech Provenance Contract ABI
export const TRATATECH_PROVENANCE_ABI = [
  // Events
  "event ProvenanceEntryCreated(uint256 indexed entryId, uint256 indexed passportId, uint8 entryType, address indexed from, address to, string location, string ipfsCID)",
  "event ServiceRecordCreated(uint256 indexed serviceId, uint256 indexed passportId, string serviceType, string serviceProvider, string ipfsCID)",
  "event BatchOperationCompleted(uint256 entriesCreated, uint256 gasUsed)",
  "event CircuitBreakerTriggered(string operation, address triggeredBy)",
  "event SecurityViolationDetected(string violationType, address violator)",
  "event FeesWithdrawn(address recipient, uint256 amount)",

  // Functions
  "function createProvenanceEntry(uint256 passportId, uint8 entryType, address from, address to, string memory location, string memory description, string memory ipfsCID, string memory metadataHash, string[] memory additionalData) external payable",
  "function createBatchProvenanceEntries(uint256[] memory passportIds, uint8[] memory entryTypes, address[] memory froms, address[] memory tos, string[] memory locations, string[] memory descriptions, string[] memory ipfsCIDs, string[] memory metadataHashes) external payable",
  "function createServiceRecord(uint256 passportId, string memory serviceType, string memory serviceProvider, string memory serviceDescription, uint256 serviceDate, uint256 nextServiceDate, string memory ipfsCID, string memory certificateNumber, string[] memory serviceDetails) external payable",
  "function setFees(uint256 newProvenanceFee, uint256 newServiceFee) external",
  "function toggleTransfers() external",
  "function toggleServiceCreation() external",
  "function toggleBatchOperations() external",
  "function withdrawFees(address payable recipient) external",
  "function pause() external",
  "function unpause() external",
  "function getPassportEntriesPaginated(uint256 passportId, uint256 offset, uint256 limit) external view returns (uint256[] memory)",
  "function getSecurityMetrics() external view returns (uint256 totalEntries, uint256 totalServices, uint256 totalFees, bool transfersActive, bool servicesActive, bool batchActive)",
];

// ERC2771 Forwarder Contract ABI
export const ERC2771_FORWARDER_ABI = [
  // Events
  "event MetaTransactionExecuted(address indexed user, address indexed relayer, bytes functionSignature)",
  "event RelayerAdded(address indexed relayer)",
  "event RelayerRemoved(address indexed relayer)",

  // Functions
  "function execute(address userAddress, bytes functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) external payable returns (bytes memory)",
  "function getNonce(address user) external view returns (uint256 nonce)",
  "function isRelayer(address relayer) external view returns (bool)",
  "function addRelayer(address relayer) external",
  "function removeRelayer(address relayer) external",
];

// ERC721 Standard ABI (for NFT operations)
export const ERC721_ABI = [
  "function balanceOf(address owner) external view returns (uint256 balance)",
  "function ownerOf(uint256 tokenId) external view returns (address owner)",
  "function safeTransferFrom(address from, address to, uint256 tokenId) external",
  "function transferFrom(address from, address to, uint256 tokenId) external",
  "function approve(address to, uint256 tokenId) external",
  "function getApproved(uint256 tokenId) external view returns (address operator)",
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address owner, address operator) external view returns (bool)",
  "function totalSupply() external view returns (uint256)",
  "function tokenByIndex(uint256 index) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function name() external view returns (string memory)",
  "function symbol() external view returns (string memory)",
  "function tokenURI(uint256 tokenId) external view returns (string memory)",
  "function supportsInterface(bytes4 interfaceId) external view returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
  "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
];
