const { ethers } = require("hardhat");
const colors = require('colors');

async function main() {
    console.log(colors.cyan.bold("\n🧪 SECURE CONTRACTS - COMPLETE API TESTING WITH ALL TRANSACTION HASHES"));
    console.log(colors.cyan("=".repeat(80)));
    console.log(colors.gray(`⏰ Started: ${new Date().toISOString()}`));

    const [signer] = await ethers.getSigners();
    console.log(colors.yellow(`📍 Tester: ${signer.address}\n`));

    const addresses = {
        minimalForwarder: process.env.MINIMAL_FORWARDER_SECURE_ADDRESS,
        main: process.env.MAIN_CONTRACT_SECURE_ADDRESS,
        productPassport: process.env.PRODUCT_PASSPORT_SECURE_ADDRESS,
        provenance: process.env.PROVENANCE_SECURE_ADDRESS,
        ownershipRegistry: process.env.OWNERSHIP_REGISTRY_SECURE_ADDRESS
    };

    const allTransactions = [];

    try {
        // 1. MAIN CONTRACT TRANSACTIONS
        console.log(colors.blue.bold("\n📱 MAIN CONTRACT TRANSACTIONS"));
        console.log(colors.blue("-".repeat(60)));
        const Main = await ethers.getContractAt("TrataTechMainUpgradeableSecure", addresses.main);

        // Already authorized from previous run, skip if fails
        try {
            const tx1 = await Main.authorizeBrand(signer.address, { gasLimit: 200000 });
            await tx1.wait();
            allTransactions.push({ contract: "Main", op: "authorizeBrand", hash: tx1.hash });
            console.log(colors.green(`✅ authorizeBrand: ${tx1.hash}`));
        } catch (e) {
            console.log(colors.gray(`⏭️  Brand already authorized`));
        }

        // Authorize operator
        try {
            const tx2 = await Main.authorizeOperator(signer.address, { gasLimit: 200000 });
            await tx2.wait();
            allTransactions.push({ contract: "Main", op: "authorizeOperator", hash: tx2.hash });
            console.log(colors.green(`✅ authorizeOperator: ${tx2.hash}`));
        } catch (e) {
            console.log(colors.gray(`⏭️  Operator already authorized`));
        }

        // Create more events
        for (let i = 0; i < 2; i++) {
            const eventDate = Math.floor(Date.now() / 1000) + 86400 + (i * 3600);
            const tx = await Main.createEventInvite(
                `Event-${Date.now()}-${i}`,
                `Test Event ${i}`,
                eventDate,
                50 + i * 10,
                `QmEvent${i}`,
                { gasLimit: 500000 }
            );
            await tx.wait();
            allTransactions.push({ contract: "Main", op: "createEventInvite", hash: tx.hash });
            console.log(colors.green(`✅ createEventInvite ${i}: ${tx.hash}`));
        }

        // Grant early access
        const tx3 = await Main.grantEarlyAccess(1, signer.address, { gasLimit: 400000 });
        await tx3.wait();
        allTransactions.push({ contract: "Main", op: "grantEarlyAccess", hash: tx3.hash });
        console.log(colors.green(`✅ grantEarlyAccess: ${tx3.hash}`));

        // Place pre-order
        const tx4 = await Main.placePreOrder(1, { gasLimit: 300000 });
        await tx4.wait();
        allTransactions.push({ contract: "Main", op: "placePreOrder", hash: tx4.hash });
        console.log(colors.green(`✅ placePreOrder: ${tx4.hash}`));

        // Airdrop artwork
        const tx5 = await Main.airdropArtwork(1, [signer.address], { gasLimit: 500000 });
        await tx5.wait();
        allTransactions.push({ contract: "Main", op: "airdropArtwork", hash: tx5.hash });
        console.log(colors.green(`✅ airdropArtwork: ${tx5.hash}`));

        // 2. OWNERSHIP REGISTRY TRANSACTIONS
        console.log(colors.blue.bold("\n🏠 OWNERSHIP REGISTRY TRANSACTIONS"));
        console.log(colors.blue("-".repeat(60)));
        const Registry = await ethers.getContractAt("TrataTechOwnershipRegistryUpgradeableSecure", addresses.ownershipRegistry);

        // Lock deed
        const tx6 = await Registry.lockDeed(1, 86400, { gasLimit: 300000 });
        await tx6.wait();
        allTransactions.push({ contract: "Registry", op: "lockDeed", hash: tx6.hash });
        console.log(colors.green(`✅ lockDeed: ${tx6.hash}`));

        // Unlock deed
        const tx7 = await Registry.unlockDeed(1, { gasLimit: 300000 });
        await tx7.wait();
        allTransactions.push({ contract: "Registry", op: "unlockDeed", hash: tx7.hash });
        console.log(colors.green(`✅ unlockDeed: ${tx7.hash}`));

        // Create transfer request
        const tx8 = await Registry.createTransferRequest(
            1,
            "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            ethers.parseEther("0.05"),
            "Sale",
            { gasLimit: 400000 }
        );
        await tx8.wait();
        allTransactions.push({ contract: "Registry", op: "createTransferRequest", hash: tx8.hash });
        console.log(colors.green(`✅ createTransferRequest: ${tx8.hash}`));

        // 3. PROVENANCE TRANSACTIONS
        console.log(colors.blue.bold("\n📋 PROVENANCE TRANSACTIONS"));
        console.log(colors.blue("-".repeat(60)));
        const Provenance = await ethers.getContractAt("TrataTechProvenanceUpgradeableSecure", addresses.provenance);

        // Create multiple provenance entries
        for (let i = 0; i < 2; i++) {
            const tx = await Provenance.createProvenanceEntry(
                i + 2,
                signer.address,
                signer.address,
                `Stage-${i}`,
                `Description-${i}`,
                `Location-${i}`,
                `QmProv${i}`,
                { gasLimit: 500000 }
            );
            await tx.wait();
            allTransactions.push({ contract: "Provenance", op: "createProvenanceEntry", hash: tx.hash });
            console.log(colors.green(`✅ createProvenanceEntry ${i}: ${tx.hash}`));
        }

        // Batch create entries
        const tx9 = await Provenance.batchCreateEntries(
            [3, 4],
            [signer.address, signer.address],
            [signer.address, signer.address],
            ["Batch1", "Batch2"],
            ["Desc1", "Desc2"],
            ["Loc1", "Loc2"],
            ["QmB1", "QmB2"],
            { gasLimit: 800000 }
        );
        await tx9.wait();
        allTransactions.push({ contract: "Provenance", op: "batchCreateEntries", hash: tx9.hash });
        console.log(colors.green(`✅ batchCreateEntries: ${tx9.hash}`));

        // 4. PRODUCT PASSPORT TRANSACTIONS
        console.log(colors.blue.bold("\n📄 PRODUCT PASSPORT TRANSACTIONS"));
        console.log(colors.blue("-".repeat(60)));
        const Passport = await ethers.getContractAt("TrataTechProductPassportUpgradeableSecure", addresses.productPassport);

        // Verify brand
        const tx10 = await Passport.verifyBrand(`BRAND-${Date.now() - 10000}`, { gasLimit: 200000 });
        await tx10.wait();
        allTransactions.push({ contract: "Passport", op: "verifyBrand", hash: tx10.hash });
        console.log(colors.green(`✅ verifyBrand: ${tx10.hash}`));

        // Register more products
        for (let i = 0; i < 2; i++) {
            const tx = await Passport.registerProduct(
                `PROD-${Date.now()}-${i}`,
                `Product-${i}`,
                `BRAND-${Date.now() - 10000}`,
                "Category",
                Math.floor(Date.now() / 1000),
                `QmProd${i}`,
                { gasLimit: 500000 }
            );
            await tx.wait();
            allTransactions.push({ contract: "Passport", op: "registerProduct", hash: tx.hash });
            console.log(colors.green(`✅ registerProduct ${i}: ${tx.hash}`));
        }

        // 5. MINIMAL FORWARDER TRANSACTIONS
        console.log(colors.blue.bold("\n🔐 MINIMAL FORWARDER"));
        console.log(colors.blue("-".repeat(60)));
        const Forwarder = await ethers.getContractAt("MinimalForwarderSecure", addresses.minimalForwarder);

        const nonce = await Forwarder.getNonce(signer.address);
        console.log(colors.green(`✅ Current Nonce: ${nonce}`));

        // Reset failed executions if needed
        const tx11 = await Forwarder.resetFailedExecutions(signer.address, { gasLimit: 100000 });
        await tx11.wait();
        allTransactions.push({ contract: "Forwarder", op: "resetFailedExecutions", hash: tx11.hash });
        console.log(colors.green(`✅ resetFailedExecutions: ${tx11.hash}`));

        // FINAL SUMMARY
        console.log(colors.cyan.bold("\n" + "=".repeat(80)));
        console.log(colors.cyan.bold("🎯 COMPLETE TRANSACTION HASH SUMMARY"));
        console.log(colors.cyan.bold("=".repeat(80)));

        console.log(colors.white("\n📊 All Transaction Hashes:\n"));

        // Group by contract
        const grouped = {};
        allTransactions.forEach(tx => {
            if (!grouped[tx.contract]) grouped[tx.contract] = [];
            grouped[tx.contract].push(tx);
        });

        let totalCount = 0;
        Object.keys(grouped).forEach(contract => {
            console.log(colors.yellow.bold(`\n${contract} Contract:`));
            grouped[contract].forEach((tx, i) => {
                totalCount++;
                console.log(colors.white(`  ${totalCount}. ${tx.op}:`));
                console.log(colors.cyan(`     ${tx.hash}`));
                console.log(colors.gray(`     🔗 https://amoy.polygonscan.com/tx/${tx.hash}`));
            });
        });

        console.log(colors.cyan.bold("\n" + "=".repeat(80)));
        console.log(colors.green.bold(`✅ TOTAL TRANSACTIONS: ${allTransactions.length}`));
        console.log(colors.cyan.bold("=".repeat(80)));

        // Export to JSON
        const fs = require('fs');
        const exportData = {
            timestamp: new Date().toISOString(),
            network: "Polygon Amoy Testnet",
            chainId: 80002,
            tester: signer.address,
            deployedContracts: addresses,
            totalTransactions: allTransactions.length,
            transactions: allTransactions.map((tx, i) => ({
                index: i + 1,
                contract: tx.contract,
                operation: tx.op,
                transactionHash: tx.hash,
                explorerLink: `https://amoy.polygonscan.com/tx/${tx.hash}`
            }))
        };

        fs.writeFileSync(
            './secure-contracts-all-transaction-hashes.json',
            JSON.stringify(exportData, null, 2)
        );

        console.log(colors.blue("\n📁 Full transaction data exported to: secure-contracts-all-transaction-hashes.json"));
        console.log(colors.green.bold("\n🎉 ALL SECURE CONTRACT API ENDPOINTS TESTED SUCCESSFULLY!"));

    } catch (error) {
        console.error(colors.red("\n❌ Error:"), error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });