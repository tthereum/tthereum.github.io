# tthereum.github.io

This repository now contains a simple Ethereum-compatible token landing page for TTH (Tthereum Coin), plus a basic MetaMask wallet UI and an ERC-20-style Solidity contract.

## What is included
- A GitHub Pages site with a wallet connection experience
- MetaMask connection, balance, receive, and transfer flows
- A deployable Solidity token contract in [contracts/TTHToken.sol](contracts/TTHToken.sol)
- A GitHub Actions workflow to publish the site to GitHub Pages

## Deploy the token contract
1. Install dependencies:
   ```bash
   npm install
   ```
2. Compile the contract:
   ```bash
   npm run compile
   ```
3. Deploy to Sepolia (or another network) by setting environment variables:
   ```bash
   export PRIVATE_KEY="your-private-key"
   export SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/your-key"
   npm run deploy
   ```
4. Copy the deployed contract address into the site input field and refresh the page.

## Publish the website
Push the repository to GitHub and enable GitHub Pages in the repository settings. The workflow in [.github/workflows/deploy.yml](.github/workflows/deploy.yml) will publish the site automatically.
