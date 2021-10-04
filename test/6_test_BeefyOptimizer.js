/**
 *  Dependencies
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const truffleAssert = require('truffle-assertions');
const fs = require('fs');

const polygonAlchemyKey = fs.readFileSync("secretPolygon").toString().trim();

describe("BeefyOptimizer Unit Tests", function () {  
     
    /* ABIs */
    const StakingAbi = require("./external_abi/Staking.json");
    const TokenCAbi = require("./external_abi/TokenC.json");
    const BeefyVaultAbi = require("./external_abi/BeefyVault.json");

    const BeefyOptimizerAbi = require("./external_abi/BeefyOptimizer.json");

    /* Adresses */
    // WETH-MUST LP
    const StakingAddress = "0x9f03309A588e33A239Bf49ed8D68b2D45C7A1F11";

    // WETH
    const TokenCAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";

    // Beefy Vault WETH-MUST
    const BeefyVaultAddress = "0xE87151D8dd8695e3e69e8B2f0eB8cf79BD2227d1";
 

    /* Provider */
    const provider = new ethers.providers.JsonRpcProvider();

    // Instantiating the existing mainnet fork contracts
    staking = new ethers.Contract(StakingAddress, StakingAbi, provider);
    tokenC = new ethers.Contract(TokenCAddress, TokenCAbi, provider);
    beefyVault = new ethers.Contract(BeefyVaultAddress, BeefyVaultAbi, provider);
 
    let beefyOptimizer;

    let BeefyOptimizerFactory;
    let beefyOptimizerFactory;

    let Treasury;

    before(async function () {

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

        // WETH Whale           : 0xd3d176F7e4b43C70a68466949F6C64F06Ce75BB9
        // LP Whale             : 0xdA8479E5b8A273A403148a779Fbb8903DC2C739d
        // WMATIC Whale         : 0x84D34f4f83a87596Cd3FB6887cFf8F17Bf5A7B83

        // Impersonating whale addresses to provision the owner account with necessary tokens
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0x26F2b78D1A78cf4c2427F05d3B156c48D6BC4Bcb"],
          });
        whaleLP = await ethers.getSigner("0x26F2b78D1A78cf4c2427F05d3B156c48D6BC4Bcb");
        
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0xd3d176F7e4b43C70a68466949F6C64F06Ce75BB9"],
          });
        whaleWETH = await ethers.getSigner("0xd3d176F7e4b43C70a68466949F6C64F06Ce75BB9");   

        // Define the signers required for the tests
        [owner, dividendRecipient, nonOwner, _] = await ethers.getSigners();   

        Treasury = await ethers.getContractFactory("Treasury");
        treasury = await Treasury.connect(owner).deploy();


        // Deploy BeefyOptimizerFactory
        BeefyOptimizerFactory = await ethers.getContractFactory("BeefyOptimizerFactory");
        beefyOptimizerFactory = await BeefyOptimizerFactory.connect(owner).deploy(
            treasury.address
        );

        // Add the strategy to be used for this test
        await treasury.createBeefyStrategy(
            beefyOptimizerFactory.address,
            beefyVault.address
        );

        // Create the UniV2Optimizer under test
        await beefyOptimizerFactory.connect(owner).createBeefyOptimizer(0);

        // Get the address of the UniV2Optimizer under test
        const beefyOptimizerAddr = await beefyOptimizerFactory.beefyOptimizers(1);
        const feeCollectorAddr = await beefyOptimizerFactory.getFeeCollectorByStrategyID(0);

        beefyOptimizer = new ethers.Contract(beefyOptimizerAddr, BeefyOptimizerAbi, provider); 
        feeCollector = new ethers.Contract(feeCollectorAddr, BeefyOptimizerAbi, provider); 
    });

    // Mine 5 empty blocks in between each test case
    // This step ensures that the BeefyVault contract accrues rewards in between test cases
    beforeEach(async function () {
        await network.provider.send("evm_mine");
        await network.provider.send("evm_mine");
        await network.provider.send("evm_mine");
        await network.provider.send("evm_mine");
        await network.provider.send("evm_mine");
    });

    it("should deposit 10 LP tokens into the Beefy Vault", async () => {

        // Quantity to deposit for this test
        const amountToDeposit = 10;
        const weiAmountToDeposit = ethers.utils.parseEther(amountToDeposit.toString());

        // Transfering 10 LP tokens from a whale address to the UniV2Optimizer owner address
        await staking.connect(whaleLP).transfer(owner.address, weiAmountToDeposit);

        // Checking the balances before the staking operation
        const userBalBefore = await staking.balanceOf(owner.address);      
        const poolBalBefore = await beefyVault.balance();
        
        // Approving the 10 LP tokens to be spent by the UniV2Optimizer
        await staking.connect(owner).approve(beefyOptimizer.address, weiAmountToDeposit);

        // Staking the 10 LP tokens on the UniV2Optimizer
        await beefyOptimizer.connect(owner).stake(weiAmountToDeposit);
        
        // Checking the balances after the staking operation
        const userBalAfter = await staking.balanceOf(owner.address);      
        const poolBalAfter = await beefyVault.balance();

        // Assertion #1 : Staking Pool Balance After = Staking Pool Balance Before + 10
        expect(poolBalAfter).to.equal(poolBalBefore.add(weiAmountToDeposit))

        // Assertion #2 : User Balance Before = User Balance Before - 10
        expect(userBalAfter).to.equal(userBalBefore.sub(weiAmountToDeposit))
    });
  
    it("should not be able to withdraw 20 LP token from the Beefy Vault", async () => { 
        
         // Quantity to withdraw for this test
         const amountToWithdraw = 20;
         const weiAmountToWithdraw = ethers.utils.parseEther(amountToWithdraw.toString());
         
         // Assertion : Transaction should revert as the owner staked balance is lower than the quantity withdrawn
         await truffleAssert.reverts(beefyOptimizer.connect(owner).withdraw(weiAmountToWithdraw));
     });

    it("should withdraw 5 LP tokens from the Beefy Vault", async () => {
         
        // Quantity to withdraw for this test
        const amountToWithdraw = 5;
        const weiAmountToWithdraw = ethers.utils.parseEther(amountToWithdraw.toString());
 
          // Checking the balances before the withdrawal operation
        const userBalBefore = await staking.balanceOf(owner.address);
        const poolBalBefore = await beefyVault.balance();
//        const feeBalBefore = await feeCollector.staked();
//        const dividendBalBefore = ethers.utils.formatEther(await staking.balanceOf(dividendRecipient.address));
 
          // Withdraw operation
        await beefyOptimizer.connect(owner).withdraw(weiAmountToWithdraw);
 
          // Checking the balances after the withdrawal operation
        const userBalAfter = await staking.balanceOf(owner.address);
        const poolBalAfter = await beefyVault.balance();
//        const feeBalAfter = await feeCollector.staked();
//        const dividendBalAfter = ethers.utils.formatEther(await staking.balanceOf(dividendRecipient.address));
 
        // Assertion #1 : User Balance After - User Balance Before = Withdraw Amount
        expect(userBalAfter > userBalBefore).to.equal(true, "User balance incorrect");
 
        // Assertion #2 : Staking Pool Balance Before > Staking Pool Balance After
        expect(poolBalBefore > poolBalAfter).to.equal(true, "Pool balance incorrect");
 
        // Assertion #3 : Fee Collector Balance Before < Fee Collector Balance After
        //expect(feeBalBefore.toNumber() < feeBalAfter.toNumber()).to.equal(true, "Fees not accrued");
 
        // Assertion #4: Dividend Recipient Balance Before < Dividend Recipient Balance After
        // expect(dividendBalBefore < dividendBalAfter).to.equal(true, "Dividends not accrued");
    });
 
    it("should withdraw all Staking tokens form the Beefy Vault", async () => {

        // Checking the balances before the withdrawal operation
        const userLPBalBefore = await staking.balanceOf(owner.address);
        const poolBalBefore = await beefyVault.balance();
//        const feeBalBefore = await feeCollector.staked();
//        const dividendBalBefore = ethers.utils.formatEther(await staking.balanceOf(dividendRecipient.address));

        // Exit Avalanche operation
        await beefyOptimizer.connect(owner).withdrawAll();

        // Checking the balances after the withdrawal operation
        const userLPBalAfter = await staking.balanceOf(owner.address);
        const poolBalAfter = await beefyVault.balance();
//        const feeBalAfter = await feeCollector.staked();
//        const dividendBalAfter = ethers.utils.formatEther(await staking.balanceOf(dividendRecipient.address));

        // Assertion #1 : User LP Balance After > User LP Balance Before
        expect(userLPBalAfter > userLPBalBefore).to.equal(true);
       
        // Assertion #2 : Staking Pool Balance Before > Staking Pool Balance After
        expect(poolBalBefore > poolBalAfter).to.equal(true);

        // Assertion #3 : Fee Collector Balance Before < Fee Collector Balance After
//        expect(feeBalBefore < feeBalAfter).to.equal(true, "Fees not accrued");
        
        // Assertion #4: Dividend Recipient Balance Before < Dividend Recipient Balance After
//        expect(dividendBalBefore < dividendBalAfter).to.equal(true, "Dividends not accrued");
    });

    it("should recover the lost / airdropped TokenC from the UniV2Optimizer contract", async () => {

        const amountToTransfer = 10;
        const weiAmountToTransfer = ethers.utils.parseEther(amountToTransfer.toString());
        await tokenC.connect(whaleWETH).transfer(beefyOptimizer.address, weiAmountToTransfer);

        // Checking the balances before the recovery operation
        const optiTokenCBalBefore = await tokenC.balanceOf(beefyOptimizer.address);
        const userTokenCBalBefore = await tokenC.balanceOf(owner.address);

        // ERC20 Recovery Operation
        await beefyOptimizer.connect(owner).recoverERC20(tokenC.address);

        // Checking the balances after the recovery operation
        const optiTokenCBalAfter = await tokenC.balanceOf(beefyOptimizer.address);
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
        await truffleAssert.reverts(beefyOptimizer.connect(nonOwner).stake(weiAmount));

        // Assertion : Transaction should revert as the caller is not the owner of the contract
        await truffleAssert.reverts(beefyOptimizer.connect(nonOwner).withdraw(weiAmount));
        
        // Assertion : Transaction should revert as the caller is not the owner of the contract
        await truffleAssert.reverts(beefyOptimizer.connect(nonOwner).withdrawAll());

        // Assertion : Transaction should revert as the caller is not the owner of the contract
        await truffleAssert.reverts(beefyOptimizer.connect(nonOwner).recoverERC20(tokenC.address));
    });
});
 
 