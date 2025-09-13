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
 * @title TrataTechMainUpgradeable
 * @dev Upgradeable and gasless version of TrataTech platform handling:
 * - Event Invites & RSVP
 * - Product Launches & Early Access
 * - Digital Product Passports
 * - Digital Art Drops
 * - Offers & Coupons
 * @author Advanced Developer
 */
contract TrataTechMainUpgradeable is 
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
        uint256 currentAirdrops; // Track count to avoid loop
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
    
    // Reserved for future use
    uint256[50] private __gap;
    
    // Emergency controls
    bool private _emergencyStop;
    
    // ============ ENUMS ============
    
    enum TokenType {
        EVENT_INVITE,
        PRODUCT_LAUNCH,
        DIGITAL_ART,
        OFFER_COUPON,
        DPP_PASSPORT
    }

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

    // Batch operation limits
    uint256 public constant MAX_AIRDROP_RECIPIENTS = 50;
    
    // Duplicate gap removed

    // ============ MODIFIERS ============
    
    modifier onlyAuthorizedBrand() {
        require(_authorizedBrands[_msgSender()] || _msgSender() == owner(), "Not authorized brand");
        _;
    }
    
    modifier onlyAuthorizedOperator() {
        require(_authorizedOperators[_msgSender()] || _msgSender() == owner(), "Not authorized operator");
        _;
    }
    
    modifier notEmergencyStopped() {
        require(!_emergencyStop, "Contract is emergency stopped");
        _;
    }
    
    modifier validEvent(uint256 eventId) {
        require(_events[eventId].eventId != 0, "Event does not exist");
        require(_events[eventId].isActive, "Event is not active");
        require(!_events[eventId].isCancelled, "Event is cancelled");
        _;
    }
    
    modifier validLaunch(uint256 launchId) {
        require(_launches[launchId].launchId != 0, "Launch does not exist");
        require(_launches[launchId].isActive, "Launch is not active");
        _;
    }
    
    modifier validOffer(uint256 offerId) {
        require(_offers[offerId].offerId != 0, "Offer does not exist");
        require(_offers[offerId].isActive, "Offer is not active");
        require(block.timestamp >= _offers[offerId].validFrom, "Offer not yet valid");
        require(block.timestamp <= _offers[offerId].validUntil, "Offer expired");
        _;
    }

    // ============ INITIALIZATION ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) {
        require(trustedForwarder != address(0), "TrataTech: Invalid trusted forwarder");
        _disableInitializers();
    }

    function initialize(address initialOwner, address trustedForwarder) public initializer {
        __ERC721_init("TrataTech Platform", "TRATA");
        __Ownable_init(initialOwner);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        // ERC2771Context initialization removed - constructor handles this
        
        _tokenIds = 1; // Start from 1
        // Platform fee removed - no blockchain payments
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
    
    // Platform fee function removed - no blockchain payments
    
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
        require(bytes(eventName).length > 0, "Event name cannot be empty");
        require(eventDate > block.timestamp, "Event date must be in the future");
        require(maxAttendees > 0, "Max attendees must be greater than 0");
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        
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
        
        require(!eventData.attendees[_msgSender()], "Already RSVP'd");
        require(eventData.currentAttendees < eventData.maxAttendees, "Event is full");
        require(block.timestamp < eventData.eventDate, "Event has already started");
        
        // Mint NFT ticket
        _tokenIds = _tokenIds + 1;
        uint256 tokenId = _tokenIds;
        
        _safeMint(_msgSender(), tokenId);
        
        // Update event data
        eventData.attendees[_msgSender()] = true;
        eventData.attendeeTokens[_msgSender()] = tokenId;
        eventData.currentAttendees = eventData.currentAttendees + 1;
        
        // Set token type and reference
        _tokenTypes[tokenId] = TokenType.EVENT_INVITE;
        _tokenReferences[tokenId] = eventId;
        
        emit RSVPSubmitted(eventId, _msgSender(), tokenId);
    }
    
    function cancelRSVP(uint256 eventId) external validEvent(eventId) notEmergencyStopped nonReentrant {
        EventInvite storage eventData = _events[eventId];
        
        require(eventData.attendees[_msgSender()], "Not RSVP'd for this event");
        require(block.timestamp < eventData.eventDate, "Event has already started");
        
        uint256 tokenId = eventData.attendeeTokens[_msgSender()];
        
        // Burn NFT ticket
        _burn(tokenId);
        
        // Update event data
        eventData.attendees[_msgSender()] = false;
        eventData.attendeeTokens[_msgSender()] = 0;
        eventData.currentAttendees = eventData.currentAttendees - 1;
        
        emit RSVPCancelled(eventId, _msgSender());
    }
    
    function cancelEvent(uint256 eventId) external {
        require(_events[eventId].eventId != 0, "Event does not exist");
        require(_msgSender() == owner() || _authorizedBrands[_msgSender()], "Not authorized");
        
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
        require(bytes(productName).length > 0, "Product name cannot be empty");
        require(launchDate > block.timestamp, "Launch date must be in the future");
        require(earlyAccessEndDate > block.timestamp && earlyAccessEndDate <= launchDate, "Invalid early access end date");
        require(maxEarlyAccess > 0, "Max early access must be greater than 0");
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        
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
        require(user != address(0), "Invalid user address");
        
        ProductLaunch storage launch = _launches[launchId];
        
        require(block.timestamp < launch.earlyAccessEndDate, "Early access period ended");
        require(!launch.earlyAccessUsers[user], "User already has early access");
        require(launch.currentEarlyAccess < launch.maxEarlyAccess, "Early access limit reached");
        
        // Mint early access token
        _tokenIds = _tokenIds + 1;
        uint256 tokenId = _tokenIds;
        
        _safeMint(user, tokenId);
        
        // Update launch data
        launch.earlyAccessUsers[user] = true;
        launch.currentEarlyAccess = launch.currentEarlyAccess + 1;
        
        // Set token type and reference
        _tokenTypes[tokenId] = TokenType.PRODUCT_LAUNCH;
        _tokenReferences[tokenId] = launchId;
        
        emit EarlyAccessGranted(launchId, user, tokenId);
    }
    
    function placePreOrder(uint256 launchId) external validLaunch(launchId) notEmergencyStopped nonReentrant {
        ProductLaunch storage launch = _launches[launchId];
        
        require(block.timestamp < launch.launchDate, "Launch has already started");
        require(!launch.preOrders[_msgSender()], "Already placed pre-order");
        
        // Update pre-order data
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
        require(bytes(productId).length > 0, "Product ID cannot be empty");
        require(bytes(brandId).length > 0, "Brand ID cannot be empty");
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        require(bytes(metadataHash).length > 0, "Metadata hash cannot be empty");
        
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
        require(_dpps[dppId].dppId != 0, "DPP does not exist");
        require(_msgSender() == _dpps[dppId].creator || _msgSender() == owner(), "Not authorized");
        
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
        require(bytes(artistName).length > 0, "Artist name cannot be empty");
        require(bytes(artworkTitle).length > 0, "Artwork title cannot be empty");
        require(edition > 0, "Edition must be greater than 0");
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        
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
        require(recipients.length <= MAX_AIRDROP_RECIPIENTS, "Too many recipients");
        require(recipients.length > 0, "No recipients provided");
        
        DigitalArtDrop storage drop = _drops[dropId];
        require(drop.dropId != 0, "Drop does not exist");
        require(drop.isActive, "Drop is not active");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            require(recipient != address(0), "Invalid recipient address");
            require(!drop.airdroppedTo[recipient], "Already airdropped to this address");
            
            if (drop.isLimited) {
                // Use counter instead of loop to prevent DoS
                require(drop.currentAirdrops < drop.maxEditions, "Max editions reached");
            }
            
            // Mint NFT
            _tokenIds = _tokenIds + 1;
            uint256 tokenId = _tokenIds;
            
            _safeMint(recipient, tokenId);
            
            // Update drop data
            drop.airdroppedTo[recipient] = true;
            if (drop.isLimited) {
                drop.currentAirdrops++;
            }
            
            // Set token type and reference
            _tokenTypes[tokenId] = TokenType.DIGITAL_ART;
            _tokenReferences[tokenId] = dropId;
            
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
        require(bytes(title).length > 0, "Title cannot be empty");
        require(discountPercentage > 0 && discountPercentage <= 10000, "Invalid discount percentage");
        require(validFrom < validUntil, "Invalid validity period");
        require(validUntil > block.timestamp, "Offer expires in the past");
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        
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
        
        require(!offer.redeemedBy[_msgSender()], "Offer already redeemed");
        
        if (offer.isMerkleBased) {
            bytes32 leaf = keccak256(abi.encodePacked(_msgSender()));
            require(MerkleProof.verify(merkleProof, offer.merkleRoot, leaf), "Not eligible for this offer");
        }
        
        if (offer.maxRedemptions > 0) {
            require(offer.currentRedemptions < offer.maxRedemptions, "Offer redemption limit reached");
        }
        
        // Mint offer NFT
        _tokenIds = _tokenIds + 1;
        uint256 tokenId = _tokenIds;
        
        _safeMint(_msgSender(), tokenId);
        
        // Update offer data
        offer.redeemedBy[_msgSender()] = true;
        offer.userRedemptions[_msgSender()] = offer.userRedemptions[_msgSender()] + 1;
        offer.currentRedemptions = offer.currentRedemptions + 1;
        
        // Set token type and reference
        _tokenTypes[tokenId] = TokenType.OFFER_COUPON;
        _tokenReferences[tokenId] = offerId;
        
        emit OfferRedeemed(offerId, _msgSender());
    }
    
    function checkOfferExpiration(uint256 offerId) external {
        Offer storage offer = _offers[offerId];
        require(offer.offerId != 0, "Offer does not exist");
        
        if (block.timestamp > offer.validUntil && offer.isActive) {
            offer.isActive = false;
            emit OfferExpired(offerId);
        }
    }

    // ============ ACCESS CONTROL FUNCTIONS ============
    
    function authorizeBrand(address brand) external onlyOwner {
        require(brand != address(0), "Invalid brand address");
        require(!_authorizedBrands[brand], "Brand already authorized");
        
        _authorizedBrands[brand] = true;
        emit BrandAuthorized(brand);
    }
    
    function revokeBrand(address brand) external onlyOwner {
        require(_authorizedBrands[brand], "Brand not authorized");
        
        _authorizedBrands[brand] = false;
        emit BrandRevoked(brand);
    }
    
    function authorizeOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid operator address");
        require(!_authorizedOperators[operator], "Operator already authorized");
        
        _authorizedOperators[operator] = true;
        emit OperatorAuthorized(operator);
    }
    
    function revokeOperator(address operator) external onlyOwner {
        require(_authorizedOperators[operator], "Operator not authorized");
        
        _authorizedOperators[operator] = false;
        emit OperatorRevoked(operator);
    }
    
    function updatePlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee cannot exceed 10%");
        // Platform fee setting removed - no fee functionality
    }
    
    function activateEmergencyStop() external onlyOwner {
        require(!_emergencyStop, "Emergency stop already active");
        _emergencyStop = true;
        emit EmergencyStopActivated();
    }
    
    function deactivateEmergencyStop() external onlyOwner {
        require(_emergencyStop, "Emergency stop not active");
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
    
    // ============ EMERGENCY FUNCTIONS ============
    
    // Emergency recovery and receive functions removed - no blockchain payments
    
    // ============ VERSION FUNCTION ============
    
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}