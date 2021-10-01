/* Dependencies */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const truffleAssert = require('truffle-assertions');
const fs = require('fs');

// Alchemy Key required for hardhat mainnet fork
const polygonAlchemyKey = fs.readFileSync("secretPolygon").toString().trim();

describe("Treasury Unit Tests", function () {  

    /* ABIs */
    const StakingAbi = require("./external_abi/Staking.json");
    const StakingRewardAbi = require("./external_abi/StakingReward.json");
    const UniswapV2RouterAbi = require("./external_abi/ComethRouter.json");
    const UniV2OptimizerAbi = require("./external_abi/UniV2Optimizer.json");


    /* Adresses */
    // WMATIC-MUST LP
    const StakingAddress = "0x80676b414a905De269D0ac593322Af821b683B92";

    // ComethSwap WMATIC-MUST LP Staking Pool
    const StakingRewardAddress = "0x2328c83431a29613b1780706E0Af3679E3D04afd";

    // ComethSwap WETH-MUST LP Staking Pool
    const StakingReward2Address = "0x2cc6a7A06B32E0796D8f9225E2e33ae51C93d715";

    // ComethSwap Router
    const UniswapV2RouterAddress = "0x93bcDc45f7e62f89a8e901DC4A0E2c6C427D9F25";

    /* Provider */
    const provider = new ethers.providers.JsonRpcProvider();

    // Instantiating the existing mainnet fork contracts
    stakingReward = new ethers.Contract(StakingRewardAddress, StakingRewardAbi, provider);
    stakingReward2 = new ethers.Contract(StakingReward2Address, StakingRewardAbi, provider);
    uniV2Router = new ethers.Contract(UniswapV2RouterAddress, UniswapV2RouterAbi, provider);
    staking = new ethers.Contract(StakingAddress, StakingAbi, provider);


    let Treasury;
    let treasury;

    before(async function () {
        [owner, nonOwner, _] = await ethers.getSigners();   

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

        // Impersonating whale addresses to provision the nonOwner account with necessary tokens
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0xdA8479E5b8A273A403148a779Fbb8903DC2C739d"],
          });
        whaleLP = await ethers.getSigner("0xdA8479E5b8A273A403148a779Fbb8903DC2C739d");    
        
        // Deploying the contract under test
        Treasury = await ethers.getContractFactory("Treasury");
        treasury = await Treasury.connect(owner).deploy();
        
        AmmZapFactory = await ethers.getContractFactory("AmmZapFactory");
        ammZapFactory = await AmmZapFactory.connect(owner).deploy();
        await ammZapFactory.connect(owner).createAmmZap(uniV2Router.address);


        UniV2OptimizerFactory = await ethers.getContractFactory("UniV2OptimizerFactory");
        uniV2OptimizerFactory = await UniV2OptimizerFactory.connect(owner).deploy(
            treasury.address,
            ammZapFactory.address
        );

    });

    it("should create a new UniV2 Strategy", async () => {
        await treasury.connect(owner).createUniV2Strategy(
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
            treasury.connect(nonOwner).createUniV2Strategy(
                uniV2OptimizerFactory.address,
                stakingReward.address,
                uniV2Router.address
            )
        );
    });

    it("should do some operation before the next test case", async () => {
                
        // Below steps simulate an user creating an Optimizer and interacting with it (to generate protocol fees)
        await uniV2OptimizerFactory.connect(nonOwner).createUniV2Optimizer(0);
        const uniV2OptimizerAddr = await uniV2OptimizerFactory.uniV2Optimizers(1);
        uniV2Optimizer = new ethers.Contract(uniV2OptimizerAddr, UniV2OptimizerAbi, provider); 
        const amountToTransfer = 100;
        const weiAmountToTransfer = ethers.utils.parseEther(amountToTransfer.toString());
        await staking.connect(whaleLP).transfer(nonOwner.address, weiAmountToTransfer);
        await staking.connect(nonOwner).approve(uniV2OptimizerAddr, weiAmountToTransfer);
        await uniV2Optimizer.connect(nonOwner).stake(weiAmountToTransfer);
        await network.provider.send("evm_mine");
        await uniV2Optimizer.connect(nonOwner).harvest();
    });

    it("should retire a FeeCollector optimizer and reinvest into another FeeCollector", async () => {


        // Create a second strategy (to create a new FeeCollector that will be used for the reinvestment)
        await treasury.connect(owner).createUniV2Strategy(
            uniV2OptimizerFactory.address,
            stakingReward2.address,
            uniV2Router.address
        );

        // Get the addresses of the FeeCollectors to retire and to reinvest into.
        const feeCollectorToRetireAddr = await uniV2OptimizerFactory.feeCollectors(0);
        const feeCollectorToReinvestAddr = await uniV2OptimizerFactory.feeCollectors(1);

        feeCollectorToRetire = new ethers.Contract(feeCollectorToRetireAddr, UniV2OptimizerAbi, provider);
        feeCollectorToReinvest = new ethers.Contract(feeCollectorToReinvestAddr, UniV2OptimizerAbi, provider);

        const fcToRetireBalBefore = await feeCollectorToRetire.staked();
        const fcToReinvestBalBefore = await feeCollectorToReinvest.staked();

        // Retirement Operation
        await treasury.retireFeeCollector(feeCollectorToRetireAddr, feeCollectorToReinvestAddr);

        const fcToRetireBalAfter = await feeCollectorToRetire.staked();
        const fcToReinvestBalAfter = await feeCollectorToReinvest.staked();

        const retirementStatus = await treasury.retirementStatus(feeCollectorToRetireAddr);

        expect(retirementStatus).to.equal(true);    
        expect(fcToRetireBalBefore > fcToRetireBalAfter).to.equal(true);    
        expect(fcToReinvestBalBefore < fcToReinvestBalAfter).to.equal(true);    
        
    });

});

