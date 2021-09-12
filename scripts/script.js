// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const fs = require('fs');

const must_abi = require('./Must.json');


const alchemyApiKey = fs.readFileSync("./secret").toString().trim();

async function main() {


  const provider = new ethers.providers.JsonRpcProvider(alchemyApiKey);

  const must = new ethers.Contract("0x9C78EE466D6Cb57A4d01Fd887D2b5dFb2D46288f", must_abi, provider)

  let balance = await must.balanceOf("0xBE5a2376A293306ca5043a8895b0c52039E8Ba57")

  console.log("My Balance is:", ethers.utils.formatEther(balance));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
