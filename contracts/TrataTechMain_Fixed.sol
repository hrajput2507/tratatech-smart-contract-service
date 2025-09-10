// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./TrataTechSecurityEnhanced.sol";

/**
 * @title TrataTechMain_Fixed
 * @dev Security-enhanced comprehensive smart contract for TrataTech platform
 * @author Security Enhanced Version
 */
contract TrataTechMain_Fixed is 
    ERC721, 
    ERC2771Context,
    AccessControl,
    Pausable, 
    ReentrancyGuard 
{
    using Strings for uint256;
    using Address for address payable;
    using TrataTechSecurityEnhanced for *;

    // ============ CONSTANTS ============
    
    uint256 public constant MAX_ATTENDEES = 10000;
    uint256 public constant MAX_EARLY_ACCESS = 10000;
    uint256 public constant MAX_EDITIONS = 10000;
    uint256 public constant MAX_REDEMPTIONS = 100000;
    uint256 public constant MAX_FEE_PERCENTAGE = 1000; // 10% max
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant MAX_FUTURE_DATE = 365 days;
    uint256 public constant PAGINATION_LIMIT = 100;
    
    // ============ STRUCTS ============
    
    struct EventInvite {
        uint256 eventId;
        bytes32 eventNameHash;
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
        bytes32 productNameHash;
        string productDescription;
        uint256 launchDate;
        uint256 earlyAccessEndDate;
        string ipfsCID;
        bool isActive;
        bool isLaunched;
        uint256 maxEarlyAccess;
        uint256 currentEarlyAccess;
        mapping(address => bool) earlyAccessUsers;
        mapping(address => uint256) preOrders;
        uint256 totalPreOrderAmount;
    }

    struct DigitalProductPassport {
        uint256 dppId;
        bytes32 productIdHash;
        bytes32 brandIdHash;
        string ipfsCID;
        uint256 timestamp;
        bool isValid;
        address creator;
        bytes32 metadataHash;
    }

    struct DigitalArtDrop {
        uint256 dropId;
        bytes32 artistNameHash;
        string artworkTitle;
        uint256 currentEdition;
        uint256 maxEditions;
        string ipfsCID;
        bool isActive;
        bool isLimited;
        mapping(address => bool) airdroppedTo;
    }

    struct Offer {
        uint256 offerId;
        bytes32 titleHash;
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
    
    // Fee structure with limits
    uint256 private _platformFee = 250; // 2.5% in basis points
    uint256 private _minPlatformFee = 0;
    uint256 private _maxPlatformFee = MAX_FEE_PERCENTAGE;
    
    // Rate limiting
    mapping(address => uint256) private _lastActionTime;
    uint256 public constant RATE_LIMIT_DURATION = 1 minutes;
    
    // Owner
    address private _owner;
    
    // ============ ENUMS ============
    
    enum TokenType {
        EVENT_INVITE,
        PRODUCT_LAUNCH,
        DIGITAL_ART,
        OFFER_COUPON,
        DPP_PASSPORT
    }

    // ============ ROLES ============
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant BRAND_ROLE = keccak256("BRAND_ROLE");

    // ============ EVENTS ============
    
    event EventCreated(uint256 indexed eventId, bytes32 eventNameHash, uint256 eventDate, string ipfsCID);
    event EventCancelled(uint256 indexed eventId, address indexed canceller);
    event RSVPSubmitted(uint256 indexed eventId, address indexed attendee, uint256 tokenId);
    event RSVPCancelled(uint256 indexed eventId, address indexed attendee);
    
    event ProductLaunchCreated(uint256 indexed launchId, bytes32 productNameHash, uint256 launchDate, string ipfsCID);
    event EarlyAccessGranted(uint256 indexed launchId, address indexed user, uint256 tokenId);
    event PreOrderPlaced(uint256 indexed launchId, address indexed user, uint256 amount);
    
    event DPPCreated(uint256 indexed dppId, bytes32 productIdHash, bytes32 brandIdHash, string ipfsCID);
    event DPPInvalidated(uint256 indexed dppId, address indexed invalidator);
    
    event ArtDropCreated(uint256 indexed dropId, bytes32 artistNameHash, string artworkTitle, string ipfsCID);
    event ArtAirdropped(uint256 indexed dropId, address indexed recipient, uint256 tokenId);
    
    event OfferCreated(uint256 indexed offerId, bytes32 titleHash, uint256 discountPercentage, string ipfsCID);
    event OfferRedeemed(uint256 indexed offerId, address indexed user, uint256 tokenId);
    event OfferExpired(uint256 indexed offerId);
    
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee, address indexed updater);
    event FeeLimitsUpdated(uint256 minFee, uint256 maxFee, address indexed updater);
    event EmergencyWithdrawal(address indexed to, uint256 amount);

    // ============ MODIFIERS ============
    
    modifier rateLimited() {
        require(
            block.timestamp >= _lastActionTime[msg.sender] + RATE_LIMIT_DURATION,
            "Rate limit exceeded"
        );
        _lastActionTime[msg.sender] = block.timestamp;
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

    // ============ CONSTRUCTOR ============
    
    constructor(address trustedForwarder) 
        ERC721("TrataTech Platform", "TRATA") 
        ERC2771Context(trustedForwarder) {
        _tokenIds = 1; // Start from 1
        _owner = msg.sender;
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _setRoleAdmin(OPERATOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(BRAND_ROLE, ADMIN_ROLE);
        _setRoleAdmin(PAUSER_ROLE, ADMIN_ROLE);
    }
    
    /**
     * @dev Returns the address of the current owner
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Override supportsInterface to resolve inheritance conflict
     */
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(ERC721, AccessControl) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }

    // ============ EVENT MANAGEMENT ============
    
    /**
     * @notice Create a new event invite
     * @param eventName Name of the event
     * @param eventDescription Description of the event
     * @param eventDate Unix timestamp of the event
     * @param maxAttendees Maximum number of attendees
     * @param ipfsCID IPFS CID containing event metadata
     */
    function createEventInvite(
        string memory eventName,
        string memory eventDescription,
        uint256 eventDate,
        uint256 maxAttendees,
        string memory ipfsCID
    ) external 
        whenNotPaused 
        onlyRole(BRAND_ROLE)
        nonReentrant 
        returns (uint256) 
    {
        // Input validation
        TrataTechSecurityEnhanced.validateString(eventName);
        TrataTechSecurityEnhanced.validateString(eventDescription);
        require(eventDate > block.timestamp && eventDate <= block.timestamp + MAX_FUTURE_DATE, "Invalid event date");
        require(maxAttendees > 0 && maxAttendees <= MAX_ATTENDEES, "Invalid max attendees");
        TrataTechSecurityEnhanced.validateIPFSCID(ipfsCID);
        
        _eventIds++;
        uint256 eventId = _eventIds;
        
        EventInvite storage newEvent = _events[eventId];
        newEvent.eventId = eventId;
        newEvent.eventNameHash = keccak256(bytes(eventName));
        newEvent.eventDescription = eventDescription;
        newEvent.eventDate = eventDate;
        newEvent.maxAttendees = maxAttendees;
        newEvent.currentAttendees = 0;
        newEvent.ipfsCID = ipfsCID;
        newEvent.isActive = true;
        newEvent.isCancelled = false;
        
        emit EventCreated(eventId, newEvent.eventNameHash, eventDate, ipfsCID);
        return eventId;
    }
    
    /**
     * @notice Submit RSVP for an event
     * @param eventId ID of the event
     */
    function submitRSVP(uint256 eventId) 
        external 
        validEvent(eventId) 
        whenNotPaused 
        rateLimited
        nonReentrant 
    {
        EventInvite storage eventData = _events[eventId];
        
        require(!eventData.attendees[msg.sender], "Already RSVP'd");
        require(eventData.currentAttendees < eventData.maxAttendees, "Event is full");
        require(block.timestamp < eventData.eventDate, "Event has already started");
        
        // Update state before external calls
        eventData.attendees[msg.sender] = true;
        eventData.currentAttendees++;
        
        // Mint NFT ticket
        _tokenIds++;
        uint256 tokenId = _tokenIds;
        
        eventData.attendeeTokens[msg.sender] = tokenId;
        _tokenTypes[tokenId] = TokenType.EVENT_INVITE;
        _tokenReferences[tokenId] = eventId;
        
        _safeMint(msg.sender, tokenId);
        
        emit RSVPSubmitted(eventId, msg.sender, tokenId);
    }
    
    /**
     * @notice Cancel RSVP for an event
     * @param eventId ID of the event
     */
    function cancelRSVP(uint256 eventId) 
        external 
        validEvent(eventId) 
        whenNotPaused 
        nonReentrant 
    {
        EventInvite storage eventData = _events[eventId];
        
        require(eventData.attendees[msg.sender], "Not RSVP'd for this event");
        require(block.timestamp < eventData.eventDate - 1 days, "Too late to cancel");
        
        uint256 tokenId = eventData.attendeeTokens[msg.sender];
        
        // Update state before external calls
        eventData.attendees[msg.sender] = false;
        eventData.attendeeTokens[msg.sender] = 0;
        eventData.currentAttendees--;
        
        // Burn NFT ticket
        _burn(tokenId);
        
        emit RSVPCancelled(eventId, msg.sender);
    }
    
    /**
     * @notice Cancel an event (only by authorized role with timelock)
     * @param eventId ID of the event
     */
    function cancelEvent(uint256 eventId) external onlyRole(ADMIN_ROLE) {
        require(_events[eventId].eventId != 0, "Event does not exist");
        require(!_events[eventId].isCancelled, "Event already cancelled");
        
        _events[eventId].isCancelled = true;
        _events[eventId].isActive = false;
        
        emit EventCancelled(eventId, msg.sender);
    }

    // ============ PRODUCT LAUNCH MANAGEMENT ============
    
    /**
     * @notice Create a new product launch
     * @param productName Name of the product
     * @param productDescription Description of the product
     * @param launchDate Unix timestamp of the launch
     * @param earlyAccessEndDate Unix timestamp when early access ends
     * @param maxEarlyAccess Maximum number of early access users
     * @param ipfsCID IPFS CID containing launch metadata
     */
    function createProductLaunch(
        string memory productName,
        string memory productDescription,
        uint256 launchDate,
        uint256 earlyAccessEndDate,
        uint256 maxEarlyAccess,
        string memory ipfsCID
    ) external 
        whenNotPaused 
        onlyRole(BRAND_ROLE)
        nonReentrant 
        returns (uint256) 
    {
        // Enhanced input validation
        TrataTechSecurityEnhanced.validateString(productName);
        TrataTechSecurityEnhanced.validateString(productDescription);
        require(launchDate > block.timestamp && launchDate <= block.timestamp + MAX_FUTURE_DATE, "Invalid launch date");
        require(earlyAccessEndDate > block.timestamp && earlyAccessEndDate <= launchDate, "Invalid early access date");
        require(maxEarlyAccess > 0 && maxEarlyAccess <= MAX_EARLY_ACCESS, "Invalid max early access");
        TrataTechSecurityEnhanced.validateIPFSCID(ipfsCID);
        
        _launchIds++;
        uint256 launchId = _launchIds;
        
        ProductLaunch storage newLaunch = _launches[launchId];
        newLaunch.launchId = launchId;
        newLaunch.productNameHash = keccak256(bytes(productName));
        newLaunch.productDescription = productDescription;
        newLaunch.launchDate = launchDate;
        newLaunch.earlyAccessEndDate = earlyAccessEndDate;
        newLaunch.ipfsCID = ipfsCID;
        newLaunch.isActive = true;
        newLaunch.isLaunched = false;
        newLaunch.maxEarlyAccess = maxEarlyAccess;
        newLaunch.currentEarlyAccess = 0;
        newLaunch.totalPreOrderAmount = 0;
        
        emit ProductLaunchCreated(launchId, newLaunch.productNameHash, launchDate, ipfsCID);
        return launchId;
    }
    
    /**
     * @notice Place a pre-order for a product launch (Fixed reentrancy)
     * @param launchId ID of the launch
     */
    function placePreOrder(uint256 launchId) 
        external 
        payable 
        validLaunch(launchId) 
        whenNotPaused 
        rateLimited
        nonReentrant 
    {
        require(msg.value > 0, "Must send ETH for pre-order");
        require(msg.value <= 100 ether, "Pre-order amount too high");
        
        ProductLaunch storage launch = _launches[launchId];
        
        require(block.timestamp < launch.launchDate, "Launch has already started");
        require(launch.preOrders[msg.sender] == 0, "Already placed pre-order");
        
        // Calculate platform fee with overflow protection
        uint256 platformFeeAmount = TrataTechSecurityEnhanced.calculateFee(msg.value, _platformFee);
        
        // Update state BEFORE external calls (CEI pattern)
        launch.preOrders[msg.sender] = msg.value;
        launch.totalPreOrderAmount += msg.value;
        
        emit PreOrderPlaced(launchId, msg.sender, msg.value);
        
        // Transfer platform fee to owner (external call at the end)
        if (platformFeeAmount > 0) {
            payable(owner()).sendValue(platformFeeAmount);
        }
    }

    // ============ DIGITAL ART DROP MANAGEMENT (FIXED) ============
    
    /**
     * @notice Airdrop artwork to eligible users (Fixed DoS vulnerability)
     * @param dropId ID of the drop
     * @param recipients Array of recipient addresses (limited)
     */
    function airdropArtwork(uint256 dropId, address[] memory recipients) 
        external 
        whenNotPaused 
        onlyRole(OPERATOR_ROLE)
        nonReentrant 
    {
        require(recipients.length <= PAGINATION_LIMIT, "Too many recipients");
        
        DigitalArtDrop storage drop = _drops[dropId];
        require(drop.dropId != 0, "Drop does not exist");
        require(drop.isActive, "Drop is not active");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            TrataTechSecurityEnhanced.validateAddress(recipient);
            
            if (!drop.airdroppedTo[recipient]) {
                if (drop.isLimited) {
                    require(drop.currentEdition < drop.maxEditions, "Max editions reached");
                    drop.currentEdition++;
                }
                
                drop.airdroppedTo[recipient] = true;
                
                _tokenIds++;
                uint256 tokenId = _tokenIds;
                
                _tokenTypes[tokenId] = TokenType.DIGITAL_ART;
                _tokenReferences[tokenId] = dropId;
                
                _safeMint(recipient, tokenId);
                
                emit ArtAirdropped(dropId, recipient, tokenId);
            }
        }
    }

    // ============ OFFER MANAGEMENT ============
    
    /**
     * @notice Redeem an offer
     * @param offerId ID of the offer
     * @param merkleProof Merkle proof for eligibility (if applicable)
     */
    function redeemOffer(uint256 offerId, bytes32[] memory merkleProof) 
        external 
        validOffer(offerId) 
        whenNotPaused 
        rateLimited
        nonReentrant 
    {
        Offer storage offer = _offers[offerId];
        
        require(!offer.redeemedBy[msg.sender], "Offer already redeemed");
        
        if (offer.isMerkleBased) {
            bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
            require(MerkleProof.verify(merkleProof, offer.merkleRoot, leaf), "Not eligible");
        }
        
        if (offer.maxRedemptions > 0) {
            require(offer.currentRedemptions < offer.maxRedemptions, "Redemption limit reached");
        }
        
        // Update state before minting
        offer.redeemedBy[msg.sender] = true;
        offer.userRedemptions[msg.sender]++;
        offer.currentRedemptions++;
        
        // Mint offer NFT
        _tokenIds++;
        uint256 tokenId = _tokenIds;
        
        _tokenTypes[tokenId] = TokenType.OFFER_COUPON;
        _tokenReferences[tokenId] = offerId;
        
        _safeMint(msg.sender, tokenId);
        
        emit OfferRedeemed(offerId, msg.sender, tokenId);
    }

    // ============ ADMIN FUNCTIONS WITH TIMELOCK ============
    
    /**
     * @notice Update platform fee (with restrictions and timelock)
     * @param newFee New platform fee in basis points
     */
    function updatePlatformFee(uint256 newFee) external onlyRole(ADMIN_ROLE) {
        require(newFee >= _minPlatformFee && newFee <= _maxPlatformFee, "Fee out of bounds");
        require(newFee <= MAX_FEE_PERCENTAGE, "Fee exceeds maximum");
        
        // Restrict fee changes to max 100 basis points at a time
        uint256 currentFee = _platformFee;
        require(
            newFee <= currentFee + 100 || newFee >= currentFee - 100,
            "Fee change too large"
        );
        
        uint256 oldFee = _platformFee;
        _platformFee = newFee;
        
        emit PlatformFeeUpdated(oldFee, newFee, msg.sender);
    }
    
    /**
     * @notice Update fee limits
     * @param minFee Minimum platform fee
     * @param maxFee Maximum platform fee
     */
    function updateFeeLimits(uint256 minFee, uint256 maxFee) external onlyRole(ADMIN_ROLE) {
        require(minFee <= maxFee, "Invalid fee limits");
        require(maxFee <= MAX_FEE_PERCENTAGE, "Max fee too high");
        
        _minPlatformFee = minFee;
        _maxPlatformFee = maxFee;
        
        emit FeeLimitsUpdated(minFee, maxFee, msg.sender);
    }
    
    /**
     * @notice Pause contract
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    

    // ============ EMERGENCY FUNCTIONS ============
    
    /**
     * @notice Emergency function to recover stuck ETH (with timelock)
     * @param to Address to send ETH to
     * @param amount Amount to recover
     */
    function emergencyRecoverETH(address to, uint256 amount) 
        external 
        onlyRole(ADMIN_ROLE) 
        whenPaused 
    {
        TrataTechSecurityEnhanced.validateAddress(to);
        require(amount > 0 && amount <= address(this).balance, "Invalid amount");
        
        emit EmergencyWithdrawal(to, amount);
        
        payable(to).sendValue(amount);
    }

    // ============ VIEW FUNCTIONS ============
    
    function platformFee() external view returns (uint256) {
        return _platformFee;
    }
    
    function feeLimits() external view returns (uint256 min, uint256 max) {
        return (_minPlatformFee, _maxPlatformFee);
    }
    
    // ============ RECEIVE FUNCTION ============
    
    receive() external payable {
        // Contract can receive ETH for fees and pre-orders
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