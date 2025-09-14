const { ethers } = require("hardhat");
const colors = require('colors');

async function main() {
    console.log(colors.cyan.bold("\n🧪 COMPREHENSIVE SECURE CONTRACTS API TESTING"));
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
        // 1. TEST PRODUCT PASSPORT CONTRACT
        console.log(colors.blue.bold("\n📄 Testing ProductPassportSecure Contract..."));
        const ProductPassport = await ethers.getContractAt(
            "TrataTechProductPassportUpgradeableSecure",
            addresses.productPassport
        );

        // Register a brand
        console.log(colors.gray("  → Registering brand..."));
        const brandTx = await ProductPassport.registerBrand(
            "BRAND-" + Date.now(),
            "SecureTestBrand",
            "Technology",
            "USA",
            "https://securebrand.com",
            "QmSecureBrandIPFS123",
            { gasLimit: 500000 }
        );
        await brandTx.wait();
        transactions.push({
            contract: "ProductPassport",
            operation: "registerBrand",
            hash: brandTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Brand registered - TX: ${brandTx.hash}`));

        // Register a product
        console.log(colors.gray("  → Registering product..."));
        const productTx = await ProductPassport.registerProduct(
            "PROD-" + Date.now(),
            "SecureProduct-001",
            "BRAND-" + Date.now(),
            "Electronics",
            Math.floor(Date.now() / 1000),
            "QmSecureProductIPFS456",
            { gasLimit: 500000 }
        );
        await productTx.wait();
        transactions.push({
            contract: "ProductPassport",
            operation: "registerProduct",
            hash: productTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Product registered - TX: ${productTx.hash}`));

        // 2. TEST PROVENANCE CONTRACT
        console.log(colors.blue.bold("\n📋 Testing ProvenanceSecure Contract..."));
        const Provenance = await ethers.getContractAt(
            "TrataTechProvenanceUpgradeableSecure",
            addresses.provenance
        );

        // Create provenance entry
        console.log(colors.gray("  → Creating provenance entry..."));
        const provenanceTx = await Provenance.createProvenanceEntry(
            1, // passport ID
            signer.address, // from
            signer.address, // to
            "Manufacturing",
            "Initial production",
            "Factory-001",
            "QmProvenanceIPFS789",
            { gasLimit: 500000 }
        );
        await provenanceTx.wait();
        transactions.push({
            contract: "Provenance",
            operation: "createProvenanceEntry",
            hash: provenanceTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Provenance entry created - TX: ${provenanceTx.hash}`));

        // Add service record
        console.log(colors.gray("  → Adding service record..."));
        const serviceTx = await Provenance.addServiceRecord(
            1, // entry ID
            "Quality Check",
            "Passed all tests",
            Math.floor(Date.now() / 1000),
            "ServiceCenter-001",
            { gasLimit: 500000 }
        );
        await serviceTx.wait();
        transactions.push({
            contract: "Provenance",
            operation: "addServiceRecord",
            hash: serviceTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Service record added - TX: ${serviceTx.hash}`));

        // 3. TEST OWNERSHIP REGISTRY CONTRACT
        console.log(colors.blue.bold("\n🏠 Testing OwnershipRegistrySecure Contract..."));
        const OwnershipRegistry = await ethers.getContractAt(
            "TrataTechOwnershipRegistryUpgradeableSecure",
            addresses.ownershipRegistry
        );

        // Authorize as brand first
        console.log(colors.gray("  → Authorizing brand..."));
        const authBrandTx = await OwnershipRegistry.authorizeBrand(signer.address, { gasLimit: 200000 });
        await authBrandTx.wait();
        transactions.push({
            contract: "OwnershipRegistry",
            operation: "authorizeBrand",
            hash: authBrandTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Brand authorized - TX: ${authBrandTx.hash}`));

        // Create ownership deed
        console.log(colors.gray("  → Creating ownership deed..."));
        const deedTx = await OwnershipRegistry.createOwnershipDeed(
            1, // passport ID
            signer.address,
            ethers.parseEther("0.1"),
            "Purchase",
            "QmOwnershipIPFS321",
            "0x" + "a".repeat(64), // metadata hash
            ["warranty", "2-years", "receipt", "REC-001"],
            { gasLimit: 500000 }
        );
        await deedTx.wait();
        transactions.push({
            contract: "OwnershipRegistry",
            operation: "createOwnershipDeed",
            hash: deedTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Ownership deed created - TX: ${deedTx.hash}`));

        // 4. TEST MAIN CONTRACT
        console.log(colors.blue.bold("\n📱 Testing MainSecure Contract..."));
        const Main = await ethers.getContractAt(
            "TrataTechMainUpgradeableSecure",
            addresses.main
        );

        // Authorize as brand
        console.log(colors.gray("  → Authorizing brand in Main..."));
        const mainAuthTx = await Main.authorizeBrand(signer.address, { gasLimit: 200000 });
        await mainAuthTx.wait();
        transactions.push({
            contract: "Main",
            operation: "authorizeBrand",
            hash: mainAuthTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Brand authorized in Main - TX: ${mainAuthTx.hash}`));

        // Create event
        console.log(colors.gray("  → Creating event..."));
        const eventDate = Math.floor(Date.now() / 1000) + 86400; // Tomorrow
        const eventTx = await Main.createEventInvite(
            "SecureLaunch2025",
            "Product launch event for secure contracts",
            eventDate,
            100,
            "QmEventIPFS654",
            { gasLimit: 500000 }
        );
        await eventTx.wait();
        transactions.push({
            contract: "Main",
            operation: "createEventInvite",
            hash: eventTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Event created - TX: ${eventTx.hash}`));

        // Submit RSVP
        console.log(colors.gray("  → Submitting RSVP..."));
        const rsvpTx = await Main.submitRSVP(1, { gasLimit: 300000 });
        await rsvpTx.wait();
        transactions.push({
            contract: "Main",
            operation: "submitRSVP",
            hash: rsvpTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ RSVP submitted - TX: ${rsvpTx.hash}`));

        // Create product launch
        console.log(colors.gray("  → Creating product launch..."));
        const launchDate = Math.floor(Date.now() / 1000) + 172800; // 2 days
        const earlyAccessEnd = Math.floor(Date.now() / 1000) + 86400; // 1 day
        const launchTx = await Main.createProductLaunch(
            "SecureProduct V2",
            "Next generation secure product",
            launchDate,
            earlyAccessEnd,
            50,
            "QmLaunchIPFS987",
            { gasLimit: 500000 }
        );
        await launchTx.wait();
        transactions.push({
            contract: "Main",
            operation: "createProductLaunch",
            hash: launchTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Product launch created - TX: ${launchTx.hash}`));

        // Create offer
        console.log(colors.gray("  → Creating offer..."));
        const validFrom = Math.floor(Date.now() / 1000);
        const validUntil = validFrom + 604800; // 1 week
        const offerTx = await Main.createOffer(
            "Security Special 50% OFF",
            5000, // 50%
            validFrom,
            validUntil,
            "All security products",
            "Valid for verified users",
            "QmOfferIPFS147",
            false,
            ethers.ZeroHash,
            1000,
            { gasLimit: 500000 }
        );
        await offerTx.wait();
        transactions.push({
            contract: "Main",
            operation: "createOffer",
            hash: offerTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Offer created - TX: ${offerTx.hash}`));

        // Redeem offer
        console.log(colors.gray("  → Redeeming offer..."));
        const redeemTx = await Main.redeemOffer(1, [], { gasLimit: 300000 });
        await redeemTx.wait();
        transactions.push({
            contract: "Main",
            operation: "redeemOffer",
            hash: redeemTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Offer redeemed - TX: ${redeemTx.hash}`));

        // Create DPP
        console.log(colors.gray("  → Creating Digital Product Passport..."));
        const dppTx = await Main.createDPP(
            "DPP-" + Date.now(),
            "BRAND-001",
            "QmDPPIPFS258",
            "0x" + "b".repeat(64),
            { gasLimit: 500000 }
        );
        await dppTx.wait();
        transactions.push({
            contract: "Main",
            operation: "createDPP",
            hash: dppTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ DPP created - TX: ${dppTx.hash}`));

        // Create art drop
        console.log(colors.gray("  → Creating art drop..."));
        const artDropTx = await Main.createArtDrop(
            "SecureArtist",
            "Blockchain Security Art",
            1,
            100,
            "QmArtIPFS369",
            { gasLimit: 500000 }
        );
        await artDropTx.wait();
        transactions.push({
            contract: "Main",
            operation: "createArtDrop",
            hash: artDropTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Art drop created - TX: ${artDropTx.hash}`));

        // Authorize operator for airdrop
        console.log(colors.gray("  → Authorizing operator..."));
        const authOpTx = await Main.authorizeOperator(signer.address, { gasLimit: 200000 });
        await authOpTx.wait();
        transactions.push({
            contract: "Main",
            operation: "authorizeOperator",
            hash: authOpTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Operator authorized - TX: ${authOpTx.hash}`));

        // Airdrop artwork
        console.log(colors.gray("  → Airdropping artwork..."));
        const airdropTx = await Main.airdropArtwork(
            1,
            [signer.address],
            { gasLimit: 500000 }
        );
        await airdropTx.wait();
        transactions.push({
            contract: "Main",
            operation: "airdropArtwork",
            hash: airdropTx.hash,
            status: "✅"
        });
        console.log(colors.green(`  ✅ Artwork airdropped - TX: ${airdropTx.hash}`));

        // 5. TEST MINIMAL FORWARDER
        console.log(colors.blue.bold("\n🔐 Testing MinimalForwarderSecure Contract..."));
        const Forwarder = await ethers.getContractAt(
            "MinimalForwarderSecure",
            addresses.minimalForwarder
        );

        // Get nonce
        console.log(colors.gray("  → Getting nonce..."));
        const nonce = await Forwarder.getNonce(signer.address);
        console.log(colors.green(`  ✅ Current nonce: ${nonce}`));

        // SUMMARY
        console.log(colors.cyan.bold("\n📊 TRANSACTION SUMMARY"));
        console.log(colors.cyan("=".repeat(60)));

        console.log(colors.white("\n📝 All Transaction Hashes:\n"));
        transactions.forEach((tx, index) => {
            console.log(colors.yellow(`${index + 1}. ${tx.contract} - ${tx.operation}:`));
            console.log(colors.gray(`   Hash: ${tx.hash}`));
            console.log(colors.green(`   Status: ${tx.status}\n`));
        });

        console.log(colors.cyan("=".repeat(60)));
        console.log(colors.green.bold(`✅ Total Transactions: ${transactions.length}`));
        console.log(colors.green.bold(`✅ All transactions successful!`));

        // Export to file
        const fs = require('fs');
        const txData = {
            timestamp: new Date().toISOString(),
            network: "Polygon Amoy Testnet",
            tester: signer.address,
            contracts: addresses,
            transactions: transactions
        };

        fs.writeFileSync(
            './secure-contracts-transaction-hashes.json',
            JSON.stringify(txData, null, 2)
        );
        console.log(colors.blue("\n📁 Transaction data saved to: secure-contracts-transaction-hashes.json"));

    } catch (error) {
        console.error(colors.red("\n❌ Error during testing:"), error.message);
        if (error.transaction) {
            console.error(colors.red("Failed transaction:"), error.transaction);
        }
    }

    console.log(colors.cyan("\n✅ Testing completed!"));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });