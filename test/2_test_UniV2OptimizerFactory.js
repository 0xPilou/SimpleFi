/**
 *  Dependencies
 */
 const { expect } = require("chai");
 const { ethers } = require("hardhat");
 const truffleAssert = require('truffle-assertions');

describe("UniV2OptimizerFactory Unit Tests", function () {

    /* ABIs */
    const StakingRewardAbi = require("./external_abi/StakingReward.json");
    const UniswapV2RouterAbi = require("./external_abi/ComethRouter.json");
    const UniV2OptimizerAbi = require("./external_abi/UniV2Optimizer.json");

    /* Adresses */

    // ComethSwap WMATIC-MUST LP Staking Pool
    const StakingRewardAddress = "0x2328c83431a29613b1780706E0Af3679E3D04afd";

    // ComethSwap Router
    const UniswapV2RouterAddress = "0x93bcDc45f7e62f89a8e901DC4A0E2c6C427D9F25";


    /* Provider */
    const provider = new ethers.providers.JsonRpcProvider();

    // Instantiating the existing mainnet fork contracts
    stakingReward = new ethers.Contract(StakingRewardAddress, StakingRewardAbi, provider);
    uniV2Router = new ethers.Contract(UniswapV2RouterAddress, UniswapV2RouterAbi, provider);
 
    let UniV2OptimizerFactory;
    let uniV2OptimizerFactory;

    let AmmZapFactory;
    let ammZapFactory;

    before(async () => {
        [owner, addr1, _] = await ethers.getSigners(); 

        FeeManager = await ethers.getContractFactory("FeeManager");
        feeManager = await FeeManager.connect(owner).deploy();
        
        AmmZapFactory = await ethers.getContractFactory("AmmZapFactory");
        ammZapFactory = await AmmZapFactory.connect(owner).deploy();

        // Deploying the contract under test
        UniV2OptimizerFactory = await ethers.getContractFactory("UniV2OptimizerFactory");
        uniV2OptimizerFactory = await UniV2OptimizerFactory.connect(owner).deploy(
            feeManager.address,
            ammZapFactory.address
        );
    });

    it("should add a new strategy to the UniV2Optimizer Factory ", async () => {
        await feeManager.connect(owner).createStrategy(
            uniV2OptimizerFactory.address,
            stakingReward.address,
            uniV2Router.address
        );
        const newStrategy = await uniV2OptimizerFactory.strategies(0);

        expect(newStrategy.poolId).to.equal(0);   
        expect(newStrategy.stakingRewardAddr).to.equal(stakingReward.address);
        expect(newStrategy.uniV2RouterAddr).to.equal(uniV2Router.address);    
    });

    it("should not be able to add a new strategy (not FeeManager Contract) ", async () => {
        await truffleAssert.reverts(uniV2OptimizerFactory.connect(addr1).addStrategy(stakingReward.address, uniV2Router.address));
        await truffleAssert.reverts(uniV2OptimizerFactory.connect(owner).addStrategy(stakingReward.address, uniV2Router.address));
    });

    it("should be the owner of the newly created optimizer", async () => {
        const feeCollectorAddr = await uniV2OptimizerFactory.getFeeCollectorByStrategyID(0);
        feeCollector = new ethers.Contract(feeCollectorAddr, UniV2OptimizerAbi, provider);
        const feeCollectorOwner = await feeCollector.owner();
        expect(feeCollectorOwner).to.equal(feeManager.address)
    });
    
    it("should get the number of strategy supported", async () => {
        await feeManager.connect(owner).createStrategy(
            uniV2OptimizerFactory.address,
            stakingReward.address,
            uniV2Router.address
        );
        const numOfStrategy = (await uniV2OptimizerFactory.getStrategyCount()).toNumber();
        expect(numOfStrategy).to.equal(2);
    });

    it("should get the correct number of Optimizer(s) created", async () => {
        const numOfOptimizer = (await uniV2OptimizerFactory.getOptimizerCount()).toNumber();
        expect(numOfOptimizer).to.equal(2);

        await uniV2OptimizerFactory.connect(addr1).createUniV2Optimizer(0);

        const newNumOfOptimizer = (await uniV2OptimizerFactory.getOptimizerCount()).toNumber();
        expect(newNumOfOptimizer).to.equal(3);
    });

    it("should not be able to create an optimizer with a non-existant Strategy", async () => {

        const numOfStrategy = (await uniV2OptimizerFactory.getStrategyCount()).toNumber();

        await truffleAssert.reverts(uniV2OptimizerFactory.connect(addr1).createUniV2Optimizer(numOfStrategy));
    });
});
