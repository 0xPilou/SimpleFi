/**
 *  Dependencies
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const truffleAssert = require('truffle-assertions');
const fs = require('fs');

const polygonAlchemyKey = fs.readFileSync("secretPolygon").toString().trim();

describe("UniV2Optimizer Unit Tests", function () {  
    
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
 
    let uniV2Optimizer;

    let UniV2OptimizerFactory;
    let uniV2OptimizerFactory;

    let feeManger;
    let Treasury;

    let AmmZap;
    let ammZap;

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

        // WETH Whale           : 0xd3d176F7e4b43C70a68466949F6C64F06Ce75BB9
        // LP Whale             : 0xdA8479E5b8A273A403148a779Fbb8903DC2C739d
        // WMATIC Whale         : 0x84D34f4f83a87596Cd3FB6887cFf8F17Bf5A7B83

        // Impersonating whale addresses to provision the owner account with necessary tokens
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0xdA8479E5b8A273A403148a779Fbb8903DC2C739d"],
          });
        whaleLP = await ethers.getSigner("0xdA8479E5b8A273A403148a779Fbb8903DC2C739d");
        
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0xd3d176F7e4b43C70a68466949F6C64F06Ce75BB9"],
          });
        whaleWETH = await ethers.getSigner("0xd3d176F7e4b43C70a68466949F6C64F06Ce75BB9");   

        // Define the signers required for the tests
        [owner, dividendRecipient, nonOwner, _] = await ethers.getSigners();   

        // Deploy AmmZapFactory
        AmmZapFactory = await ethers.getContractFactory("AmmZapFactory");
        ammZapFactory = await AmmZapFactory.connect(owner).deploy();
        await ammZapFactory.connect(owner).createAmmZap(uniV2Router.address);

        Treasury = await ethers.getContractFactory("Treasury");
        treasury = await Treasury.connect(owner).deploy();


        // Deploy UniV2OptimizerFactory
        UniV2OptimizerFactory = await ethers.getContractFactory("UniV2OptimizerFactory");
        uniV2OptimizerFactory = await UniV2OptimizerFactory.connect(owner).deploy(
            treasury.address,
            ammZapFactory.address
        );

        // Add the strategy to be used for this test
        await treasury.createUniV2Strategy(
            uniV2OptimizerFactory.address,
            stakingReward.address,
            uniV2Router.address
        );

        // Create the UniV2Optimizer under test
        await uniV2OptimizerFactory.connect(owner).createUniV2Optimizer(0);

        // Get the address of the UniV2Optimizer under test
        const uniV2OptimizerAddr = await uniV2OptimizerFactory.uniV2Optimizers(1);
        const feeCollectorAddr = await uniV2OptimizerFactory.getFeeCollectorByStrategyID(0);

        uniV2Optimizer = new ethers.Contract(uniV2OptimizerAddr, UniV2OptimizerAbi, provider); 
        feeCollector = new ethers.Contract(feeCollectorAddr, UniV2OptimizerAbi, provider); 
    });

    // Mine an empty block in between each test case
    // This step ensures that the StakingReward contract accrues Reward in between test cases
    beforeEach(async function () {
        await network.provider.send("evm_mine");
    });

    it("should stake 10 LP tokens to the Staking Reward Pool", async () => {

        // Quantity to deposit for this test
        const amountToDeposit = 10;
        const weiAmountToDeposit = ethers.utils.parseEther(amountToDeposit.toString());

        // Transfering 10 LP tokens from a whale address to the UniV2Optimizer owner address
        await staking.connect(whaleLP).transfer(owner.address, weiAmountToDeposit);

        // Checking the balances before the staking operation
        const userBalBefore = await staking.balanceOf(owner.address);      
        const poolBalBefore = await staking.balanceOf(stakingReward.address);
        
        // Approving the 10 LP tokens to be spent by the UniV2Optimizer
        await staking.connect(owner).approve(uniV2Optimizer.address, weiAmountToDeposit);

        // Staking the 10 LP tokens on the UniV2Optimizer
        await uniV2Optimizer.connect(owner).stake(weiAmountToDeposit);
        
        // Checking the balances after the staking operation
        const userBalAfter = await staking.balanceOf(owner.address);      
        const poolBalAfter = await staking.balanceOf(stakingReward.address);      

        // Assertion #1 : Staking Pool Balance After = Staking Pool Balance Before + 10
        expect(poolBalAfter).to.equal(poolBalBefore.add(weiAmountToDeposit))

        // Assertion #2 : User Balance Before = User Balance Before - 10
        expect(userBalAfter).to.equal(userBalBefore.sub(weiAmountToDeposit))
    });
  
   it("should not be able to withdraw 20 LP token from the Staking Reward Pool", async () => { 
       
        // Quantity to withdraw for this test
        const amountToWithdraw = 20;
        const weiAmountToWithdraw = ethers.utils.parseEther(amountToWithdraw.toString());
        
        // Assertion : Transaction should revert as the owner staked balance is lower than the quantity withdrawn
        await truffleAssert.reverts(uniV2Optimizer.connect(owner).withdraw(weiAmountToWithdraw));
    });
  
    
    it("should compound the Reward into more staked LP token", async () => {
       
        // Checking the balances before the compounding operation
        const poolBalBefore = ethers.utils.formatEther(await staking.balanceOf(stakingReward.address));
        const feeBalBefore = await feeCollector.staked();
        const dividendBalBefore = ethers.utils.formatEther(await staking.balanceOf(dividendRecipient.address));

        // Compounding operation
        await uniV2Optimizer.connect(owner).harvest();

        // Checking the balances after the compounding operation
        const poolBalAfter = ethers.utils.formatEther(await staking.balanceOf(stakingReward.address));
        const feeBalAfter = await feeCollector.staked();
        const dividendBalAfter = ethers.utils.formatEther(await staking.balanceOf(dividendRecipient.address));


        // Assertion #1 : Staking Pool Balance Before < Staking Pool Balance After
        expect(poolBalBefore < poolBalAfter).to.equal(true);

        // Assertion #2 : Fee Collector Balance Before < Fee Collector Balance After
        expect(feeBalBefore < feeBalAfter).to.equal(true, "Fees not accrued");

        // Assertion #3 : Dividend Recipient Balance Before < Dividend Recipient Balance After
        expect(dividendBalBefore < dividendBalAfter).to.equal(true, "Dividends not accrued");
    });

    it("should return the quantity of pending reward to be claimed from the StakingReward contract", async () => {

        pendingReward = await uniV2Optimizer.connect(owner).getPendingRewards();

        // Assertion : Pending Reward should be greater than 0
        expect(pendingReward.toNumber() > 0).to.equal(true);
    });

    it("should withdraw 10 LP tokens from the Staking Reward Pool", async () => {
        
        // Quantity to withdraw for this test
        const amountToWithdraw = 10;
        const weiAmountToWithdraw = ethers.utils.parseEther(amountToWithdraw.toString());

        // Checking the balances before the withdrawal operation
        const userBalBefore = await staking.balanceOf(owner.address);
        const poolBalBefore = await staking.balanceOf(stakingReward.address);
        const feeBalBefore = await feeCollector.staked();
        const dividendBalBefore = ethers.utils.formatEther(await staking.balanceOf(dividendRecipient.address));

        // Withdraw operation
        await uniV2Optimizer.connect(owner).withdraw(weiAmountToWithdraw);

        // Checking the balances after the withdrawal operation
        const userBalAfter = await staking.balanceOf(owner.address);
        const poolBalAfter = await staking.balanceOf(stakingReward.address);
        const feeBalAfter = await feeCollector.staked();
        const dividendBalAfter = ethers.utils.formatEther(await staking.balanceOf(dividendRecipient.address));


        // Assertion #1 : User Balance After - User Balance Before = Withdraw Amount
        expect(userBalAfter.sub(userBalBefore)).to.equal(weiAmountToWithdraw, "User balance incorrect");

        // Assertion #2 : Staking Pool Balance Before > Staking Pool Balance After
        expect(poolBalBefore > poolBalAfter).to.equal(true, "Pool balance incorrect");

        // Assertion #3 : Fee Collector Balance Before < Fee Collector Balance After
        expect(feeBalBefore.toNumber() < feeBalAfter.toNumber()).to.equal(true, "Fees not accrued");

        // Assertion #4: Dividend Recipient Balance Before < Dividend Recipient Balance After
        expect(dividendBalBefore < dividendBalAfter).to.equal(true, "Dividends not accrued");
    });

    it("should withdraw all Staking and Reward tokens form the Staking Reward Pool", async () => {

        // Checking the balances before the withdrawal operation
        const userLPBalBefore = await staking.balanceOf(owner.address);
        const userRewardBalBefore = await reward.balanceOf(owner.address);
        const poolBalBefore = await staking.balanceOf(stakingReward.address);
        const feeBalBefore = await feeCollector.staked();
        const dividendBalBefore = ethers.utils.formatEther(await staking.balanceOf(dividendRecipient.address));

        // Exit Avalanche operation
        await uniV2Optimizer.connect(owner).exitAvalanche();

        // Checking the balances after the withdrawal operation
        const userLPBalAfter = await staking.balanceOf(owner.address);
        const userRewardBalAfter = await reward.balanceOf(owner.address);
        const poolBalAfter = await staking.balanceOf(stakingReward.address);
        const feeBalAfter = await feeCollector.staked();
        const dividendBalAfter = ethers.utils.formatEther(await staking.balanceOf(dividendRecipient.address));

        // Assertion #1 : User LP Balance After > User LP Balance Before
        expect(userLPBalAfter > userLPBalBefore).to.equal(true);
       
        // Assertion #2 : User Reward Balance After > User Reward Balance Before
        expect(userRewardBalAfter >= userRewardBalBefore).to.equal(true);
        
        // Assertion #3 : Staking Pool Balance Before > Staking Pool Balance After
        expect(poolBalBefore > poolBalAfter).to.equal(true);

        // Assertion #4 : Fee Collector Balance Before < Fee Collector Balance After
        expect(feeBalBefore < feeBalAfter).to.equal(true, "Fees not accrued");
        
        // Assertion #5: Dividend Recipient Balance Before < Dividend Recipient Balance After
        expect(dividendBalBefore < dividendBalAfter).to.equal(true, "Dividends not accrued");
    });

    it("should zap WETH into MUST-WMATIC LP and stake it to the Staking Reward Pool", async () => {
        // Quantity to zap and stake for this test
        const amountToZapAndStake = 10;
        const weiAmountToZapAndStake = ethers.utils.parseEther(amountToZapAndStake.toString());
        const ammZapAddr = await uniV2Optimizer.ammZapAddr();

        // Transfering 10 LP tokens from a whale address to the UniV2Optimizer owner address
        await tokenC.connect(whaleWETH).transfer(owner.address, weiAmountToZapAndStake);

        // Checking the balances before the zapping and staking operation
        const userWETHBalBefore = await tokenC.balanceOf(owner.address);      
        const poolBalBefore = await staking.balanceOf(stakingReward.address);
        
        // Approving the 10 LP tokens to be spent by the UniV2Optimizer
        await tokenC.connect(owner).approve(uniV2Optimizer.address, weiAmountToZapAndStake);

        // Staking the 10 LP tokens on the UniV2Optimizer
        await uniV2Optimizer.connect(owner).zapAndStake(tokenC.address, weiAmountToZapAndStake);
        
        // Checking the balances after the staking operation
        const userWETHBalAfter = await tokenC.balanceOf(owner.address);      
        const poolBalAfter = await staking.balanceOf(stakingReward.address);      

        // Assertion #1 : Staking Pool Balance After > Staking Pool Balance Before
        expect(poolBalAfter > poolBalBefore).to.equal(true)

        // Assertion #2 : User WETH Balance After = User WETH Balance Before - 10
        expect(userWETHBalAfter).to.equal(userWETHBalBefore.sub(weiAmountToZapAndStake))

    });

    it("should recover the lost / airdropped TokenC from the UniV2Optimizer contract", async () => {

        const amountToTransfer = 10;
        const weiAmountToTransfer = ethers.utils.parseEther(amountToTransfer.toString());
        await tokenC.connect(whaleWETH).transfer(uniV2Optimizer.address, weiAmountToTransfer);

        // Checking the balances before the recovery operation
        const optiTokenCBalBefore = await tokenC.balanceOf(uniV2Optimizer.address);
        const userTokenCBalBefore = await tokenC.balanceOf(owner.address);

        // ERC20 Recovery Operation
        await uniV2Optimizer.connect(owner).recoverERC20(tokenC.address);

        // Checking the balances after the recovery operation
        const optiTokenCBalAfter = await tokenC.balanceOf(uniV2Optimizer.address);
        const userTokenCBalAfter = await tokenC.balanceOf(owner.address);

        // Assertion #1 : Optimizer Token C Balance Before > Optimizer Token C Balance After
        expect(optiTokenCBalBefore > optiTokenCBalAfter).to.equal(true, "Optimizer Balance of WETH is incorrect");
        
        // Assertion #2 : User Token C Balance Before < User Token C Balance After
        expect(userTokenCBalBefore < userTokenCBalAfter).to.equal(true, "User Balance of WETH is incorrect");
        
    });

    it("should not be able to interact with the contract (as a non-owner)", async () => { 
       

        const amount = 10;
        const weiAmount = ethers.utils.parseEther(amount.toString());

        // Assertion : Transaction should revert as the caller is not the owner of the contract
        await truffleAssert.reverts(uniV2Optimizer.connect(nonOwner).stake(weiAmount));

        // Assertion : Transaction should revert as the caller is not the owner of the contract
        await truffleAssert.reverts(uniV2Optimizer.connect(nonOwner).withdraw(weiAmount));
        
        // Assertion : Transaction should revert as the caller is not the owner of the contract
        await truffleAssert.reverts(uniV2Optimizer.connect(nonOwner).harvest());

        // Assertion : Transaction should revert as the caller is not the owner of the contract
        await truffleAssert.reverts(uniV2Optimizer.connect(nonOwner).exitAvalanche());

        // Assertion : Transaction should revert as the caller is not the owner of the contract
        await truffleAssert.reverts(uniV2Optimizer.connect(nonOwner).recoverERC20(tokenC.address));
    });
});

