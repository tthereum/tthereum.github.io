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
  tokenMeta: null,
  artifact: null
};

const elements = {
  connectButton: document.getElementById("connectButton"),
  deployButton: document.getElementById("deployButton"),
  loadContractButton: document.getElementById("loadContractButton"),
  sendButton: document.getElementById("sendButton"),
  copyAddressButton: document.getElementById("copyAddressButton"),
  statusMessage: document.getElementById("statusMessage"),
  profileName: document.getElementById("profileName"),
  profileSubtitle: document.getElementById("profileSubtitle"),
  accountValue: document.getElementById("accountValue"),
  networkValue: document.getElementById("networkValue"),
  tokenNameValue: document.getElementById("tokenNameValue"),
  contractAddress: document.getElementById("contractAddress"),
  contractFeedback: document.getElementById("contractFeedback"),
  balanceValue: document.getElementById("balanceValue"),
  nativeBalanceValue: document.getElementById("nativeBalanceValue"),
  recipientAddress: document.getElementById("recipientAddress"),
  amountInput: document.getElementById("amountInput"),
  assetSelect: document.getElementById("assetSelect"),
  sendFeedback: document.getElementById("sendFeedback"),
  receiveAddress: document.getElementById("receiveAddress"),
  statusValue: document.getElementById("statusValue"),
  buyButton: document.getElementById("buyButton"),
  buyFeedback: document.getElementById("buyFeedback")
};

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.style.color = isError ? "#ff6b8b" : "#38d3c0";
  elements.statusValue.textContent = isError ? "Needs attention" : "Connected";
}

function formatAddress(address) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected";
}

function getMetaMaskProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }

  if (Array.isArray(window.ethereum.providers) && window.ethereum.providers.length) {
    return window.ethereum.providers.find((provider) => provider?.isMetaMask) || window.ethereum.providers[0];
  }

  return window.ethereum;
}

async function detectProvider() {
  if (typeof window === "undefined") return null;

  const detectedProvider = getMetaMaskProvider();
  if (detectedProvider) {
    return detectedProvider;
  }

  return new Promise((resolve) => {
    const handle = () => resolve(getMetaMaskProvider());
    window.addEventListener("ethereum#initialized", handle, { once: true });
    window.setTimeout(() => resolve(getMetaMaskProvider()), 3000);
  });
}

async function ensureProvider() {
  const detectedProvider = await detectProvider();
  if (!detectedProvider) {
    setStatus("MetaMask was not detected. Install or enable MetaMask in this browser and try again.", true);
    return null;
  }

  const browserProvider = new ethers.BrowserProvider(detectedProvider);
  state.provider = browserProvider;
  return browserProvider;
}

async function connectWallet() {
  try {
    const provider = await ensureProvider();
    if (!provider) return;

    const ethereumProvider = getMetaMaskProvider();
    let accounts = [];

    if (ethereumProvider?.request) {
      accounts = await ethereumProvider.request({ method: "eth_requestAccounts" });
    } else if (typeof provider.send === "function") {
      accounts = await provider.send("eth_requestAccounts", []);
    }

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
    elements.profileName.textContent = "Connected profile";
    elements.profileSubtitle.textContent = formatAddress(state.account);
    setStatus(`Connected to ${network.name || "your network"}.`);
    await loadToken();
  } catch (error) {
    if (error?.code === 4001) {
      setStatus("MetaMask connection was rejected.", true);
    } else {
      setStatus(error.message || "Wallet connection failed.", true);
    }
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
  const recipient = elements.recipientAddress.value.trim();
  const amount = elements.amountInput.value.trim();
  const selectedAsset = elements.assetSelect.value;

  if (!state.account) {
    elements.sendFeedback.textContent = "Connect your wallet first.";
    return;
  }

  if (!ethers.isAddress(recipient)) {
    elements.sendFeedback.textContent = "Enter a valid recipient address.";
    return;
  }

  if (!amount || Number(amount) <= 0) {
    elements.sendFeedback.textContent = "Enter a positive amount.";
    return;
  }

  try {
    if (selectedAsset === "eth") {
      const tx = await state.signer.sendTransaction({
        to: recipient,
        value: ethers.parseEther(amount)
      });
      elements.sendFeedback.textContent = `Sending ${amount} ETH...`;
      await tx.wait();
      elements.sendFeedback.textContent = `ETH transfer complete. Hash: ${tx.hash}`;
    } else {
      if (!state.contract) {
        elements.sendFeedback.textContent = "Load a token contract before sending tokens.";
        return;
      }

      const decimals = state.tokenMeta?.decimals ?? 18;
      const parsedAmount = ethers.parseUnits(amount, decimals);
      const tx = await state.contract.transfer(recipient, parsedAmount);
      elements.sendFeedback.textContent = `Sending ${amount} ${state.tokenMeta?.symbol || "tokens"}...`;
      await tx.wait();
      elements.sendFeedback.textContent = `Token transfer complete. Hash: ${tx.hash}`;
    }

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

async function openBuyFlow() {
  if (!state.account) {
    elements.buyFeedback.textContent = "Connect your wallet first.";
    return;
  }

  try {
    if (window.ethereum?.request) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: []
      });
    }
    elements.buyFeedback.textContent = "Open your wallet’s buy or swap flow from MetaMask when available.";
  } catch (error) {
    elements.buyFeedback.textContent = `Buy flow unavailable: ${error.message}`;
  }
}

async function initialize() {
  if (elements.connectButton) {
    elements.connectButton.addEventListener("click", connectWallet);
  }

  if (elements.loadContractButton) {
    elements.loadContractButton.addEventListener("click", loadToken);
  }

  if (elements.sendButton) {
    elements.sendButton.addEventListener("click", sendToken);
  }

  if (elements.copyAddressButton) {
    elements.copyAddressButton.addEventListener("click", copyAddress);
  }

  if (elements.buyButton) {
    elements.buyButton.addEventListener("click", openBuyFlow);
  }

  if (window.ethereum) {
    const provider = window.ethereum;
    provider.on("accountsChanged", async (accounts) => {
      if (!accounts.length) {
        state.account = null;
        state.signer = null;
        state.contract = null;
        elements.accountValue.textContent = "Not connected";
        elements.networkValue.textContent = "—";
        elements.receiveAddress.textContent = "Not connected";
        elements.balanceValue.textContent = "0 TTH";
        elements.nativeBalanceValue.textContent = "0 ETH";
        elements.profileName.textContent = "TTH Profile";
        elements.profileSubtitle.textContent = "Connect MetaMask to activate your wallet.";
        elements.statusValue.textContent = "Offline";
        setStatus("Wallet disconnected.", true);
        return;
      }

      const browserProvider = await ensureProvider();
      if (!browserProvider) return;
      state.account = accounts[0];
      state.signer = await browserProvider.getSigner();
      const network = await browserProvider.getNetwork();
      state.network = network;
      elements.accountValue.textContent = formatAddress(state.account);
      elements.networkValue.textContent = network.name || `Chain ${network.chainId}`;
      elements.receiveAddress.textContent = state.account;
      elements.profileName.textContent = "TTH Profile";
      elements.profileSubtitle.textContent = formatAddress(state.account);
      elements.statusValue.textContent = "Connected";
      await loadToken();
    });

    provider.on("chainChanged", () => window.location.reload());
  }
}

initialize();
