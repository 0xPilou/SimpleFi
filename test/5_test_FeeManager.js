/* Dependencies */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const truffleAssert = require('truffle-assertions');
const fs = require('fs');

// Alchemy Key required for hardhat mainnet fork
const polygonAlchemyKey = fs.readFileSync("secretPolygon").toString().trim();

describe("FeeManager Unit Tests", function () {  

    /* ABIs */
    const StakingRewardAbi = require("./external_abi/StakingReward.json");
    const UniswapV2RouterAbi = require("./external_abi/ComethRouter.json");

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

    let FeeManager;
    let feeManager;

    before(async function () {

        // Resetting the Hardhat Mainnet Fork Network to block 19146010
        await network.provider.request({
            method: "hardhat_reset",
            params: [
              {
                forking: {
                  jsonRpcUrl: `${polygonAlchemyKey}`,
                  blockNumber: 19146010
                },
              },
            ],
        });
       
        [owner, nonOwner, _] = await ethers.getSigners();   
        
        // Deploying the contract under test
        FeeManager = await ethers.getContractFactory("FeeManager");
        feeManager = await FeeManager.connect(owner).deploy();
        
        AmmZapFactory = await ethers.getContractFactory("AmmZapFactory");
        ammZapFactory = await AmmZapFactory.connect(owner).deploy();

        UniV2OptimizerFactory = await ethers.getContractFactory("UniV2OptimizerFactory");
        uniV2OptimizerFactory = await UniV2OptimizerFactory.connect(owner).deploy(
            feeManager.address,
            ammZapFactory.address
        );

    });

    it("should create a new UniV2 Strategy", async () => {
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

    it("should not be able to create a new UniV2 Strategy (as a non-owner)", async () => {
        await truffleAssert.reverts(
            feeManager.connect(nonOwner).createStrategy(
                uniV2OptimizerFactory.address,
                stakingReward.address,
                uniV2Router.address
            )
        );
    });
});

