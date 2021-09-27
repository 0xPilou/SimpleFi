/**
 *  Dependencies
 */
 const { expect } = require("chai");
 const { ethers } = require("hardhat");
 const truffleAssert = require('truffle-assertions');
 const fs = require('fs');

 const polygonAlchemyKey = fs.readFileSync("secretPolygon").toString().trim();
 
describe("AmmZapFactory Unit Tests", function () {

    /* ABIs */
    const ComethRouterAbi = require("./external_abi/ComethRouter.json");
    const QuickRouterAbi = require("./external_abi/QuickRouter.json");
    const SushiRouterAbi = require("./external_abi/SushiRouter.json");

    /* Adresses */
    const ComethRouterAddress = "0x93bcDc45f7e62f89a8e901DC4A0E2c6C427D9F25";
    const QuickRouterAddress = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
    const SushiRouterAddress = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";

    /* Provider */
    const provider = new ethers.providers.JsonRpcProvider();

    // Instantiating the existing mainnet fork contracts
    comethRouter = new ethers.Contract(ComethRouterAddress, ComethRouterAbi, provider);
    quickRouter = new ethers.Contract(QuickRouterAddress, QuickRouterAbi, provider);
    sushiRouter = new ethers.Contract(SushiRouterAddress, SushiRouterAbi, provider);
 
    let AmmZapFactory;
    let ammZapFactory;

    before(async () => {

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

        [owner, addr1, _] = await ethers.getSigners(); 
        
        // Deploying the contract under test
        AmmZapFactory = await ethers.getContractFactory("AmmZapFactory");
        ammZapFactory = await AmmZapFactory.connect(owner).deploy();
    });

    it("should create a new AmmZap for Cometh Router", async () => {

        await ammZapFactory.createAmmZap(comethRouter.address);

        const newZapId = (await ammZapFactory.getAmmZapCount()).toNumber(); 
        const newZapAddr = await ammZapFactory.ammZaps(newZapId - 1);
        const queriedZapAddr = await ammZapFactory.getAmmZapByRouter(comethRouter.address)

        expect(newZapId).to.equal(1);       
        expect(queriedZapAddr).to.equal(newZapAddr);   
    });

    it("should create a new AmmZap for Quick Router", async () => {

        await ammZapFactory.createAmmZap(quickRouter.address);

        const newZapId = (await ammZapFactory.getAmmZapCount()).toNumber(); 
        const newZapAddr = await ammZapFactory.ammZaps(newZapId - 1);
        const queriedZapAddr = await ammZapFactory.getAmmZapByRouter(quickRouter.address)

        expect(newZapId).to.equal(2);       
        expect(queriedZapAddr).to.equal(newZapAddr);       
    });

    it("should revert the transaction when non-owner attempting to create a new Zap", async () => {
        await truffleAssert.reverts(ammZapFactory.connect(addr1).createAmmZap(sushiRouter.address));
    });

    it("should revert the transaction when attempting to create a Zap already deployed", async () => {
        await truffleAssert.reverts(ammZapFactory.createAmmZap(comethRouter.address));
    });

    it("should create a new AmmZap for Sushi Router", async () => {

        await ammZapFactory.createAmmZap(sushiRouter.address);

        const newZapId = (await ammZapFactory.getAmmZapCount()).toNumber(); 
        const newZapAddr = await ammZapFactory.ammZaps(newZapId - 1);
        const queriedZapAddr = await ammZapFactory.getAmmZapByRouter(sushiRouter.address)

        expect(newZapId).to.equal(3);       
        expect(queriedZapAddr).to.equal(newZapAddr);       
    });



});
