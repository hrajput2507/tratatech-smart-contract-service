const { ethers } = require("hardhat");
const colors = require('colors');

async function main() {
    console.log(colors.cyan.bold("\n🧪 SECURE CONTRACTS API ENDPOINT TESTING"));
    console.log(colors.cyan("=".repeat(60)));
    console.log(colors.gray(`⏰ Started: ${new Date().toISOString()}`));

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log(colors.yellow(`📍 Tester: ${signer.address}\n`));

    // Contract addresses from .env
    const addresses = {
        minimalForwarder: process.env.MINIMAL_FORWARDER_SECURE_ADDRESS,
        main: process.env.MAIN_CONTRACT_SECURE_ADDRESS,
        productPassport: process.env.PRODUCT_PASSPORT_SECURE_ADDRESS,
        provenance: process.env.PROVENANCE_SECURE_ADDRESS,
        ownershipRegistry: process.env.OWNERSHIP_REGISTRY_SECURE_ADDRESS
    };

    const transactions = [];

    try {
        // 1. TEST MAIN CONTRACT FUNCTIONS
        console.log(colors.blue.bold("\n📱 Testing TrataTechMainUpgradeableSecure..."));
        const Main = await ethers.getContractAt(
            "TrataTechMainUpgradeableSecure",
            addresses.main
        );

        // First authorize the signer as a brand
        console.log(colors.gray("  → Authorizing brand..."));
        const authBrandTx = await Main.authorizeBrand(signer.address, { gasLimit: 200000 });
        await authBrandTx.wait();
        transactions.push({
            contract: "MainSecure",
            operation: "authorizeBrand",
            hash: authBrandTx.hash,
            gasUsed: (await authBrandTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${authBrandTx.hash}`));

        // Create Event
        console.log(colors.gray("  → Creating event invite..."));
        const eventDate = Math.floor(Date.now() / 1000) + 86400; // Tomorrow
        const eventTx = await Main.createEventInvite(
            "SecureEvent2025",
            "Testing secure contract event",
            eventDate,
            100,
            "QmEventIPFS123",
            { gasLimit: 500000 }
        );
        await eventTx.wait();
        transactions.push({
            contract: "MainSecure",
            operation: "createEventInvite",
            hash: eventTx.hash,
            gasUsed: (await eventTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${eventTx.hash}`));

        // Submit RSVP
        console.log(colors.gray("  → Submitting RSVP..."));
        const rsvpTx = await Main.submitRSVP(1, { gasLimit: 400000 });
        await rsvpTx.wait();
        transactions.push({
            contract: "MainSecure",
            operation: "submitRSVP",
            hash: rsvpTx.hash,
            gasUsed: (await rsvpTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${rsvpTx.hash}`));

        // Create Product Launch
        console.log(colors.gray("  → Creating product launch..."));
        const launchDate = Math.floor(Date.now() / 1000) + 172800; // 2 days
        const earlyAccessEnd = Math.floor(Date.now() / 1000) + 86400; // 1 day
        const launchTx = await Main.createProductLaunch(
            "SecureProduct",
            "A secure blockchain product",
            launchDate,
            earlyAccessEnd,
            50,
            "QmLaunchIPFS456",
            { gasLimit: 500000 }
        );
        await launchTx.wait();
        transactions.push({
            contract: "MainSecure",
            operation: "createProductLaunch",
            hash: launchTx.hash,
            gasUsed: (await launchTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${launchTx.hash}`));

        // Create DPP
        console.log(colors.gray("  → Creating Digital Product Passport..."));
        const dppTx = await Main.createDPP(
            "PROD-SEC-001",
            "BRAND-SEC-001",
            "QmDPPIPFS789",
            "0x" + "a".repeat(64),
            { gasLimit: 500000 }
        );
        await dppTx.wait();
        transactions.push({
            contract: "MainSecure",
            operation: "createDPP",
            hash: dppTx.hash,
            gasUsed: (await dppTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${dppTx.hash}`));

        // Create Art Drop
        console.log(colors.gray("  → Creating art drop..."));
        const artDropTx = await Main.createArtDrop(
            "SecureArtist",
            "Blockchain Art #1",
            1,
            100,
            "QmArtIPFS012",
            { gasLimit: 500000 }
        );
        await artDropTx.wait();
        transactions.push({
            contract: "MainSecure",
            operation: "createArtDrop",
            hash: artDropTx.hash,
            gasUsed: (await artDropTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${artDropTx.hash}`));

        // Create Offer
        console.log(colors.gray("  → Creating offer..."));
        const validFrom = Math.floor(Date.now() / 1000);
        const validUntil = validFrom + 604800; // 1 week
        const offerTx = await Main.createOffer(
            "50% OFF Security Audit",
            5000, // 50%
            validFrom,
            validUntil,
            "All products",
            "Limited time offer",
            "QmOfferIPFS345",
            false,
            ethers.ZeroHash,
            1000,
            { gasLimit: 500000 }
        );
        await offerTx.wait();
        transactions.push({
            contract: "MainSecure",
            operation: "createOffer",
            hash: offerTx.hash,
            gasUsed: (await offerTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${offerTx.hash}`));

        // Redeem Offer
        console.log(colors.gray("  → Redeeming offer..."));
        const redeemTx = await Main.redeemOffer(1, [], { gasLimit: 400000 });
        await redeemTx.wait();
        transactions.push({
            contract: "MainSecure",
            operation: "redeemOffer",
            hash: redeemTx.hash,
            gasUsed: (await redeemTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${redeemTx.hash}`));

        // 2. TEST OWNERSHIP REGISTRY
        console.log(colors.blue.bold("\n🏠 Testing OwnershipRegistrySecure..."));
        const OwnershipRegistry = await ethers.getContractAt(
            "TrataTechOwnershipRegistryUpgradeableSecure",
            addresses.ownershipRegistry
        );

        // Authorize brand
        console.log(colors.gray("  → Authorizing brand in registry..."));
        const authRegTx = await OwnershipRegistry.authorizeBrand(signer.address, { gasLimit: 200000 });
        await authRegTx.wait();
        transactions.push({
            contract: "OwnershipRegistrySecure",
            operation: "authorizeBrand",
            hash: authRegTx.hash,
            gasUsed: (await authRegTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${authRegTx.hash}`));

        // Create Ownership Deed
        console.log(colors.gray("  → Creating ownership deed..."));
        const deedTx = await OwnershipRegistry.createOwnershipDeed(
            1, // passport ID
            signer.address,
            ethers.parseEther("0.01"),
            "Purchase",
            "QmOwnershipIPFS678",
            "0x" + "b".repeat(64),
            ["warranty", "2years", "receipt", "REC001"],
            { gasLimit: 600000 }
        );
        await deedTx.wait();
        transactions.push({
            contract: "OwnershipRegistrySecure",
            operation: "createOwnershipDeed",
            hash: deedTx.hash,
            gasUsed: (await deedTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${deedTx.hash}`));

        // 3. TEST PROVENANCE CONTRACT
        console.log(colors.blue.bold("\n📋 Testing ProvenanceSecure..."));
        const Provenance = await ethers.getContractAt(
            "TrataTechProvenanceUpgradeableSecure",
            addresses.provenance
        );

        // Authorize brand in provenance
        console.log(colors.gray("  → Authorizing brand in provenance..."));
        const authProvTx = await Provenance.authorizeBrand(signer.address, { gasLimit: 200000 });
        await authProvTx.wait();
        transactions.push({
            contract: "ProvenanceSecure",
            operation: "authorizeBrand",
            hash: authProvTx.hash,
            gasUsed: (await authProvTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${authProvTx.hash}`));

        // Create Provenance Entry
        console.log(colors.gray("  → Creating provenance entry..."));
        const provenanceTx = await Provenance.createProvenanceEntry(
            1, // passport ID
            signer.address,
            signer.address,
            "Manufacturing",
            "Initial production",
            "Factory-A",
            "QmProvenanceIPFS901",
            { gasLimit: 500000 }
        );
        await provenanceTx.wait();
        transactions.push({
            contract: "ProvenanceSecure",
            operation: "createProvenanceEntry",
            hash: provenanceTx.hash,
            gasUsed: (await provenanceTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${provenanceTx.hash}`));

        // Add Service Record
        console.log(colors.gray("  → Adding service record..."));
        const serviceTx = await Provenance.addServiceRecord(
            1, // entry ID
            "Quality Check",
            "Passed all tests",
            Math.floor(Date.now() / 1000),
            "QC-Center-1",
            { gasLimit: 400000 }
        );
        await serviceTx.wait();
        transactions.push({
            contract: "ProvenanceSecure",
            operation: "addServiceRecord",
            hash: serviceTx.hash,
            gasUsed: (await serviceTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${serviceTx.hash}`));

        // 4. TEST PRODUCT PASSPORT
        console.log(colors.blue.bold("\n📄 Testing ProductPassportSecure..."));
        const ProductPassport = await ethers.getContractAt(
            "TrataTechProductPassportUpgradeableSecure",
            addresses.productPassport
        );

        // Register Brand
        console.log(colors.gray("  → Registering brand..."));
        const brandId = "BRAND-" + Date.now();
        const brandTx = await ProductPassport.registerBrand(
            brandId,
            "SecureBrand",
            "Technology",
            "USA",
            "https://secure.com",
            "QmBrandIPFS234",
            ethers.parseEther("0"),
            { gasLimit: 500000 }
        );
        await brandTx.wait();
        transactions.push({
            contract: "ProductPassportSecure",
            operation: "registerBrand",
            hash: brandTx.hash,
            gasUsed: (await brandTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${brandTx.hash}`));

        // Register Product
        console.log(colors.gray("  → Registering product..."));
        const productTx = await ProductPassport.registerProduct(
            "PROD-" + Date.now(),
            "SecureProduct-001",
            brandId,
            "Electronics",
            Math.floor(Date.now() / 1000),
            "QmProductIPFS567",
            { gasLimit: 500000 }
        );
        await productTx.wait();
        transactions.push({
            contract: "ProductPassportSecure",
            operation: "registerProduct",
            hash: productTx.hash,
            gasUsed: (await productTx.wait()).gasUsed.toString()
        });
        console.log(colors.green(`  ✅ TX: ${productTx.hash}`));

        // 5. TEST MINIMAL FORWARDER
        console.log(colors.blue.bold("\n🔐 Testing MinimalForwarderSecure..."));
        const Forwarder = await ethers.getContractAt(
            "MinimalForwarderSecure",
            addresses.minimalForwarder
        );

        // Get nonce
        const nonce = await Forwarder.getNonce(signer.address);
        console.log(colors.green(`  ✅ Forwarder Nonce: ${nonce}`));

        // PRINT SUMMARY
        console.log(colors.cyan.bold("\n" + "=".repeat(60)));
        console.log(colors.cyan.bold("📊 ALL TRANSACTION HASHES"));
        console.log(colors.cyan.bold("=".repeat(60)));

        console.log(colors.white("\n📝 Transaction Details:\n"));

        let totalGas = BigInt(0);
        transactions.forEach((tx, index) => {
            console.log(colors.yellow.bold(`${index + 1}. ${tx.contract}::${tx.operation}`));
            console.log(colors.white(`   📌 Hash: ${colors.cyan(tx.hash)}`));
            console.log(colors.gray(`   ⛽ Gas Used: ${tx.gasUsed}`));
            console.log(colors.green(`   ✅ Status: Success\n`));
            totalGas += BigInt(tx.gasUsed);
        });

        console.log(colors.cyan("=".repeat(60)));
        console.log(colors.green.bold(`✅ Total Successful Transactions: ${transactions.length}`));
        console.log(colors.blue.bold(`⛽ Total Gas Used: ${totalGas.toString()}`));
        console.log(colors.cyan("=".repeat(60)));

        // Save to JSON file
        const fs = require('fs');
        const txData = {
            timestamp: new Date().toISOString(),
            network: "Polygon Amoy Testnet",
            chainId: 80002,
            tester: signer.address,
            contracts: addresses,
            totalTransactions: transactions.length,
            totalGasUsed: totalGas.toString(),
            transactions: transactions,
            explorerLinks: transactions.map(tx => ({
                operation: `${tx.contract}::${tx.operation}`,
                link: `https://amoy.polygonscan.com/tx/${tx.hash}`
            }))
        };

        fs.writeFileSync(
            './secure-contracts-all-transactions.json',
            JSON.stringify(txData, null, 2)
        );
        console.log(colors.blue("\n📁 Transaction data exported to: secure-contracts-all-transactions.json"));
        console.log(colors.green("\n✅ All API endpoints tested successfully!"));

    } catch (error) {
        console.error(colors.red("\n❌ Error:"), error.message);
        if (error.transaction) {
            console.error(colors.red("Failed TX:"), error.transaction);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });