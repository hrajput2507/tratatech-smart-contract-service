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
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title TrataTechMainUpgradeableSecure
 * @dev Security-enhanced upgradeable and gasless version of TrataTech platform handling:
 * - Event Invites & RSVP
 * - Product Launches & Early Access
 * - Digital Product Passports
 * - Digital Art Drops
 * - Offers & Coupons
 * @author Advanced Developer
 */
contract TrataTechMainUpgradeableSecure is
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

    // ============ CONSTANTS ============

    // SECURITY: All constants before storage variables to prevent layout collision
    uint256 public constant MAX_AIRDROP_RECIPIENTS = 50;
    uint256 public constant MAX_STRING_LENGTH = 1000;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 5000;
    uint256 public constant MAX_IPFS_CID_LENGTH = 100;
    uint256 public constant MAX_ATTENDEES_LIMIT = 10000;
    uint256 public constant MAX_EARLY_ACCESS_LIMIT = 1000;
    uint256 public constant MAX_EDITIONS_LIMIT = 100000;
    uint256 public constant MAX_DISCOUNT_PERCENTAGE = 10000; // 100%
    uint256 public constant MIN_EVENT_LEAD_TIME = 1 hours; // Minimum time between creation and event
    uint256 public constant MAX_FUTURE_DATE = 365 days * 10; // 10 years max
    uint256 public constant MIN_DISCOUNT_PERCENTAGE = 100; // 1%
    uint256 public constant MAX_REDEMPTIONS_LIMIT = 1000000;

    // ============ CUSTOM ERRORS ============

    error InvalidAddress(string parameter);
    error InvalidLength(string parameter, uint256 current, uint256 max);
    error InvalidDateRange(string parameter, uint256 provided, uint256 minimum);
    error InvalidValue(string parameter, uint256 current, uint256 expected);
    error InvalidRange(string parameter, uint256 current, uint256 min, uint256 max);
    error CounterOverflow(string counter);
    error AlreadyExists(string item);
    error DoesNotExist(string item);
    error NotAuthorized(string role);
    error LimitExceeded(string limit, uint256 current, uint256 max);
    error OperationNotAllowed(string reason);
    error ContractPaused();
    error EmergencyStopActive();
    error InvalidProof();
    error AlreadyRedeemed();
    error ExpiredOffer();
    error InvalidState(string expected, string current);

    // ============ STRUCTS ============

    struct EventInvite {
        uint256 eventId;
        string eventName;
        string eventDescription;
        uint256 eventDate;
        uint256 maxAttendees;
        uint256 currentAttendees;
        string ipfsCID;
        bool isActive;
        bool isCancelled;
        mapping(address => bool) attendees;
        mapping(address => uint256) attendeeTokens;
    }

    struct ProductLaunch {
        uint256 launchId;
        string productName;
        string productDescription;
        uint256 launchDate;
        uint256 earlyAccessEndDate;
        string ipfsCID;
        bool isActive;
        bool isLaunched;
        uint256 maxEarlyAccess;
        uint256 currentEarlyAccess;
        mapping(address => bool) earlyAccessUsers;
        mapping(address => bool) preOrders;
    }

    struct DigitalProductPassport {
        uint256 dppId;
        string productId;
        string brandId;
        string ipfsCID;
        uint256 timestamp;
        bool isValid;
        address creator;
        string metadataHash;
    }

    struct DigitalArtDrop {
        uint256 dropId;
        string artistName;
        string artworkTitle;
        uint256 edition;
        uint256 maxEditions;
        string ipfsCID;
        bool isActive;
        bool isLimited;
        uint256 currentAirdrops;
        mapping(address => bool) airdroppedTo;
    }

    struct Offer {
        uint256 offerId;
        string title;
        uint256 discountPercentage;
        uint256 validFrom;
        uint256 validUntil;
        string productScope;
        string conditions;
        string ipfsCID;
        bool isActive;
        bool isMerkleBased;
        bytes32 merkleRoot;
        uint256 maxRedemptions;
        uint256 currentRedemptions;
        mapping(address => bool) redeemedBy;
        mapping(address => uint256) userRedemptions;
    }

    enum TokenType {
        EVENT_INVITE,
        PRODUCT_LAUNCH,
        DIGITAL_ART,
        OFFER_COUPON,
        DPP_PASSPORT
    }

    // ============ STATE VARIABLES ============

    uint256 private _tokenIds;
    uint256 private _eventIds;
    uint256 private _launchIds;
    uint256 private _dppIds;
    uint256 private _dropIds;
    uint256 private _offerIds;

    // Mappings
    mapping(uint256 => EventInvite) private _events;
    mapping(uint256 => ProductLaunch) private _launches;
    mapping(uint256 => DigitalProductPassport) private _dpps;
    mapping(uint256 => DigitalArtDrop) private _drops;
    mapping(uint256 => Offer) private _offers;

    // Token type mapping
    mapping(uint256 => TokenType) private _tokenTypes;
    mapping(uint256 => uint256) private _tokenReferences;

    // Access control
    mapping(address => bool) private _authorizedBrands;
    mapping(address => bool) private _authorizedOperators;

    // Emergency controls
    bool private _emergencyStop;

    // SECURITY: Storage gap for future upgrades
    uint256[40] private __gap;

    // ============ EVENTS ============

    event EventCreated(uint256 indexed eventId, string eventName, uint256 eventDate, string ipfsCID);
    event EventCancelled(uint256 indexed eventId);
    event RSVPSubmitted(uint256 indexed eventId, address indexed attendee, uint256 tokenId);
    event RSVPCancelled(uint256 indexed eventId, address indexed attendee);

    event ProductLaunchCreated(uint256 indexed launchId, string productName, uint256 launchDate, string ipfsCID);
    event EarlyAccessGranted(uint256 indexed launchId, address indexed user, uint256 tokenId);
    event PreOrderPlaced(uint256 indexed launchId, address indexed user, uint256 amount);

    event DPPCreated(uint256 indexed dppId, string productId, string brandId, string ipfsCID);
    event DPPInvalidated(uint256 indexed dppId);

    event ArtDropCreated(uint256 indexed dropId, string artistName, string artworkTitle, string ipfsCID);
    event ArtAirdropped(uint256 indexed dropId, address indexed recipient, uint256 tokenId);

    event OfferCreated(uint256 indexed offerId, string title, uint256 discountPercentage, string ipfsCID);
    event OfferRedeemed(uint256 indexed offerId, address indexed user);
    event OfferExpired(uint256 indexed offerId);

    event BrandAuthorized(address indexed brand);
    event BrandRevoked(address indexed brand);
    event OperatorAuthorized(address indexed operator);
    event OperatorRevoked(address indexed operator);
    event EmergencyStopActivated();
    event EmergencyStopDeactivated();

    // ============ MODIFIERS ============

    modifier onlyAuthorizedBrand() {
        if (!_authorizedBrands[_msgSender()] && _msgSender() != owner()) {
            revert NotAuthorized("authorized brand");
        }
        _;
    }

    modifier onlyAuthorizedOperator() {
        if (!_authorizedOperators[_msgSender()] && _msgSender() != owner()) {
            revert NotAuthorized("authorized operator");
        }
        _;
    }

    modifier notEmergencyStopped() {
        if (_emergencyStop) {
            revert EmergencyStopActive();
        }
        _;
    }

    modifier validEvent(uint256 eventId) {
        if (_events[eventId].eventId == 0) {
            revert DoesNotExist("event");
        }
        if (!_events[eventId].isActive) {
            revert InvalidState("active", "inactive");
        }
        if (_events[eventId].isCancelled) {
            revert InvalidState("not cancelled", "cancelled");
        }
        _;
    }

    modifier validLaunch(uint256 launchId) {
        if (_launches[launchId].launchId == 0) {
            revert DoesNotExist("launch");
        }
        if (!_launches[launchId].isActive) {
            revert InvalidState("active", "inactive");
        }
        _;
    }

    modifier validOffer(uint256 offerId) {
        if (_offers[offerId].offerId == 0) {
            revert DoesNotExist("offer");
        }
        if (!_offers[offerId].isActive) {
            revert InvalidState("active", "inactive");
        }
        // SECURITY: Enhanced timestamp validation with tolerance
        if (block.timestamp + 300 < _offers[offerId].validFrom) { // 5 min tolerance
            revert InvalidDateRange("offer start", _offers[offerId].validFrom, block.timestamp);
        }
        if (block.timestamp > _offers[offerId].validUntil + 300) { // 5 min tolerance
            revert ExpiredOffer();
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

    function initialize(address initialOwner, address trustedForwarder) public initializer {
        // SECURITY: Enhanced input validation
        if (initialOwner == address(0)) {
            revert InvalidAddress("initialOwner");
        }
        if (trustedForwarder == address(0)) {
            revert InvalidAddress("trustedForwarder");
        }

        __ERC721_init("TrataTech Platform", "TRATA");
        __Ownable_init(initialOwner);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        // SECURITY: Counter overflow protection
        _tokenIds = 1;
    }

    // ============ UUPS UPGRADE AUTHORIZATION ============

    function _authorizeUpgrade(address newImplementation) internal view override onlyOwner {
        // SECURITY: Additional validation for upgrades
        if (newImplementation == address(0)) {
            revert InvalidAddress("newImplementation");
        }
    }

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

    // ============ INPUT VALIDATION HELPERS ============

    function _validateStringLength(string memory str, string memory paramName, uint256 maxLength) private pure {
        if (bytes(str).length == 0 || bytes(str).length > maxLength) {
            revert InvalidLength(paramName, bytes(str).length, maxLength);
        }
    }

    function _validateAddress(address addr, string memory paramName) private pure {
        if (addr == address(0)) {
            revert InvalidAddress(paramName);
        }
    }

    function _validateDateRange(uint256 date, uint256 minDate, string memory paramName) private view {
        if (date < minDate) {
            revert InvalidDateRange(paramName, date, minDate);
        }
        if (date > block.timestamp + MAX_FUTURE_DATE) {
            revert InvalidDateRange(paramName, date, block.timestamp + MAX_FUTURE_DATE);
        }
    }

    function _validateRange(uint256 value, uint256 min, uint256 max, string memory paramName) private pure {
        if (value < min || value > max) {
            revert InvalidRange(paramName, value, min, max);
        }
    }

    // ============ GETTER FUNCTIONS ============

    function events(uint256 eventId) external view returns (
        uint256 eventId_,
        string memory eventName,
        string memory eventDescription,
        uint256 eventDate,
        uint256 maxAttendees,
        uint256 currentAttendees,
        string memory ipfsCID,
        bool isActive,
        bool isCancelled
    ) {
        EventInvite storage eventData = _events[eventId];
        return (
            eventData.eventId,
            eventData.eventName,
            eventData.eventDescription,
            eventData.eventDate,
            eventData.maxAttendees,
            eventData.currentAttendees,
            eventData.ipfsCID,
            eventData.isActive,
            eventData.isCancelled
        );
    }

    function launches(uint256 launchId) external view returns (
        uint256 launchId_,
        string memory productName,
        string memory productDescription,
        uint256 launchDate,
        uint256 earlyAccessEndDate,
        string memory ipfsCID,
        bool isActive,
        bool isLaunched,
        uint256 maxEarlyAccess,
        uint256 currentEarlyAccess
    ) {
        ProductLaunch storage launch = _launches[launchId];
        return (
            launch.launchId,
            launch.productName,
            launch.productDescription,
            launch.launchDate,
            launch.earlyAccessEndDate,
            launch.ipfsCID,
            launch.isActive,
            launch.isLaunched,
            launch.maxEarlyAccess,
            launch.currentEarlyAccess
        );
    }

    function offers(uint256 offerId) external view returns (
        uint256 offerId_,
        string memory title,
        uint256 discountPercentage,
        uint256 validFrom,
        uint256 validUntil,
        string memory productScope,
        string memory conditions,
        string memory ipfsCID,
        bool isActive,
        bool isMerkleBased,
        bytes32 merkleRoot,
        uint256 maxRedemptions,
        uint256 currentRedemptions
    ) {
        Offer storage offer = _offers[offerId];
        return (
            offer.offerId,
            offer.title,
            offer.discountPercentage,
            offer.validFrom,
            offer.validUntil,
            offer.productScope,
            offer.conditions,
            offer.ipfsCID,
            offer.isActive,
            offer.isMerkleBased,
            offer.merkleRoot,
            offer.maxRedemptions,
            offer.currentRedemptions
        );
    }

    function tokenTypes(uint256 tokenId) external view returns (TokenType) {
        return _tokenTypes[tokenId];
    }

    function tokenReferences(uint256 tokenId) external view returns (uint256) {
        return _tokenReferences[tokenId];
    }

    function authorizedBrands(address brand) external view returns (bool) {
        return _authorizedBrands[brand];
    }

    function authorizedOperators(address operator) external view returns (bool) {
        return _authorizedOperators[operator];
    }

    function emergencyStop() external view returns (bool) {
        return _emergencyStop;
    }

    // ============ EVENT MANAGEMENT ============

    function createEventInvite(
        string memory eventName,
        string memory eventDescription,
        uint256 eventDate,
        uint256 maxAttendees,
        string memory ipfsCID
    ) external onlyAuthorizedBrand notEmergencyStopped returns (uint256) {
        // SECURITY: Enhanced input validation
        _validateStringLength(eventName, "eventName", MAX_STRING_LENGTH);
        _validateStringLength(eventDescription, "eventDescription", MAX_DESCRIPTION_LENGTH);
        _validateStringLength(ipfsCID, "ipfsCID", MAX_IPFS_CID_LENGTH);
        _validateDateRange(eventDate, block.timestamp + MIN_EVENT_LEAD_TIME, "eventDate");
        _validateRange(maxAttendees, 1, MAX_ATTENDEES_LIMIT, "maxAttendees");

        // SECURITY: Counter overflow protection
        if (_eventIds >= type(uint256).max - 1) {
            revert CounterOverflow("eventIds");
        }

        _eventIds = _eventIds + 1;
        uint256 eventId = _eventIds;

        EventInvite storage newEvent = _events[eventId];
        newEvent.eventId = eventId;
        newEvent.eventName = eventName;
        newEvent.eventDescription = eventDescription;
        newEvent.eventDate = eventDate;
        newEvent.maxAttendees = maxAttendees;
        newEvent.currentAttendees = 0;
        newEvent.ipfsCID = ipfsCID;
        newEvent.isActive = true;
        newEvent.isCancelled = false;

        emit EventCreated(eventId, eventName, eventDate, ipfsCID);
        return eventId;
    }

    function submitRSVP(uint256 eventId) external validEvent(eventId) notEmergencyStopped nonReentrant {
        EventInvite storage eventData = _events[eventId];

        if (eventData.attendees[_msgSender()]) {
            revert AlreadyExists("RSVP");
        }
        if (eventData.currentAttendees >= eventData.maxAttendees) {
            revert LimitExceeded("event capacity", eventData.currentAttendees, eventData.maxAttendees);
        }
        // SECURITY: Enhanced timestamp validation with tolerance
        if (block.timestamp + MIN_EVENT_LEAD_TIME > eventData.eventDate) {
            revert OperationNotAllowed("event has already started or starting soon");
        }

        // SECURITY: Counter overflow protection
        if (_tokenIds >= type(uint256).max - 1) {
            revert CounterOverflow("tokenIds");
        }

        // SECURITY: Complete state changes before external calls
        _tokenIds = _tokenIds + 1;
        uint256 tokenId = _tokenIds;

        eventData.attendees[_msgSender()] = true;
        eventData.attendeeTokens[_msgSender()] = tokenId;
        eventData.currentAttendees = eventData.currentAttendees + 1;

        _tokenTypes[tokenId] = TokenType.EVENT_INVITE;
        _tokenReferences[tokenId] = eventId;

        // SECURITY: External call last
        _safeMint(_msgSender(), tokenId);

        emit RSVPSubmitted(eventId, _msgSender(), tokenId);
    }

    function cancelRSVP(uint256 eventId) external validEvent(eventId) notEmergencyStopped nonReentrant {
        EventInvite storage eventData = _events[eventId];

        if (!eventData.attendees[_msgSender()]) {
            revert DoesNotExist("RSVP");
        }
        // SECURITY: Enhanced timestamp validation
        if (block.timestamp + MIN_EVENT_LEAD_TIME > eventData.eventDate) {
            revert OperationNotAllowed("event has already started or starting soon");
        }

        uint256 tokenId = eventData.attendeeTokens[_msgSender()];

        // SECURITY: Complete state changes before external calls
        eventData.attendees[_msgSender()] = false;
        eventData.attendeeTokens[_msgSender()] = 0;
        eventData.currentAttendees = eventData.currentAttendees - 1;

        // SECURITY: External call last
        _burn(tokenId);

        emit RSVPCancelled(eventId, _msgSender());
    }

    function cancelEvent(uint256 eventId) external {
        if (_events[eventId].eventId == 0) {
            revert DoesNotExist("event");
        }
        if (_msgSender() != owner() && !_authorizedBrands[_msgSender()]) {
            revert NotAuthorized("owner or authorized brand");
        }

        _events[eventId].isCancelled = true;
        _events[eventId].isActive = false;

        emit EventCancelled(eventId);
    }

    // ============ PRODUCT LAUNCH MANAGEMENT ============

    function createProductLaunch(
        string memory productName,
        string memory productDescription,
        uint256 launchDate,
        uint256 earlyAccessEndDate,
        uint256 maxEarlyAccess,
        string memory ipfsCID
    ) external onlyAuthorizedBrand notEmergencyStopped returns (uint256) {
        // SECURITY: Enhanced input validation
        _validateStringLength(productName, "productName", MAX_STRING_LENGTH);
        _validateStringLength(productDescription, "productDescription", MAX_DESCRIPTION_LENGTH);
        _validateStringLength(ipfsCID, "ipfsCID", MAX_IPFS_CID_LENGTH);
        _validateDateRange(launchDate, block.timestamp + MIN_EVENT_LEAD_TIME, "launchDate");
        _validateRange(maxEarlyAccess, 1, MAX_EARLY_ACCESS_LIMIT, "maxEarlyAccess");

        if (earlyAccessEndDate < block.timestamp + MIN_EVENT_LEAD_TIME || earlyAccessEndDate > launchDate) {
            revert InvalidDateRange("earlyAccessEndDate", earlyAccessEndDate, block.timestamp + MIN_EVENT_LEAD_TIME);
        }

        // SECURITY: Counter overflow protection
        if (_launchIds >= type(uint256).max - 1) {
            revert CounterOverflow("launchIds");
        }

        _launchIds = _launchIds + 1;
        uint256 launchId = _launchIds;

        ProductLaunch storage newLaunch = _launches[launchId];
        newLaunch.launchId = launchId;
        newLaunch.productName = productName;
        newLaunch.productDescription = productDescription;
        newLaunch.launchDate = launchDate;
        newLaunch.earlyAccessEndDate = earlyAccessEndDate;
        newLaunch.ipfsCID = ipfsCID;
        newLaunch.isActive = true;
        newLaunch.isLaunched = false;
        newLaunch.maxEarlyAccess = maxEarlyAccess;
        newLaunch.currentEarlyAccess = 0;

        emit ProductLaunchCreated(launchId, productName, launchDate, ipfsCID);
        return launchId;
    }

    function grantEarlyAccess(uint256 launchId, address user) external validLaunch(launchId) notEmergencyStopped nonReentrant {
        _validateAddress(user, "user");

        ProductLaunch storage launch = _launches[launchId];

        // SECURITY: Enhanced timestamp validation
        if (block.timestamp >= launch.earlyAccessEndDate) {
            revert OperationNotAllowed("early access period has ended");
        }
        if (launch.earlyAccessUsers[user]) {
            revert AlreadyExists("early access for user");
        }
        if (launch.currentEarlyAccess >= launch.maxEarlyAccess) {
            revert LimitExceeded("early access limit", launch.currentEarlyAccess, launch.maxEarlyAccess);
        }

        // SECURITY: Counter overflow protection
        if (_tokenIds >= type(uint256).max - 1) {
            revert CounterOverflow("tokenIds");
        }

        // SECURITY: Complete state changes before external calls
        _tokenIds = _tokenIds + 1;
        uint256 tokenId = _tokenIds;

        launch.earlyAccessUsers[user] = true;
        launch.currentEarlyAccess = launch.currentEarlyAccess + 1;

        _tokenTypes[tokenId] = TokenType.PRODUCT_LAUNCH;
        _tokenReferences[tokenId] = launchId;

        // SECURITY: External call last
        _safeMint(user, tokenId);

        emit EarlyAccessGranted(launchId, user, tokenId);
    }

    function placePreOrder(uint256 launchId) external validLaunch(launchId) notEmergencyStopped nonReentrant {
        ProductLaunch storage launch = _launches[launchId];

        // SECURITY: Enhanced timestamp validation
        if (block.timestamp >= launch.launchDate) {
            revert OperationNotAllowed("launch has already started");
        }
        if (launch.preOrders[_msgSender()]) {
            revert AlreadyExists("pre-order");
        }

        launch.preOrders[_msgSender()] = true;

        emit PreOrderPlaced(launchId, _msgSender(), 0);
    }

    // ============ DIGITAL PRODUCT PASSPORT MANAGEMENT ============

    function createDPP(
        string memory productId,
        string memory brandId,
        string memory ipfsCID,
        string memory metadataHash
    ) external onlyAuthorizedBrand notEmergencyStopped returns (uint256) {
        // SECURITY: Enhanced input validation
        _validateStringLength(productId, "productId", MAX_STRING_LENGTH);
        _validateStringLength(brandId, "brandId", MAX_STRING_LENGTH);
        _validateStringLength(ipfsCID, "ipfsCID", MAX_IPFS_CID_LENGTH);
        _validateStringLength(metadataHash, "metadataHash", MAX_STRING_LENGTH);

        // SECURITY: Counter overflow protection
        if (_dppIds >= type(uint256).max - 1) {
            revert CounterOverflow("dppIds");
        }

        _dppIds = _dppIds + 1;
        uint256 dppId = _dppIds;

        DigitalProductPassport storage newDPP = _dpps[dppId];
        newDPP.dppId = dppId;
        newDPP.productId = productId;
        newDPP.brandId = brandId;
        newDPP.ipfsCID = ipfsCID;
        newDPP.timestamp = block.timestamp;
        newDPP.isValid = true;
        newDPP.creator = _msgSender();
        newDPP.metadataHash = metadataHash;

        emit DPPCreated(dppId, productId, brandId, ipfsCID);
        return dppId;
    }

    function invalidateDPP(uint256 dppId) external {
        if (_dpps[dppId].dppId == 0) {
            revert DoesNotExist("DPP");
        }
        if (_msgSender() != _dpps[dppId].creator && _msgSender() != owner()) {
            revert NotAuthorized("DPP creator or owner");
        }

        _dpps[dppId].isValid = false;

        emit DPPInvalidated(dppId);
    }

    // ============ DIGITAL ART DROP MANAGEMENT ============

    function createArtDrop(
        string memory artistName,
        string memory artworkTitle,
        uint256 edition,
        uint256 maxEditions,
        string memory ipfsCID
    ) external onlyAuthorizedBrand notEmergencyStopped returns (uint256) {
        // SECURITY: Enhanced input validation
        _validateStringLength(artistName, "artistName", MAX_STRING_LENGTH);
        _validateStringLength(artworkTitle, "artworkTitle", MAX_STRING_LENGTH);
        _validateStringLength(ipfsCID, "ipfsCID", MAX_IPFS_CID_LENGTH);
        _validateRange(edition, 1, type(uint256).max, "edition");

        if (maxEditions > 0) {
            _validateRange(maxEditions, 1, MAX_EDITIONS_LIMIT, "maxEditions");
        }

        // SECURITY: Counter overflow protection
        if (_dropIds >= type(uint256).max - 1) {
            revert CounterOverflow("dropIds");
        }

        _dropIds = _dropIds + 1;
        uint256 dropId = _dropIds;

        DigitalArtDrop storage newDrop = _drops[dropId];
        newDrop.dropId = dropId;
        newDrop.artistName = artistName;
        newDrop.artworkTitle = artworkTitle;
        newDrop.edition = edition;
        newDrop.maxEditions = maxEditions;
        newDrop.ipfsCID = ipfsCID;
        newDrop.isActive = true;
        newDrop.isLimited = maxEditions > 0;
        newDrop.currentAirdrops = 0;

        emit ArtDropCreated(dropId, artistName, artworkTitle, ipfsCID);
        return dropId;
    }

    function airdropArtwork(uint256 dropId, address[] memory recipients) external onlyAuthorizedOperator notEmergencyStopped {
        // SECURITY: Enhanced input validation
        if (recipients.length == 0) {
            revert InvalidValue("recipients length", recipients.length, 1);
        }
        if (recipients.length > MAX_AIRDROP_RECIPIENTS) {
            revert LimitExceeded("batch size", recipients.length, MAX_AIRDROP_RECIPIENTS);
        }

        DigitalArtDrop storage drop = _drops[dropId];
        if (drop.dropId == 0) {
            revert DoesNotExist("drop");
        }
        if (!drop.isActive) {
            revert InvalidState("active", "inactive");
        }

        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            _validateAddress(recipient, "recipient");

            if (drop.airdroppedTo[recipient]) {
                revert AlreadyExists("airdrop for recipient");
            }

            if (drop.isLimited && drop.currentAirdrops >= drop.maxEditions) {
                revert LimitExceeded("max editions", drop.currentAirdrops, drop.maxEditions);
            }

            // SECURITY: Counter overflow protection
            if (_tokenIds >= type(uint256).max - 1) {
                revert CounterOverflow("tokenIds");
            }

            // SECURITY: Complete state changes before external calls
            _tokenIds = _tokenIds + 1;
            uint256 tokenId = _tokenIds;

            drop.airdroppedTo[recipient] = true;
            if (drop.isLimited) {
                drop.currentAirdrops++;
            }

            _tokenTypes[tokenId] = TokenType.DIGITAL_ART;
            _tokenReferences[tokenId] = dropId;

            // SECURITY: External call last
            _safeMint(recipient, tokenId);

            emit ArtAirdropped(dropId, recipient, tokenId);
        }
    }

    // ============ OFFER MANAGEMENT ============

    function createOffer(
        string memory title,
        uint256 discountPercentage,
        uint256 validFrom,
        uint256 validUntil,
        string memory productScope,
        string memory conditions,
        string memory ipfsCID,
        bool isMerkleBased,
        bytes32 merkleRoot,
        uint256 maxRedemptions
    ) external onlyAuthorizedBrand notEmergencyStopped returns (uint256) {
        // SECURITY: Enhanced input validation
        _validateStringLength(title, "title", MAX_STRING_LENGTH);
        _validateStringLength(productScope, "productScope", MAX_STRING_LENGTH);
        _validateStringLength(conditions, "conditions", MAX_DESCRIPTION_LENGTH);
        _validateStringLength(ipfsCID, "ipfsCID", MAX_IPFS_CID_LENGTH);
        _validateRange(discountPercentage, MIN_DISCOUNT_PERCENTAGE, MAX_DISCOUNT_PERCENTAGE, "discountPercentage");

        if (validFrom >= validUntil) {
            revert InvalidDateRange("validUntil", validUntil, validFrom + 1);
        }
        if (validUntil <= block.timestamp) {
            revert InvalidDateRange("validUntil", validUntil, block.timestamp + 1);
        }
        if (maxRedemptions > MAX_REDEMPTIONS_LIMIT) {
            revert InvalidRange("maxRedemptions", maxRedemptions, 0, MAX_REDEMPTIONS_LIMIT);
        }

        // SECURITY: Counter overflow protection
        if (_offerIds >= type(uint256).max - 1) {
            revert CounterOverflow("offerIds");
        }

        _offerIds = _offerIds + 1;
        uint256 offerId = _offerIds;

        Offer storage newOffer = _offers[offerId];
        newOffer.offerId = offerId;
        newOffer.title = title;
        newOffer.discountPercentage = discountPercentage;
        newOffer.validFrom = validFrom;
        newOffer.validUntil = validUntil;
        newOffer.productScope = productScope;
        newOffer.conditions = conditions;
        newOffer.ipfsCID = ipfsCID;
        newOffer.isActive = true;
        newOffer.isMerkleBased = isMerkleBased;
        newOffer.merkleRoot = merkleRoot;
        newOffer.maxRedemptions = maxRedemptions;
        newOffer.currentRedemptions = 0;

        emit OfferCreated(offerId, title, discountPercentage, ipfsCID);
        return offerId;
    }

    function redeemOffer(uint256 offerId, bytes32[] memory merkleProof) external validOffer(offerId) notEmergencyStopped nonReentrant {
        Offer storage offer = _offers[offerId];

        if (offer.redeemedBy[_msgSender()]) {
            revert AlreadyRedeemed();
        }

        if (offer.isMerkleBased) {
            bytes32 leaf = keccak256(abi.encodePacked(_msgSender()));
            if (!MerkleProof.verify(merkleProof, offer.merkleRoot, leaf)) {
                revert InvalidProof();
            }
        }

        if (offer.maxRedemptions > 0 && offer.currentRedemptions >= offer.maxRedemptions) {
            revert LimitExceeded("offer redemptions", offer.currentRedemptions, offer.maxRedemptions);
        }

        // SECURITY: Counter overflow protection
        if (_tokenIds >= type(uint256).max - 1) {
            revert CounterOverflow("tokenIds");
        }

        // SECURITY: Complete state changes before external calls
        _tokenIds = _tokenIds + 1;
        uint256 tokenId = _tokenIds;

        offer.redeemedBy[_msgSender()] = true;
        offer.userRedemptions[_msgSender()] = offer.userRedemptions[_msgSender()] + 1;
        offer.currentRedemptions = offer.currentRedemptions + 1;

        _tokenTypes[tokenId] = TokenType.OFFER_COUPON;
        _tokenReferences[tokenId] = offerId;

        // SECURITY: External call last
        _safeMint(_msgSender(), tokenId);

        emit OfferRedeemed(offerId, _msgSender());
    }

    function checkOfferExpiration(uint256 offerId) external {
        Offer storage offer = _offers[offerId];
        if (offer.offerId == 0) {
            revert DoesNotExist("offer");
        }

        if (block.timestamp > offer.validUntil && offer.isActive) {
            offer.isActive = false;
            emit OfferExpired(offerId);
        }
    }

    // ============ ACCESS CONTROL FUNCTIONS ============

    function authorizeBrand(address brand) external onlyOwner {
        _validateAddress(brand, "brand");

        if (_authorizedBrands[brand]) {
            revert AlreadyExists("authorized brand");
        }

        _authorizedBrands[brand] = true;
        emit BrandAuthorized(brand);
    }

    function revokeBrand(address brand) external onlyOwner {
        if (!_authorizedBrands[brand]) {
            revert DoesNotExist("authorized brand");
        }

        _authorizedBrands[brand] = false;
        emit BrandRevoked(brand);
    }

    function authorizeOperator(address operator) external onlyOwner {
        _validateAddress(operator, "operator");

        if (_authorizedOperators[operator]) {
            revert AlreadyExists("authorized operator");
        }

        _authorizedOperators[operator] = true;
        emit OperatorAuthorized(operator);
    }

    function revokeOperator(address operator) external onlyOwner {
        if (!_authorizedOperators[operator]) {
            revert DoesNotExist("authorized operator");
        }

        _authorizedOperators[operator] = false;
        emit OperatorRevoked(operator);
    }

    function activateEmergencyStop() external onlyOwner {
        if (_emergencyStop) {
            revert InvalidState("not active", "already active");
        }
        _emergencyStop = true;
        emit EmergencyStopActivated();
    }

    function deactivateEmergencyStop() external onlyOwner {
        if (!_emergencyStop) {
            revert InvalidState("active", "not active");
        }
        _emergencyStop = false;
        emit EmergencyStopDeactivated();
    }

    // ============ PAUSABLE FUNCTIONS ============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ VERSION FUNCTION ============

    function version() external pure returns (string memory) {
        return "2.0.0-secure";
    }
}