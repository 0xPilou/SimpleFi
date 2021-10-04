/**
 *  Dependencies
 */
 const { expect } = require("chai");
 const { ethers } = require("hardhat");
 const truffleAssert = require('truffle-assertions');
 const fs = require('fs');

 const polygonAlchemyKey = fs.readFileSync("secretPolygon").toString().trim();

describe("BeefyOptimizerFactory Unit Tests", function () {

    /* ABIs */
    const BeefyVaultAbi = require("./external_abi/BeefyVault.json");
    const BeefyOptimizerAbi = require("./external_abi/BeefyOptimizer.json");

    /* Adresses */

    // ComethSwap WMATIC-MUST LP Staking Pool
    const BeefyVaultAddress = "0xE87151D8dd8695e3e69e8B2f0eB8cf79BD2227d1";

    /* Provider */
    const provider = new ethers.providers.JsonRpcProvider();

    // Instantiating the existing mainnet fork contracts
    beefyVault = new ethers.Contract(BeefyVaultAddress, BeefyVaultAbi, provider);
 
    let BeefyOptimizerFactory;
    let beefyOptimizerFactory;

    before(async () => {

        // Resetting the Hardhat Mainnet Fork Network to block 19146010
        await network.provider.request({
            method: "hardhat_reset",
            params: [
              {
                forking: {
                  jsonRpcUrl: `${polygonAlchemyKey}`,
                  blockNumber: 19797693
                },
              },
            ],
        });

        [owner, addr1, _] = await ethers.getSigners(); 

        Treasury = await ethers.getContractFactory("Treasury");
        treasury = await Treasury.connect(owner).deploy();

        // Deploying the contract under test
        BeefyOptimizerFactory = await ethers.getContractFactory("BeefyOptimizerFactory");
        beefyOptimizerFactory = await BeefyOptimizerFactory.connect(owner).deploy(
            treasury.address
        );
    });

    it("should add a new strategy to the UniV2Optimizer Factory ", async () => {
        await treasury.connect(owner).createBeefyStrategy(
            beefyOptimizerFactory.address,
            beefyVault.address,
        );
        const newStrategy = await beefyOptimizerFactory.strategies(0);

        expect(newStrategy.poolId).to.equal(0);   
        expect(newStrategy.beefyVaultAddr).to.equal(beefyVault.address);
    });

    it("should not be able to add a new strategy (not Treasury Contract) ", async () => {
        await truffleAssert.reverts(beefyOptimizerFactory.connect(addr1).addStrategy(beefyVault.address));
        await truffleAssert.reverts(beefyOptimizerFactory.connect(owner).addStrategy(beefyVault.address));
    });

    it("should be the owner of the newly created optimizer", async () => {
        const feeCollectorAddr = await beefyOptimizerFactory.getFeeCollectorByStrategyID(0);
        feeCollector = new ethers.Contract(feeCollectorAddr, BeefyOptimizerAbi, provider);
        const feeCollectorOwner = await feeCollector.owner();
        expect(feeCollectorOwner).to.equal(treasury.address)
    });
    
    it("should get the number of strategy supported", async () => {
        await treasury.connect(owner).createBeefyStrategy(
            beefyOptimizerFactory.address,
            beefyVault.address
        );
        const numOfStrategy = (await beefyOptimizerFactory.getStrategyCount()).toNumber();
        expect(numOfStrategy).to.equal(2);
    });

    it("should get the correct number of Optimizer(s) created", async () => {
        const numOfOptimizer = (await beefyOptimizerFactory.getOptimizerCount()).toNumber();
        expect(numOfOptimizer).to.equal(2);

        await beefyOptimizerFactory.connect(addr1).createBeefyOptimizer(0);

        const newNumOfOptimizer = (await beefyOptimizerFactory.getOptimizerCount()).toNumber();
        expect(newNumOfOptimizer).to.equal(3);
    });

    it("should not be able to create an optimizer with a non-existant Strategy", async () => {

        const numOfStrategy = (await beefyOptimizerFactory.getStrategyCount()).toNumber();

        await truffleAssert.reverts(beefyOptimizerFactory.connect(addr1).createBeefyOptimizer(numOfStrategy));
    });
});
