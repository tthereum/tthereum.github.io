const hre = require("hardhat");

async function main() {
  const initialSupply = 1_000_000_000;
  const Token = await hre.ethers.getContractFactory("TTHToken");
  const token = await Token.deploy(initialSupply);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log(`TTHToken deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
