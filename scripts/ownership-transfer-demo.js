const { ethers } = require("hardhat");
const colors = require('colors');

async function main() {
    console.log(colors.cyan.bold("\n🔄 OWNERSHIP TRANSFER DEMO - SECURE CONTRACT"));
    console.log(colors.cyan("=".repeat(70)));
    console.log(colors.gray(`⏰ Started: ${new Date().toISOString()}`));

    const [signer] = await ethers.getSigners();
    const registryAddress = process.env.OWNERSHIP_REGISTRY_SECURE_ADDRESS;
    const recipientAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Test address

    console.log(colors.yellow(`📍 Owner: ${signer.address}`));
    console.log(colors.yellow(`📍 Target Recipient: ${recipientAddress}`));
    console.log(colors.blue(`📄 Registry: ${registryAddress}\n`));

    const allTransactions = [];

    try {
        const Registry = await ethers.getContractAt(
            "TrataTechOwnershipRegistryUpgradeableSecure",
            registryAddress
        );

        // STEP 1: Create a new deed for testing
        console.log(colors.blue.bold("STEP 1: CREATE OWNERSHIP DEED"));
        console.log(colors.blue("-".repeat(50)));

        const passportId = Math.floor(Math.random() * 100000) + 1000;
        console.log(colors.gray(`  → Creating deed for passport ID: ${passportId}...`));

        const createTx = await Registry.createOwnershipDeed(
            passportId,
            signer.address,
            ethers.parseEther("0.1"),
            "Purchase",
            "QmTestOwnership456",
            "0x" + "c".repeat(64),
            ["type", "electronics", "warranty", "1year"],
            { gasLimit: 600000 }
        );
        const createReceipt = await createTx.wait();

        // Extract deed ID from events
        let deedId;
        for (const log of createReceipt.logs) {
            try {
                const parsedLog = Registry.interface.parseLog(log);
                if (parsedLog.name === "OwnershipDeedCreated") {
                    deedId = parsedLog.args[0];
                    break;
                }
            } catch (e) {
                // Skip unparseable logs
                continue;
            }
        }

        allTransactions.push({
            step: "Creation",
            operation: "createOwnershipDeed",
            hash: createTx.hash,
            deedId: deedId?.toString() || "Unknown",
            gasUsed: createReceipt.gasUsed.toString()
        });

        console.log(colors.green(`  ✅ Deed created with ID: ${deedId} - TX: ${createTx.hash}`));

        // STEP 2: Lock and unlock deed to test functionality
        console.log(colors.blue.bold("\nSTEP 2: LOCK/UNLOCK DEED FUNCTIONALITY"));
        console.log(colors.blue("-".repeat(50)));

        console.log(colors.gray("  → Locking deed..."));
        const lockTx = await Registry.lockDeed(deedId, 3600, { gasLimit: 300000 }); // 1 hour lock
        const lockReceipt = await lockTx.wait();

        allTransactions.push({
            step: "Locking",
            operation: "lockDeed",
            hash: lockTx.hash,
            deedId: deedId.toString(),
            gasUsed: lockReceipt.gasUsed.toString()
        });

        console.log(colors.green(`  ✅ Deed locked - TX: ${lockTx.hash}`));

        console.log(colors.gray("  → Unlocking deed..."));
        const unlockTx = await Registry.unlockDeed(deedId, { gasLimit: 300000 });
        const unlockReceipt = await unlockTx.wait();

        allTransactions.push({
            step: "Unlocking",
            operation: "unlockDeed",
            hash: unlockTx.hash,
            deedId: deedId.toString(),
            gasUsed: unlockReceipt.gasUsed.toString()
        });

        console.log(colors.green(`  ✅ Deed unlocked - TX: ${unlockTx.hash}`));

        // STEP 3: Create transfer request
        console.log(colors.blue.bold("\nSTEP 3: CREATE TRANSFER REQUEST"));
        console.log(colors.blue("-".repeat(50)));

        const transferPrice = ethers.parseEther("0.15");
        console.log(colors.gray(`  → Creating transfer request for ${ethers.formatEther(transferPrice)} ETH...`));

        const requestTx = await Registry.createTransferRequest(
            deedId,
            recipientAddress,
            transferPrice,
            "Demo Transfer",
            { gasLimit: 400000 }
        );
        const requestReceipt = await requestTx.wait();

        // Extract request ID
        let requestId;
        for (const log of requestReceipt.logs) {
            try {
                const parsedLog = Registry.interface.parseLog(log);
                if (parsedLog.name === "TransferRequestCreated") {
                    requestId = parsedLog.args[0];
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        allTransactions.push({
            step: "Transfer Request",
            operation: "createTransferRequest",
            hash: requestTx.hash,
            requestId: requestId?.toString() || "Unknown",
            gasUsed: requestReceipt.gasUsed.toString()
        });

        console.log(colors.green(`  ✅ Transfer request created with ID: ${requestId} - TX: ${requestTx.hash}`));

        // STEP 4: Approve transfer
        console.log(colors.blue.bold("\nSTEP 4: APPROVE TRANSFER"));
        console.log(colors.blue("-".repeat(50)));

        console.log(colors.gray("  → Approving transfer request..."));
        const approveTx = await Registry.approveTransferRequest(requestId, { gasLimit: 300000 });
        const approveReceipt = await approveTx.wait();

        allTransactions.push({
            step: "Approval",
            operation: "approveTransferRequest",
            hash: approveTx.hash,
            requestId: requestId.toString(),
            gasUsed: approveReceipt.gasUsed.toString()
        });

        console.log(colors.green(`  ✅ Transfer approved - TX: ${approveTx.hash}`));

        // STEP 5: Query functions demonstration
        console.log(colors.blue.bold("\nSTEP 5: QUERY FUNCTIONS DEMO"));
        console.log(colors.blue("-".repeat(50)));

        // Test paginated pending requests (this was the main security fix)
        console.log(colors.gray("  → Testing paginated pending requests..."));
        const pendingRequests = await Registry.getPendingTransferRequestsPaginated(deedId, 0, 10);
        console.log(colors.cyan(`  ℹ️  Found ${pendingRequests.length} pending requests`));

        // Get deed details
        const deedDetails = await Registry.ownershipDeeds(deedId);
        console.log(colors.cyan(`  ℹ️  Current owner: ${deedDetails.owner}`));
        console.log(colors.cyan(`  ℹ️  Is locked: ${deedDetails.isLocked}`));
        console.log(colors.cyan(`  ℹ️  Pending request count: ${deedDetails.pendingRequestCount}`));

        // FINAL SUMMARY
        console.log(colors.cyan.bold("\n" + "=".repeat(70)));
        console.log(colors.cyan.bold("📊 OWNERSHIP TRANSFER DEMO SUMMARY"));
        console.log(colors.cyan.bold("=".repeat(70)));

        console.log(colors.white("\n🎯 Demonstration Results:"));
        console.log(colors.green("  ✅ Created ownership deed successfully"));
        console.log(colors.green("  ✅ Lock/unlock functionality working"));
        console.log(colors.green("  ✅ Transfer request system functional"));
        console.log(colors.green("  ✅ Approval mechanism working"));
        console.log(colors.green("  ✅ Security-enhanced pagination tested"));

        console.log(colors.white("\n📝 All Transaction Hashes:\n"));

        let totalGas = BigInt(0);
        allTransactions.forEach((tx, index) => {
            console.log(colors.yellow.bold(`${index + 1}. [${tx.step}] ${tx.operation}:`));
            console.log(colors.cyan(`   Hash: ${tx.hash}`));
            if (tx.deedId) console.log(colors.gray(`   Deed ID: ${tx.deedId}`));
            if (tx.requestId) console.log(colors.gray(`   Request ID: ${tx.requestId}`));
            console.log(colors.gray(`   Gas Used: ${tx.gasUsed}`));
            console.log(colors.blue(`   🔗 https://amoy.polygonscan.com/tx/${tx.hash}\n`));
            totalGas += BigInt(tx.gasUsed);
        });

        console.log(colors.cyan("=".repeat(70)));
        console.log(colors.green.bold(`✅ Total Transactions: ${allTransactions.length}`));
        console.log(colors.blue.bold(`⛽ Total Gas Used: ${totalGas.toString()}`));
        console.log(colors.cyan("=".repeat(70)));

        // Save results
        const fs = require('fs');
        const demoData = {
            timestamp: new Date().toISOString(),
            network: "Polygon Amoy Testnet",
            chainId: 80002,
            contract: registryAddress,
            demonstratedFeatures: [
                "Ownership deed creation",
                "Deed locking/unlocking",
                "Transfer request creation",
                "Transfer approval",
                "Security-enhanced pagination",
                "Complete ownership lifecycle"
            ],
            createdDeedId: deedId?.toString(),
            createdRequestId: requestId?.toString(),
            totalTransactions: allTransactions.length,
            totalGasUsed: totalGas.toString(),
            transactions: allTransactions
        };

        fs.writeFileSync(
            './ownership-transfer-demo-results.json',
            JSON.stringify(demoData, null, 2)
        );

        console.log(colors.blue("\n📁 Demo results saved to: ownership-transfer-demo-results.json"));
        console.log(colors.green.bold("\n🎉 OWNERSHIP TRANSFER DEMO COMPLETED SUCCESSFULLY!"));

    } catch (error) {
        console.error(colors.red("\n❌ Error:"), error.message);
        if (error.transaction) {
            console.error(colors.red("TX Hash:"), error.transaction);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });