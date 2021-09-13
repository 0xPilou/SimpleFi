/**
 *  Dependencies
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const truffleAssert = require('truffle-assertions');
const fs = require('fs');

const alchemyApiKey = fs.readFileSync("./secret").toString().trim();
const provider = new ethers.providers.JsonRpcProvider(alchemyApiKey);

/**
 *  ABIs
*/
   
const StakingAbi = require("./external_abi/Staking.json");
const RewardAbi = require("./external_abi/Reward.json");
const TokenAAbi = require("./external_abi/TokenA.json");
const TokenBAbi = require("./external_abi/TokenB.json");
const TokenCAbi = require("./external_abi/TokenC.json");
const StakingRewardAbi = require("./external_abi/StakingReward.json");
const UniswapV2RouterAbi = require("./external_abi/Router.json");

/**
 *  Adresses
*/
const StakingAddress = "0x80676b414a905De269D0ac593322Af821b683B92";
const RewardAddress =  "0x9C78EE466D6Cb57A4d01Fd887D2b5dFb2D46288f";
const TokenAAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const TokenBAddress = "0x9C78EE466D6Cb57A4d01Fd887D2b5dFb2D46288f";
const TokenCAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const StakingRewardAddress = "0x2328c83431a29613b1780706E0Af3679E3D04afd";
const UniswapV2RouterAddress = "0x93bcDc45f7e62f89a8e901DC4A0E2c6C427D9F25";


describe("UniV2Optimizer Unit Tests", function () {  
 
    let UniV2OptimizerFactory = null;
    let uniV2OptimizerFactory = null;
    let staking = null;
    let reward = null;
    let tokenA = null;
    let tokenB = null;
    let tokenC = null;
    let stakingReward = null;
    let uniV2Router = null;
    let accounts = null;
    
    beforeEach(async function () {
        [owner, addr1, addr2, _] = await ethers.getSigners();

        staking = new ethers.Contract(StakingAddress, StakingAbi, provider);
        reward = new ethers.Contract(RewardAddress, RewardAbi, provider);
        tokenA = new ethers.Contract(TokenAAddress, TokenAAbi, provider);
        tokenB = new ethers.Contract(TokenBAddress, TokenBAbi, provider);
        tokenC = new ethers.Contract(TokenCAddress, TokenCAbi, provider);
        stakingReward = new ethers.Contract(StakingRewardAddress, StakingRewardAbi, provider);
        uniV2Router = new ethers.Contract(UniswapV2RouterAddress, UniswapV2RouterAbi, provider);


        UniV2Optimizer = await ethers.getContractFactory("UniV2Optimizer");
        uniV2Optimizer = await UniV2Optimizer.deploy(
            tokenA.address,
            tokenB.address,
            staking.address,
            reward.address,
            stakingReward.address,
            uniV2Router.address
        );
    });

    it("should stake 10 LP token to the Staking Reward Pool", async () => {
        const amountToDeposit = 10;
        const weiAmountToDeposit = ethers.utils.parseEther(amountToDeposit.toString());
        await staking.connect(owner).approve(uniV2Optimizer.address, weiAmountToDeposit);
        await uniV2Optimizer.stake(weiAmountToDeposit);
        const poolBal = ethers.utils.formatEther(await staking.balanceOf(stakingReward.address));      
        expect(poolBal).to.equal(10);

    });
  
   //it("should not be able to withdraw 20 LP token from the Staking Reward Pool", async () => {      
   //    const amountToWithdraw = 20;
   //    const weiAmountToWithdraw = ethers.utils.parseEther(amountToWithdraw.toString());        
   //    await truffleAssert.reverts(
   //        uniV2Optimizer.withdraw(weiAmountToWithdraw)
   //    );
   //});
  
    
    it("should compound the Reward into Staking", async () => {
       
        const poolLpBal_before = ethers.utils.formatEther(await staking.balanceOf(stakingReward.address));

        await uniV2Optimizer.harvest();
        const poolLpBal_after = ethers.utils.formatEther(await staking.balanceOf(stakingReward.address));
        expect(poolLpBal_before < poolLpBal_after).to.equal(true);

    });
    it("should withdraw 10 LP token from the Staking Reward Pool", async () => {
        const amountToWithdraw = 10;
        const weiAmountToWithdraw = ethers.utils.parseEther(amountToWithdraw.toString());

        const userLpBal_before = ethers.utils.formatEther(await staking.balanceOf(accounts[0]));
        const poolLpBal_before = ethers.utils.formatEther(await staking.balanceOf(stakingReward.address));

        await uniV2Optimizer.withdraw(weiAmountToWithdraw);

        const userLpBal_after = ethers.utils.formatEther(await staking.balanceOf(accounts[0]));
        const poolLpBal_after = ethers.utils.formatEther(await staking.balanceOf(stakingReward.address));
       
        expect(userLpBal_after - userLpBal_before).to.equal(amountToWithdraw);
        expect(poolLpBal_before - amountToWithdraw).to.equal(poolLpBal_after);


    });
    it("should withdraw all Staking and Reward tokens form the Staking Reward Pool", async () => {

        const userLpBal_before = ethers.utils.formatEther(await staking.balanceOf(accounts[0]));
        const poolLpBal_before = ethers.utils.formatEther(await staking.balanceOf(stakingReward.address));

        await uniV2Optimizer.exitAvalanche();

        const userLpBal_after = ethers.utils.formatEther(await staking.balanceOf(accounts[0]));
        const poolLpBal_after = ethers.utils.formatEther(await staking.balanceOf(stakingReward.address));

        expect(userLpBal_after > userLpBal_before).to.equal(true);
        expect(poolLpBal_before > poolLpBal_after).to.equal(true);
        
    });

    it("should recover a lost TokenC from the contract", async () => { 
        const poolTokenCBal_before = ethers.utils.formatEther(await tokenC.balanceOf(uniV2Optimizer.address));
        const userTokenCBal_before = ethers.utils.formatEther(await tokenC.balanceOf(accounts[0]));

        await uniV2Optimizer.recoverERC20(tokenC.address);

        const poolTokenCBal_after = ethers.utils.formatEther(await tokenC.balanceOf(uniV2Optimizer.address));
        const userTokenCBal_after = ethers.utils.formatEther(await tokenC.balanceOf(accounts[0]));

        expect(poolTokenCBal_before > poolTokenCBal_after).to.equal(true);
        expect(userTokenCBal_before < userTokenCBal_after).to.equal(true);
        
    });

});

