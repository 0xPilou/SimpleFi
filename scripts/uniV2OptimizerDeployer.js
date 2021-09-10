// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const UniV2Optimizer = await hre.ethers.getContractFactory("UniV2Optimizer");
  const uniV2Optimizer = await UniV2Optimizer.deploy(
    "0x9C78EE466D6Cb57A4d01Fd887D2b5dFb2D46288f",
    "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    "0x80676b414a905De269D0ac593322Af821b683B92",
    "0x9C78EE466D6Cb57A4d01Fd887D2b5dFb2D46288f",
    "0x2328c83431a29613b1780706E0Af3679E3D04afd",
    "0x93bcDc45f7e62f89a8e901DC4A0E2c6C427D9F25"
  );

  await uniV2Optimizer.deployed();

  console.log("UniV2Optimizer deployed at address : ", uniV2Optimizer.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
