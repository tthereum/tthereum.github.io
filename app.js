const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)"
];

const state = {
  provider: null,
  signer: null,
  account: null,
  network: null,
  contract: null,
  tokenMeta: null
};

const elements = {
  connectButton: document.getElementById("connectButton"),
  loadContractButton: document.getElementById("loadContractButton"),
  sendButton: document.getElementById("sendButton"),
  copyAddressButton: document.getElementById("copyAddressButton"),
  statusMessage: document.getElementById("statusMessage"),
  accountValue: document.getElementById("accountValue"),
  networkValue: document.getElementById("networkValue"),
  tokenNameValue: document.getElementById("tokenNameValue"),
  contractAddress: document.getElementById("contractAddress"),
  contractFeedback: document.getElementById("contractFeedback"),
  balanceValue: document.getElementById("balanceValue"),
  nativeBalanceValue: document.getElementById("nativeBalanceValue"),
  recipientAddress: document.getElementById("recipientAddress"),
  amountInput: document.getElementById("amountInput"),
  sendFeedback: document.getElementById("sendFeedback"),
  receiveAddress: document.getElementById("receiveAddress")
};

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.style.color = isError ? "#ff5a7a" : "#39d0ff";
}

function formatAddress(address) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected";
}

async function ensureProvider() {
  if (!window.ethereum) {
    setStatus("MetaMask is not installed. Install it to continue.", true);
    return null;
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  state.provider = provider;
  return provider;
}

async function connectWallet() {
  try {
    const provider = await ensureProvider();
    if (!provider) return;

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts.length) {
      setStatus("No wallet account was selected.", true);
      return;
    }

    state.account = accounts[0];
    state.signer = await provider.getSigner();
    const network = await provider.getNetwork();
    state.network = network;

    elements.accountValue.textContent = formatAddress(state.account);
    elements.networkValue.textContent = network.name || `Chain ${network.chainId}`;
    elements.receiveAddress.textContent = state.account;
    setStatus(`Connected to ${network.name || "your network"}.`);
    await loadToken();
  } catch (error) {
    setStatus(error.message || "Wallet connection failed.", true);
  }
}

async function loadToken() {
  const contractAddress = elements.contractAddress.value.trim();
  if (!state.account) {
    elements.contractFeedback.textContent = "Connect your wallet first.";
    return;
  }

  if (!ethers.isAddress(contractAddress)) {
    elements.contractFeedback.textContent = "Enter a valid deployed TTH contract address.";
    return;
  }

  try {
    const contract = new ethers.Contract(contractAddress, TOKEN_ABI, state.signer || state.provider);
    state.contract = contract;
    const [name, symbol, decimals] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals()
    ]);

    state.tokenMeta = { name, symbol, decimals };
    elements.tokenNameValue.textContent = `${name} (${symbol})`;
    elements.contractFeedback.textContent = `Loaded ${name} at ${formatAddress(contractAddress)}.`;
    await refreshBalances();
  } catch (error) {
    elements.contractFeedback.textContent = `Could not load token: ${error.message}`;
  }
}

async function refreshBalances() {
  if (!state.account || !state.contract) {
    elements.balanceValue.textContent = "0 TTH";
    elements.nativeBalanceValue.textContent = "0 ETH";
    return;
  }

  try {
    const [tokenBalance, nativeBalance] = await Promise.all([
      state.contract.balanceOf(state.account),
      state.provider.getBalance(state.account)
    ]);

    const decimals = state.tokenMeta?.decimals ?? 18;
    const readableBalance = ethers.formatUnits(tokenBalance, decimals);
    const readableNative = ethers.formatEther(nativeBalance);

    elements.balanceValue.textContent = `${Number(readableBalance).toLocaleString()} ${state.tokenMeta?.symbol || "TTH"}`;
    elements.nativeBalanceValue.textContent = `${Number(readableNative).toFixed(4)} ETH`;
  } catch (error) {
    elements.balanceValue.textContent = "Unable to read balance";
    elements.nativeBalanceValue.textContent = "Unable to read balance";
  }
}

async function sendToken() {
  if (!state.contract || !state.account) {
    elements.sendFeedback.textContent = "Connect your wallet and load a token contract first.";
    return;
  }

  const recipient = elements.recipientAddress.value.trim();
  const amount = elements.amountInput.value.trim();

  if (!ethers.isAddress(recipient)) {
    elements.sendFeedback.textContent = "Enter a valid recipient address.";
    return;
  }

  if (!amount || Number(amount) <= 0) {
    elements.sendFeedback.textContent = "Enter a positive amount.";
    return;
  }

  try {
    const decimals = state.tokenMeta?.decimals ?? 18;
    const parsedAmount = ethers.parseUnits(amount, decimals);
    const tx = await state.contract.transfer(recipient, parsedAmount);
    elements.sendFeedback.textContent = `Sending ${amount} TTH...`;
    await tx.wait();
    elements.sendFeedback.textContent = `Transfer complete. Hash: ${tx.hash}`;
    await refreshBalances();
  } catch (error) {
    elements.sendFeedback.textContent = `Transfer failed: ${error.message}`;
  }
}

async function copyAddress() {
  if (!state.account) {
    return;
  }

  try {
    await navigator.clipboard.writeText(state.account);
    elements.sendFeedback.textContent = "Wallet address copied to clipboard.";
  } catch (error) {
    elements.sendFeedback.textContent = "Copy failed. Please copy manually.";
  }
}

async function initialize() {
  elements.connectButton.addEventListener("click", connectWallet);
  elements.loadContractButton.addEventListener("click", loadToken);
  elements.sendButton.addEventListener("click", sendToken);
  elements.copyAddressButton.addEventListener("click", copyAddress);

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", async () => {
      const provider = await ensureProvider();
      if (!provider) return;
      const [account] = await window.ethereum.request({ method: "eth_accounts" });
      if (account) {
        state.account = account;
        state.signer = await provider.getSigner();
        const network = await provider.getNetwork();
        state.network = network;
        elements.accountValue.textContent = formatAddress(state.account);
        elements.networkValue.textContent = network.name || `Chain ${network.chainId}`;
        elements.receiveAddress.textContent = state.account;
        await loadToken();
      } else {
        state.account = null;
        state.signer = null;
        state.contract = null;
        elements.accountValue.textContent = "Not connected";
        elements.networkValue.textContent = "—";
        elements.receiveAddress.textContent = "Not connected";
        elements.balanceValue.textContent = "0 TTH";
        elements.nativeBalanceValue.textContent = "0 ETH";
      }
    });

    window.ethereum.on("chainChanged", () => window.location.reload());
  }
}

initialize();
