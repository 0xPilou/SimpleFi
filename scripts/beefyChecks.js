const { ethers } = require("hardhat");
const fs = require('fs');

const polygonAlchemyKey = fs.readFileSync("secretPolygon").toString().trim();

async function main() {

    await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: `${polygonAlchemyKey}`,
              blockNumber: 19876870
            },
          },
        ],
    });

    const provider = new ethers.providers.JsonRpcProvider();

    /* ABIs */
    const BeefyVaultAbi = require("../test/external_abi/BeefyVault.json");    

    /* Adresses */
    // Beefy Vault WETH-MUST
    const BeefyVaultAddress = "0x7CE2332fAF6328986C75e3A8fCc1CB79621aeB1F";

    const dummyAddress = "0x7380C1eD753AD1626Bf8F3d7d445F5525A2F773b";
     
    // Instantiating the existing mainnet fork contracts

    beefyVault = new ethers.Contract(BeefyVaultAddress, BeefyVaultAbi, provider);

    const mooBalanceWei = await beefyVault.balanceOf(dummyAddress)
    const pricePerShareWei = await beefyVault.getPricePerFullShare();

    const mooBalance = ethers.utils.formatEther(mooBalanceWei);
    const pricePerShare = ethers.utils.formatEther(pricePerShareWei);

    const currentBalance = mooBalance * pricePerShare;

    console.log("Balance of Moo token is :", mooBalance);
    console.log("Price Per Share :", pricePerShare)
    console.log("Current Balance :", currentBalance)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });