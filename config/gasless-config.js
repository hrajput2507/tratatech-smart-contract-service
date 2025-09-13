/**
 * Gasless Transaction Configuration
 * This file contains configuration for various gasless transaction providers
 */

module.exports = {
    // TrataTech Custom Forwarders
    tratatech: {
        polygon: {
            forwarder: process.env.TRATATECH_FORWARDER_POLYGON || "",
            minimalForwarder: process.env.MINIMAL_FORWARDER_POLYGON || "",
        },
        polygonAmoy: {
            forwarder: process.env.TRATATECH_FORWARDER_AMOY || "",
            minimalForwarder: process.env.MINIMAL_FORWARDER_AMOY || "",
        },
        localhost: {
            forwarder: process.env.TRATATECH_FORWARDER_LOCAL || "0x0000000000000000000000000000000000000000",
            minimalForwarder: process.env.MINIMAL_FORWARDER_LOCAL || "0x0000000000000000000000000000000000000000",
        },
        hardhat: {
            forwarder: process.env.TRATATECH_FORWARDER_LOCAL || "0x0000000000000000000000000000000000000000",
            minimalForwarder: process.env.MINIMAL_FORWARDER_LOCAL || "0x0000000000000000000000000000000000000000",
        }
    },

    // Biconomy Configuration (Fallback)
    biconomy: {
        polygon: {
            forwarder: "0x86C80a8aa58e0A4fa09A69624c31Ab2a6CAD56b8",
            apiKey: process.env.BICONOMY_API_KEY || "",
            apiId: process.env.BICONOMY_API_ID || "",
            webhookUrl: process.env.BICONOMY_WEBHOOK_URL || "",
            debug: true
        },
        polygonAmoy: {
            forwarder: "0x69015912AA33720b842dCD6aC059Ed623F28d9f7",
            apiKey: process.env.BICONOMY_API_KEY || "",
            apiId: process.env.BICONOMY_API_ID || "",
            webhookUrl: process.env.BICONOMY_WEBHOOK_URL || "",
            debug: true
        }
    },

    // Gelato Relay Configuration
    gelato: {
        polygon: {
            forwarder: "0xd8253782c45a12053594b9deB72d8e8aB2Fca54c",
            apiKey: process.env.GELATO_API_KEY || "",
            sponsorApiKey: process.env.GELATO_SPONSOR_API_KEY || ""
        },
        polygonAmoy: {
            forwarder: "0xd8253782c45a12053594b9deB72d8e8aB2Fca54c",
            apiKey: process.env.GELATO_API_KEY || "",
            sponsorApiKey: process.env.GELATO_SPONSOR_API_KEY || ""
        }
    },

    // OpenZeppelin Defender Relay Configuration
    defender: {
        polygon: {
            apiKey: process.env.DEFENDER_API_KEY || "",
            apiSecret: process.env.DEFENDER_API_SECRET || "",
            relayerApiKey: process.env.DEFENDER_RELAYER_API_KEY || "",
            relayerApiSecret: process.env.DEFENDER_RELAYER_API_SECRET || ""
        },
        polygonAmoy: {
            apiKey: process.env.DEFENDER_API_KEY || "",
            apiSecret: process.env.DEFENDER_API_SECRET || "",
            relayerApiKey: process.env.DEFENDER_RELAYER_API_KEY || "",
            relayerApiSecret: process.env.DEFENDER_RELAYER_API_SECRET || ""
        }
    },

    // Supported methods for gasless transactions
    supportedMethods: [
        // Main contract methods
        "createEventInvite",
        "submitRSVP",
        "cancelRSVP",
        "createProductLaunch",
        "grantEarlyAccess",
        "createDPP",
        "createArtDrop",
        "airdropArtwork",
        "createOffer",
        "redeemOffer",
        // Provenance contract methods
        "createProvenanceEntry",
        "updateProvenanceEntry",
        "setProvenanceData",
        "createServiceRecord",
        "updateServiceRecord",
        "createBatchProvenanceEntries",
        // Ownership Registry contract methods
        "createOwnershipDeed",
        "transferOwnershipDeed",
        "lockDeed",
        "unlockDeed",
        "createTransferRequest",
        "approveTransferRequest",
        "rejectTransferRequest",
        "executeTransferRequest",
        "setRoyalty",
        "disableRoyalty"
    ],

    // Gas limits for different operations
    gasLimits: {
        // Main contract gas limits
        createEventInvite: 300000,
        submitRSVP: 200000,
        cancelRSVP: 150000,
        createProductLaunch: 350000,
        grantEarlyAccess: 200000,
        placePreOrder: 150000,
        createDPP: 250000,
        invalidateDPP: 100000,
        createArtDrop: 250000,
        airdropArtwork: 500000,
        createOffer: 300000,
        redeemOffer: 250000,
        // Provenance contract gas limits
        createProvenanceEntry: 400000,
        updateProvenanceEntry: 200000,
        setProvenanceData: 150000,
        createServiceRecord: 350000,
        updateServiceRecord: 150000,
        createBatchProvenanceEntries: 800000,
        // Ownership Registry contract gas limits
        createOwnershipDeed: 400000,
        transferOwnershipDeed: 300000,
        lockDeed: 100000,
        unlockDeed: 100000,
        createTransferRequest: 200000,
        approveTransferRequest: 80000,
        rejectTransferRequest: 80000,
        executeTransferRequest: 350000,
        setRoyalty: 100000,
        disableRoyalty: 50000,
        default: 200000
    },

    // Provider selection
    getProvider: function(network) {
        // Priority order: TrataTech > Biconomy > Gelato > Defender
        if (process.env.USE_TRATATECH_FORWARDER === "true") {
            return this.tratatech[network];
        } else if (process.env.USE_BICONOMY === "true") {
            return this.biconomy[network];
        } else if (process.env.USE_GELATO === "true") {
            return this.gelato[network];
        } else if (process.env.USE_DEFENDER === "true") {
            return this.defender[network];
        }
        
        // Default to TrataTech forwarders
        return this.tratatech[network] || this.biconomy[network];
    },

    // Get forwarder address for a network
    getForwarder: function(network) {
        const provider = this.getProvider(network);
        if (!provider) return "0x0000000000000000000000000000000000000000";
        
        // Prefer enhanced TrataTech forwarder, fallback to minimal
        return provider.forwarder || provider.minimalForwarder || "0x0000000000000000000000000000000000000000";
    },

    // Get minimal forwarder (simpler version)
    getMinimalForwarder: function(network) {
        const provider = this.tratatech[network];
        return provider ? provider.minimalForwarder : "0x0000000000000000000000000000000000000000";
    },

    // Get enhanced TrataTech forwarder
    getTrataTechForwarder: function(network) {
        const provider = this.tratatech[network];
        return provider ? provider.forwarder : "0x0000000000000000000000000000000000000000";
    }
};