/**
 *  Dependencies
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const truffleAssert = require('truffle-assertions');

describe("UniV2Optimizer Unit Tests", function () {  
    
    /* ABIs */
    const StakingAbi = require("./external_abi/Staking.json");
    const RewardAbi = require("./external_abi/Reward.json");
    const TokenAAbi = require("./external_abi/TokenA.json");
    const TokenBAbi = require("./external_abi/TokenB.json");
    const TokenCAbi = require("./external_abi/TokenC.json");
    const StakingRewardAbi = require("./external_abi/StakingReward.json");
    const UniswapV2RouterAbi = require("./external_abi/Router.json");

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
 
    let UniV2Optimizer;
    let uniV2Optimizer;

    before(async function () {

        // WETH Whale           : 0xd3d176F7e4b43C70a68466949F6C64F06Ce75BB9
        // LP Whale             : 0xdA8479E5b8A273A403148a779Fbb8903DC2C739d
        // WMATIC Whale         : 0x84D34f4f83a87596Cd3FB6887cFf8F17Bf5A7B83

        // Impersonating a whale address to provision the owner account with necessary tokens
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

        [owner, nonOwner, _] = await ethers.getSigners();   

        // Deploying the contract under test
        UniV2Optimizer = await ethers.getContractFactory("UniV2Optimizer");
        uniV2Optimizer = await UniV2Optimizer.connect(owner).deploy(
            tokenA.address,
            tokenB.address,
            staking.address,
            reward.address,
            stakingReward.address,
            uniV2Router.address
        );
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
        await truffleAssert.reverts(uniV2Optimizer.withdraw(weiAmountToWithdraw));
    });
  
    
    it("should compound the Reward into more staked LP token", async () => {
       
        // Checking the balances before the compounding operation
        const poolBalBefore = ethers.utils.formatEther(await staking.balanceOf(stakingReward.address));

        // Compounding operation
        await uniV2Optimizer.harvest();

        // Checking the balances after the compounding operation
        const poolBalAfter = ethers.utils.formatEther(await staking.balanceOf(stakingReward.address));

        // Assertion : Staking Pool Balance After > Staking Pool Balance Before
        expect(poolBalBefore < poolBalAfter).to.equal(true);
    });

    it("should withdraw 10 LP tokens from the Staking Reward Pool", async () => {
        
        // Quantity to withdraw for this test
        const amountToWithdraw = 10;
        const weiAmountToWithdraw = ethers.utils.parseEther(amountToWithdraw.toString());

        // Checking the balances before the withdrawal operation
        const userBalBefore = await staking.balanceOf(owner.address);
        const poolBalBefore = await staking.balanceOf(stakingReward.address);

        // Withdraw operation
        await uniV2Optimizer.withdraw(weiAmountToWithdraw);

        // Checking the balances after the withdrawal operation
        const userBalAfter = await staking.balanceOf(owner.address);
        const poolBalAfter = await staking.balanceOf(stakingReward.address);
       
        // Assertion #1 : User Balance After - User Balance Before = Withdraw Amount
        expect(userBalAfter.sub(userBalBefore)).to.equal(weiAmountToWithdraw);

        // Assertion #2 : Staking Pool Balance Before - Withdraw Amount = Staking Pool Balance After
        expect(poolBalBefore.sub(weiAmountToWithdraw)).to.equal(poolBalAfter);
    });

    it("should withdraw all Staking and Reward tokens form the Staking Reward Pool", async () => {

        // Checking the balances before the withdrawal operation
        const userLPBalBefore = await staking.balanceOf(owner.address);
        const userRewardBalBefore = await reward.balanceOf(owner.address);
        const poolBalBefore = await staking.balanceOf(stakingReward.address);

        // Exit Avalanche operation
        await uniV2Optimizer.exitAvalanche();

        // Checking the balances after the withdrawal operation
        const userLPBalAfter = await staking.balanceOf(owner.address);
        const userRewardBalAfter = await reward.balanceOf(owner.address);
        const poolBalAfter = await staking.balanceOf(stakingReward.address);

        // Assertion #1 : User LP Balance After > User LP Balance Before
        expect(userLPBalAfter > userLPBalBefore).to.equal(true);
       
        // Assertion #2 : User Reward Balance After > User Reward Balance Before
        expect(userRewardBalAfter > userRewardBalBefore).to.equal(true);
        
        // Assertion #3 : Staking Pool Balance Before > Staking Pool Balance After
        expect(poolBalBefore > poolBalAfter).to.equal(true);
    });

    it("should recover the lost / airdropped TokenC from the UniV2Optimizer contract", async () => {

        const amountToTransfer = 10;
        const weiAmountToTransfer = ethers.utils.parseEther(amountToTransfer.toString());
        await tokenC.connect(whaleWETH).transfer(uniV2Optimizer.address, weiAmountToTransfer);

        // Checking the balances before the recovery operation
        const optiTokenCBalBefore = await tokenC.balanceOf(uniV2Optimizer.address);
        const userTokenCBalBefore = await tokenC.balanceOf(owner.address);

        // ERC20 Recovery Operation
        await uniV2Optimizer.recoverERC20(tokenC.address);

        // Checking the balances after the recovery operation
        const optiTokenCBalAfter = await tokenC.balanceOf(uniV2Optimizer.address);
        const userTokenCBalAfter = await tokenC.balanceOf(owner.address);

        // Assertion #1 : Optimizer Token C Balance Before > Optimizer Token C Balance After
        expect(optiTokenCBalBefore > optiTokenCBalAfter).to.equal(true);
        
        // Assertion #2 : User Token C Balance Before < User Token C Balance After
        expect(userTokenCBalBefore < userTokenCBalAfter).to.equal(true);
        
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

    it("should zap the desired amount of Token C to LP Tokens", async () => { 
       
        const amountToZap = 10;
        const weiAmountToZap = ethers.utils.parseEther(amountToZap.toString());

        await tokenC.connect(whaleWETH).transfer(owner.address, weiAmountToZap);

        const poolBalBefore = await staking.balanceOf(stakingReward.address);
        const userTokenCBalBefore = await tokenC.balanceOf(owner.address);

        // Approving the 10 Tokens C to be spent by the UniV2Optimizer
        await tokenC.connect(owner).approve(uniV2Optimizer.address, weiAmountToZap);
        // Staking the 10 LP tokens on the UniV2Optimizer
        await uniV2Optimizer.connect(owner).zap(tokenC.address, weiAmountToZap);

        const poolBalAfter = await staking.balanceOf(stakingReward.address);
        const userTokenCBalAfter = await tokenC.balanceOf(owner.address);

        expect(poolBalAfter > poolBalBefore).to.equal(true);
        expect(userTokenCBalBefore > userTokenCBalAfter).to.equal(true);

    });
});

