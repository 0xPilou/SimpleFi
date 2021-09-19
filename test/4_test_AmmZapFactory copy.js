/**
 *  Dependencies
 */
 const { expect } = require("chai");
 const { ethers } = require("hardhat");
 const truffleAssert = require('truffle-assertions');

describe("AmmZapFactory Unit Tests", function () {

    /* ABIs */
    const ComethRouterAbi = require("./external_abi/ComethRouter.json");
    const QuickRouterAbi = require("./external_abi/QuickRouter.json");

    /* Adresses */
    const ComethRouterAddress = "0x93bcDc45f7e62f89a8e901DC4A0E2c6C427D9F25";
    const QuickRouterAddress = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

    /* Provider */
    const provider = new ethers.providers.JsonRpcProvider();

    // Instantiating the existing mainnet fork contracts
    comethRouter = new ethers.Contract(ComethRouterAddress, ComethRouterAbi, provider);
    quickRouter = new ethers.Contract(QuickRouterAddress, QuickRouterAbi, provider);
 
    let AmmZapFactory;
    let ammZapFactory;

    before(async () => {
        [owner, addr1, _] = await ethers.getSigners(); 
        
        // Deploying the contract under test
        AmmZapFactory = await ethers.getContractFactory("AmmZapFactory");
        ammZapFactory = await AmmZapFactory.connect(owner).deploy();
    });

    it("should create a new AmmZap for Cometh Router", async () => {
        const numOfZaps = (await ammZapFactory.getAmmZapCount()).toNumber();
        expect(numOfZaps).to.equal(0);   

        await ammZapFactory.createAmmZap(comethRouter.address);

        const newNumOfZaps = (await ammZapFactory.getAmmZapCount()).toNumber();
        expect(newNumOfZaps).to.equal(1);       
    });
    
    it("should revert the transaction when attempting to create a Zap already deployed", async () => {
        await truffleAssert.reverts(ammZapFactory.createAmmZap(comethRouter.address));
    });

    it("should create a new AmmZap for Quick Router", async () => {
        const numOfZaps = (await ammZapFactory.getAmmZapCount()).toNumber();
        expect(numOfZaps).to.equal(1);

        await ammZapFactory.createAmmZap(quickRouter.address);

        const newNumOfZaps = (await ammZapFactory.getAmmZapCount()).toNumber();
        expect(newNumOfZaps).to.equal(2);       
    });
});
