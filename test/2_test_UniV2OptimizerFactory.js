/**
 *  Dependencies
 */
 const { expect } = require("chai");
 const { ethers } = require("hardhat");
 const truffleAssert = require('truffle-assertions');

describe("UniV2OptimizerFactory Unit Tests", function () {

    /* ABIs */
    const StakingAbi = require("./external_abi/Staking.json");
    const RewardAbi = require("./external_abi/Reward.json");
    const TokenAAbi = require("./external_abi/TokenA.json");
    const TokenBAbi = require("./external_abi/TokenB.json");
    const TokenCAbi = require("./external_abi/TokenC.json");
    const StakingRewardAbi = require("./external_abi/StakingReward.json");
    const UniswapV2RouterAbi = require("./external_abi/ComethRouter.json");
    const UniV2OptimizerAbi = require("./external_abi/UniV2Optimizer.json");

    /* Adresses */
    // WMATIC-MUST LP
    const StakingAddress = "0x80676b414a905De269D0ac593322Af821b683B92";

    // MUST
    const RewardAddress =  "0x9C78EE466D6Cb57A4d01Fd887D2b5dFb2D46288f";

    // WMATIC
    const TokenAAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";

    // MUST
    const TokenBAddress = "0x9C78EE466D6Cb57A4d01Fd887D2b5dFb2D46288f";

    // WETH
    const TokenCAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";

    // ComethSwap WMATIC-MUST LP Staking Pool
    const StakingRewardAddress = "0x2328c83431a29613b1780706E0Af3679E3D04afd";

    // ComethSwap Router
    const UniswapV2RouterAddress = "0x93bcDc45f7e62f89a8e901DC4A0E2c6C427D9F25";


    /* Provider */
    const provider = new ethers.providers.JsonRpcProvider();

    // Instantiating the existing mainnet fork contracts
    staking = new ethers.Contract(StakingAddress, StakingAbi, provider);
    reward = new ethers.Contract(RewardAddress, RewardAbi, provider);
    tokenA = new ethers.Contract(TokenAAddress, TokenAAbi, provider);
    tokenB = new ethers.Contract(TokenBAddress, TokenBAbi, provider);
    tokenC = new ethers.Contract(TokenCAddress, TokenCAbi, provider);
    stakingReward = new ethers.Contract(StakingRewardAddress, StakingRewardAbi, provider);
    uniV2Router = new ethers.Contract(UniswapV2RouterAddress, UniswapV2RouterAbi, provider);
 
    let UniV2OptimizerFactory;
    let uniV2OptimizerFactory;

    before(async () => {
        [owner, addr1, _] = await ethers.getSigners(); 
        
        // Deploying the contract under test
        UniV2OptimizerFactory = await ethers.getContractFactory("UniV2OptimizerFactory");
        uniV2OptimizerFactory = await UniV2OptimizerFactory.connect(owner).deploy();
    });

    it("should add a new strategy to the UniV2Optimizer Factory ", async () => {
        await uniV2OptimizerFactory.addStrategy(
            tokenA.address,
            tokenB.address,
            staking.address,
            reward.address,
            stakingReward.address,
            uniV2Router.address
        );
        const newStrategy = await uniV2OptimizerFactory.strategies(0);

        expect(newStrategy.poolId).to.equal(0);   
        expect(newStrategy.tokenA).to.equal(tokenA.address);
        expect(newStrategy.tokenB).to.equal(tokenB.address);
        expect(newStrategy.staking).to.equal(staking.address);
        expect(newStrategy.reward).to.equal(reward.address);
        expect(newStrategy.stakingRewardAddr).to.equal(stakingReward.address);
        expect(newStrategy.uniV2RouterAddr).to.equal(uniV2Router.address);    
    });

    it("should be the owner of the newly created optimizer", async () => {
        const factoryOptimizerAddr = await uniV2OptimizerFactory.getFactoryOptimizerByStrategyID(0);
        factoryOptimizer = new ethers.Contract(factoryOptimizerAddr, UniV2OptimizerAbi, provider);
        const factoryOptimizerOwner = await factoryOptimizer.owner();
        expect(factoryOptimizerOwner).to.equal(uniV2OptimizerFactory.address)
    });
    
    it("should get the number of strategy supported", async () => {
        await uniV2OptimizerFactory.addStrategy(
            tokenB.address,
            tokenA.address,
            staking.address,
            reward.address,
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
