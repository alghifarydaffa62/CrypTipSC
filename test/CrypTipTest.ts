import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, zeroAddress } from "viem";
import type { NetworkConnection } from "hardhat/types/network";

const { networkHelpers } = await network.create();

describe("CrypTip Test", async function () {

  async function deployCrypTipFixture({ viem }: NetworkConnection) {
    const publicClient = await viem.getPublicClient();
    const [owner, streamer, viewer] = await viem.getWalletClients();
    const crypTip = await viem.deployContract("CrypTip");
    return { crypTip, owner, streamer, viewer, publicClient };
  }

  describe("Deployment & initiation", async function () {
    it("Must assign Owner correctly", async function () {
      const { crypTip, owner } = await networkHelpers.loadFixture(deployCrypTipFixture);
      const contractOwner = await crypTip.read.owner();
      assert.equal(
        contractOwner.toLowerCase(),
        owner.account.address.toLowerCase(),
        "Owner should be the same as the deployer"
      );
    });

    it("Must have an initial platform fee of 5%", async function () {
      const { crypTip } = await networkHelpers.loadFixture(deployCrypTipFixture);
      const fee = await crypTip.read.platformFeePercentage();
      assert.equal(fee, 5n, "Fee default harus 5");
    });
  });

  describe("Function sendTip validation", async function () {
    it("Fail if amount is 0", async function () {
      const { crypTip, streamer, viewer } = await networkHelpers.loadFixture(deployCrypTipFixture);

      await assert.rejects(
        crypTip.write.sendTip(
          [streamer.account.address, "Anon", "Test"],
          { value: 0n, account: viewer.account } 
        ),
        (err: any) => err.message.includes("Value tip must be greater than zero")
      );
    });

    it("Tip failed if address invalid", async function () {
      const { crypTip, viewer } = await networkHelpers.loadFixture(deployCrypTipFixture);

      await assert.rejects(
        crypTip.write.sendTip(
          [zeroAddress, "Anon", "Test"],
          { value: parseEther("1"), account: viewer.account }
        ),
        (err: any) => err.message.includes("Address is not valid")
      );
    });

    it("Must divide funds properly (95% Streamer, 5% Platform)", async function () {
      const { crypTip, owner, streamer, viewer } = await networkHelpers.loadFixture(deployCrypTipFixture);

      const tipAmount = 100n;
      await crypTip.write.sendTip(
        [streamer.account.address, "Budi", "Semangat!"],
        { value: tipAmount, account: viewer.account }
      );

      const streamerBalance = await crypTip.read.balances([streamer.account.address]);
      const ownerBalance = await crypTip.read.balances([owner.account.address]);

      assert.equal(streamerBalance, 95n, "Streamer should receive 95 wei");
      assert.equal(ownerBalance, 5n, "Owner should receive 5 wei");
    });

    it("Should be able to update totalEarned & totalTipped correctly.", async function () {
      const { crypTip, streamer, viewer } = await networkHelpers.loadFixture(deployCrypTipFixture);

      const tipAmount = parseEther("1");
      await crypTip.write.sendTip(
        [streamer.account.address, "Budi", "Bro!"],
        { value: tipAmount, account: viewer.account }
      );

      const stats = await crypTip.read.getStreamerStats([streamer.account.address]);
      const expectedEarned = parseEther("0.95");
      assert.equal(stats[1], expectedEarned, "Streamer's total earned is inaccurate");

      const viewerTipped = await crypTip.read.totalTipped([viewer.account.address]);
      assert.equal(viewerTipped, tipAmount, "Total tipped viewers are not accurate");
    });
  });

  describe("Function Withdraw Validation", async function () {
    it("Must revert if streamer has no balance", async function () {
      const { crypTip, streamer } = await networkHelpers.loadFixture(deployCrypTipFixture);

      await assert.rejects(
        crypTip.write.withdraw({ account: streamer.account }), 
        (err: any) => err.message.includes("No Balances to Withdraw")
      );
    });

    it("Must successfully withdraw funds and reset balances to 0", async function () {
      const { crypTip, streamer, viewer, publicClient } = await networkHelpers.loadFixture(deployCrypTipFixture);

      await crypTip.write.sendTip(
        [streamer.account.address, "Anon", "Halo"],
        { value: parseEther("1"), account: viewer.account }
      );

      const initialEthBalance = await publicClient.getBalance({ address: streamer.account.address });

      const txHash = await crypTip.write.withdraw({ account: streamer.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;
      const finalEthBalance = await publicClient.getBalance({ address: streamer.account.address });
      
      const expectedBalance = initialEthBalance + parseEther("0.95") - gasUsed;

      assert.equal(finalEthBalance, expectedBalance, "ETH balance in wallet does not match after withdrawal");

      const contractBalance = await crypTip.read.balances([streamer.account.address]);
      assert.equal(contractBalance, 0n, "Balance in contract must be 0 after withdrawal");
    });
  });

  describe("Function setFee validation", async function () {
    it("Must revert if the one who changes the fee is NOT the owner", async function () {
      const { crypTip, viewer } = await networkHelpers.loadFixture(deployCrypTipFixture);

      await assert.rejects(
        crypTip.write.setFeePercentage([10n], { account: viewer.account }), 
        (err: any) => err.message.includes("OwnableUnauthorizedAccount") || err.message.includes("Ownable")
      );
    });

    it("Must fail if owner sets fee more than 20%", async function () {
      const { crypTip, owner } = await networkHelpers.loadFixture(deployCrypTipFixture);

      await assert.rejects(
        crypTip.write.setFeePercentage([21n], { account: owner.account }),
        (err: any) => err.message.includes("Maximum is 20%")
      );
    });

    it("It should be successful if the owner sets the fee less than 20%.", async function () {
      const { crypTip, owner } = await networkHelpers.loadFixture(deployCrypTipFixture);

      await crypTip.write.setFeePercentage([10n], { account: owner.account });
      const newFee = await crypTip.read.platformFeePercentage();
      assert.equal(newFee, 10n, "update fee is failed");
    });
  });
});