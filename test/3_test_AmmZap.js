/**
 *  Dependencies
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const truffleAssert = require('truffle-assertions');
const fs = require('fs');

const polygonAlchemyKey = fs.readFileSync("secretPolygon").toString().trim();

describe("AmmZap Unit Tests", function () {  
    
    /* ABIs */
    const TokenLPAbi = require("./external_abi/Staking.json");
    const TokenAAbi = require("./external_abi/TokenA.json");
    const TokenBAbi = require("./external_abi/TokenB.json");
    const TokenCAbi = require("./external_abi/TokenC.json");
    const AmmRouterAbi = require("./external_abi/ComethRouter.json");

    /* Adresses */
    // WMATIC-MUST LP
    const TokenLPAddress = "0x80676b414a905De269D0ac593322Af821b683B92";

    // SDT-WETH LP 
    const TokenLP2Address = "0x7B72870DA19fFd973D7D3404446a03CeC8F73b4a";

    // WMATIC
    const TokenAAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";

    // MUST
    const TokenBAddress = "0x9C78EE466D6Cb57A4d01Fd887D2b5dFb2D46288f";

    // WETH
    const TokenCAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";

    // ComethSwap Router
    const AmmRouterAddress = "0x93bcDc45f7e62f89a8e901DC4A0E2c6C427D9F25";


    /* Provider */
    const provider = new ethers.providers.JsonRpcProvider();

    // Instantiating the existing mainnet fork contracts
    lp = new ethers.Contract(TokenLPAddress, TokenLPAbi, provider);
    lp2 = new ethers.Contract(TokenLP2Address, TokenLPAbi, provider);

    tokenA = new ethers.Contract(TokenAAddress, TokenAAbi, provider);
    tokenB = new ethers.Contract(TokenBAddress, TokenBAbi, provider);
    tokenC = new ethers.Contract(TokenCAddress, TokenCAbi, provider);
    ammRouter = new ethers.Contract(AmmRouterAddress, AmmRouterAbi, provider);
 
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
        // MUST Whale           : 0xd386076b0726B52547E7a6C97CA8DbEF0D462492

        // Impersonating a whale addresses to provision the user account with necessary tokens for testing purpose
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0x84D34f4f83a87596Cd3FB6887cFf8F17Bf5A7B83"],
          });
        whaleWMATIC = await ethers.getSigner("0x84D34f4f83a87596Cd3FB6887cFf8F17Bf5A7B83");
        
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0xd386076b0726B52547E7a6C97CA8DbEF0D462492"],
          });
        whaleMUST = await ethers.getSigner("0xd386076b0726B52547E7a6C97CA8DbEF0D462492");

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0xd3d176F7e4b43C70a68466949F6C64F06Ce75BB9"],
          });
        whaleWETH = await ethers.getSigner("0xd3d176F7e4b43C70a68466949F6C64F06Ce75BB9");   

        [owner, nonOwner, _] = await ethers.getSigners();   

        // Deploying the contract under test
        AmmZap = await ethers.getContractFactory("AmmZap");
        ammZap = await AmmZap.connect(owner).deploy(ammRouter.address);
    });

    it("should zap 10 WETH tokens into MUST-WMATIC LP Tokens", async () => {

        // Quantity to zap for this test
        const amountToZap = 10;
        const weiAmountToDeposit = ethers.utils.parseEther(amountToZap.toString());

        // Transfering 10 WETH from a whale address to the user address
        await tokenC.connect(whaleWETH).transfer(nonOwner.address, weiAmountToDeposit);

        // Checking the balances before the zapping operation
        const userLPBalBefore = await lp.balanceOf(nonOwner.address);      
        const userWETHBalBefore = await tokenC.balanceOf(nonOwner.address);      
        
        // Approving the 10 WETH tokens to be zapped by the AMMZap
        await tokenC.connect(nonOwner).approve(ammZap.address, weiAmountToDeposit);

        // Zapping 10 WETH tokens into MUST-WMATIC LP Tokens
        await ammZap.connect(nonOwner).zap(
            tokenC.address,
            tokenA.address,
            tokenB.address,
            weiAmountToDeposit
        );
        
        // Checking the balances after the zapping operation
        const userLPBalAfter = await lp.balanceOf(nonOwner.address);      
        const userWETHBalAfter = await tokenC.balanceOf(nonOwner.address);      

        // Assertion #1 : User WETH balance After = User WETH Balance Before - 10 WETH
        expect(userWETHBalAfter).to.equal(userWETHBalBefore.sub(weiAmountToDeposit))

        // Assertion #2 : User LP Balance Before < User LP Balance After
        expect(userLPBalBefore < userLPBalAfter).to.equal(true)
    });

    it("should zap 10 WMATIC tokens into MUST-WMATIC LP Tokens", async () => {

        // Quantity to zap for this test
        const amountToZap = 10;
        const weiAmountToDeposit = ethers.utils.parseEther(amountToZap.toString());

        // Transfering 10 WETH from a whale address to the user address
        await tokenA.connect(whaleWMATIC).transfer(nonOwner.address, weiAmountToDeposit);

        // Checking the balances before the zapping operation
        const userLPBalBefore = await lp.balanceOf(nonOwner.address);      
        const userWMATICBalBefore = await tokenA.balanceOf(nonOwner.address);      
        
        // Approving the 10 WETH tokens to be zapped by the AMMZap
        await tokenA.connect(nonOwner).approve(ammZap.address, weiAmountToDeposit);

        // Zapping 10 WETH tokens into MUST-WMATIC LP Tokens
        await ammZap.connect(nonOwner).zap(
            tokenA.address,
            tokenA.address,
            tokenB.address,
            weiAmountToDeposit
        );
        
        // Checking the balances after the zapping operation
        const userLPBalAfter = await lp.balanceOf(nonOwner.address);      
        const userWMATICBalAfter = await tokenA.balanceOf(nonOwner.address);      

        // Assertion #1 : User WMATIC Balance After = User WMATIC Balance Before - 10 WMATIC
        expect(userWMATICBalAfter).to.equal(userWMATICBalBefore.sub(weiAmountToDeposit))

        // Assertion #2 : User LP Balance Before < User LP Balance After
        expect(userLPBalBefore < userLPBalAfter).to.equal(true)
    });

    it("should zap 10 MUST tokens into MUST-WMATIC LP Tokens", async () => {

        // Quantity to zap for this test
        const amountToZap = 10;
        const weiAmountToDeposit = ethers.utils.parseEther(amountToZap.toString());

        // Transfering 10 WETH from a whale address to the user address
        await tokenB.connect(whaleMUST).transfer(nonOwner.address, weiAmountToDeposit);

        // Checking the balances before the zapping operation
        const userLPBalBefore = await lp.balanceOf(nonOwner.address);      
        const userMUSTBalBefore = await tokenB.balanceOf(nonOwner.address);      
        
        // Approving the 10 WETH tokens to be zapped by the AMMZap
        await tokenB.connect(nonOwner).approve(ammZap.address, weiAmountToDeposit);

        // Zapping 10 WETH tokens into MUST-WMATIC LP Tokens
        await ammZap.connect(nonOwner).zap(
            tokenB.address,
            tokenA.address,
            tokenB.address,
            weiAmountToDeposit
        );
        
        // Checking the balances after the zapping operation
        const userLPBalAfter = await lp.balanceOf(nonOwner.address);      
        const userMUSTBalAfter = await tokenB.balanceOf(nonOwner.address);      

        // Assertion #1 : User WMATIC Balance After = User WMATIC Balance Before - 10 WMATIC
        expect(userMUSTBalAfter).to.equal(userMUSTBalBefore.sub(weiAmountToDeposit))

        // Assertion #2 : User LP Balance Before < User LP Balance After
        expect(userLPBalBefore < userLPBalAfter).to.equal(true)
    });

    it("should unzap half of the MUST-WMATIC LP tokens into WETH", async () => {

        const userLPBal = await lp.balanceOf(nonOwner.address);
        const userWETHBalBefore = await tokenC.balanceOf(nonOwner.address);
        
        // Approving the 10 WETH tokens to be zapped by the AMMZap
        await lp.connect(nonOwner).approve(ammZap.address, userLPBal.div(2));

        // Unzapping half of the MUST-WMATIC LP tokens into WETH Tokens
        await ammZap.connect(nonOwner).unzap(
            lp.address,
            tokenC.address,
            userLPBal.div(2),
        );
        
        // Checking the balances after the unzapping operation
        const userLPBalAfter = await lp.balanceOf(nonOwner.address);      
        const userWETHBalAfter = await tokenC.balanceOf(nonOwner.address);      

        // Assertion #1 : User WETH Balance After > User WETH Balance Before
        expect(userWETHBalAfter > userWETHBalBefore).to.equal(true)

        // Assertion #2 : User LP Balance Before < User LP Balance After
        expect(userLPBal.sub(userLPBal.div(2))).to.equal(userLPBalAfter)
    });

    it("should unzap half of the MUST-WMATIC LP tokens into MUST", async () => {

        const userLPBal = await lp.balanceOf(nonOwner.address);
        const userMUSTBalBefore = await tokenB.balanceOf(nonOwner.address);
        
        // Approving the 10 WETH tokens to be zapped by the AMMZap
        await lp.connect(nonOwner).approve(ammZap.address, userLPBal.div(2));

        // Unzapping half of the MUST-WMATIC LP tokens into WETH Tokens
        await ammZap.connect(nonOwner).unzap(
            lp.address,
            tokenB.address,
            userLPBal.div(2),
        );
        
        // Checking the balances after the unzapping operation
        const userLPBalAfter = await lp.balanceOf(nonOwner.address);      
        const userMUSTBalAfter = await tokenC.balanceOf(nonOwner.address);      

        // Assertion #1 : User WETH Balance After > User WETH Balance Before
        expect(userMUSTBalAfter > userMUSTBalBefore).to.equal(true)

        // Assertion #2 : User LP Balance Before < User LP Balance After
        expect(userLPBal.sub(userLPBal.div(2))).to.equal(userLPBalAfter)
    });

    it("should swap half of the remaining MUST-WMATIC LP tokens into SDT-WETH LP tokens", async () => {
        const userLPBal = await lp.balanceOf(nonOwner.address);
        const userLP2Bal = await lp2.balanceOf(nonOwner.address);
        
        // Approving half of the remaining MUST-WMATIC tokens to be swapped by the AMMZap
        await lp.connect(nonOwner).approve(ammZap.address, userLPBal.div(2));

        // Swapping half of the MUST-WMATIC LP tokens into SDT-WETH LP Tokens
        await ammZap.connect(nonOwner).swapLP(
            lp.address,
            lp2.address,
            userLPBal.div(2),
        );
        
        // Checking the balances after the unzapping operation
        const userLPBalAfter = await lp.balanceOf(nonOwner.address);      
        const userLP2BalAfter = await lp2.balanceOf(nonOwner.address);      

        // Assertion #1 : User SDT-WETH LP Balance After > User SDT-WETH LP Balance Before
        expect(userLP2BalAfter > userLP2Bal).to.equal(true)

        // Assertion #2 : User LP Balance Before < User LP Balance After
        expect(userLPBal.sub(userLPBal.div(2))).to.equal(userLPBalAfter)
    });

    it("should unzap all the remaining MUST-WMATIC LP tokens into WMATIC", async () => {
        
        const userLPBal = await lp.balanceOf(nonOwner.address);
        const userWMATICBalBefore = await tokenA.balanceOf(nonOwner.address);
        
        // Approving the 10 WETH tokens to be zapped by the AMMZap
        await lp.connect(nonOwner).approve(ammZap.address, userLPBal);

        // Unzapping half of the MUST-WMATIC LP tokens into WETH Tokens
        await ammZap.connect(nonOwner).unzap(
            lp.address,
            tokenA.address,
            userLPBal,
        );
        
        // Checking the balances after the unzapping operation
        const userLPBalAfter = await lp.balanceOf(nonOwner.address);      
        const userWMATICBalAfter = await tokenA.balanceOf(nonOwner.address);      

        // Assertion #1 : User WETH Balance After > User WETH Balance Before
        expect(userWMATICBalAfter > userWMATICBalBefore).to.equal(true)

        // Assertion #2 : User LP Balance Before < User LP Balance After
        expect(userLPBalAfter).to.equal(0)
    });

    it("should revert the transaction if the quantity to unzap is less than the LP balance", async () => {
        // Quantity to unzap for this test
        const amountToUnzap = 10;
        const weiAmountToUnzap = ethers.utils.parseEther(amountToUnzap.toString());

        await truffleAssert.reverts(
            ammZap.connect(nonOwner).unzap(
                lp.address,
                tokenA.address,
                weiAmountToUnzap
            )
        );
    });
});

