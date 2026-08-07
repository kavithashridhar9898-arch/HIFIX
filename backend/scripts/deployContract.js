const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const ethers = require('ethers');

async function main() {
  console.log('🚀 Compiling and Deploying HiFixVerification Smart Contract to Polygon Amoy Testnet...');

  const privateKey = process.env.POLYGON_PRIVATE_KEY;
  const rpcUrl = process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology';

  if (!privateKey) {
    console.error('❌ POLYGON_PRIVATE_KEY missing in .env file');
    process.exit(1);
  }

  // Compile Solidity Contract using solc
  const solc = require('solc');
  const contractPath = path.join(__dirname, '../contracts/HiFixVerification.sol');
  const source = fs.readFileSync(contractPath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      'HiFixVerification.sol': { content: source }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };

  console.log('📦 Compiling Solidity source...');
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  if (output.errors) {
    const fatal = output.errors.filter(e => e.severity === 'error');
    if (fatal.length > 0) {
      console.error('❌ Compilation errors:', fatal);
      process.exit(1);
    }
  }

  const contractOutput = output.contracts['HiFixVerification.sol']['HiFixVerification'];
  const abi = contractOutput.abi;
  const bytecode = contractOutput.evm.bytecode.object;

  console.log('🔗 Connecting to Polygon Amoy Network...');
  const rpcUrls = [
    process.env.POLYGON_RPC_URL,
    'https://polygon-amoy.drpc.org',
    'https://rpc.ankr.com/polygon_amoy',
    'https://polygon-amoy.blockpi.network/v1/rpc/public',
    'https://rpc-amoy.polygon.technology',
  ].filter(Boolean);

  let provider = null;
  let wallet = null;

  for (const url of rpcUrls) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      const w = new ethers.Wallet(privateKey, p);
      await p.getBlockNumber(); // test connection
      provider = p;
      wallet = w;
      console.log(`✅ Connected using RPC: ${url}`);
      break;
    } catch (e) {
      console.warn(`⚠️ Failed RPC ${url}: ${e.message}`);
    }
  }

  if (!provider || !wallet) {
    console.error('❌ Could not connect to any Polygon Amoy RPC endpoint');
    process.exit(1);
  }

  console.log(`👤 Deployer Address: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} POL`);

  if (balance === 0n) {
    console.error('❌ Deployer wallet has 0 POL balance. Please get free test POL from faucet.');
    process.exit(1);
  }

  console.log('⚡ Sending deployment transaction...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  
  console.log(`⏳ Waiting for block confirmation... Tx: ${contract.deploymentTransaction().hash}`);
  await contract.waitForDeployment();

  const deployedAddress = await contract.getAddress();
  console.log(`\n🎉 CONTRACT SUCCESSFULLY DEPLOYED TO POLYGON AMOY!`);
  console.log(`📍 Contract Address: ${deployedAddress}`);
  console.log(`🔗 Polygonscan Link: https://amoy.polygonscan.com/address/${deployedAddress}\n`);

  // Auto update .env with newly deployed contract address
  const envPath = path.join(__dirname, '../.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('CONTRACT_ADDRESS=')) {
    envContent = envContent.replace(/CONTRACT_ADDRESS=.*/g, `CONTRACT_ADDRESS=${deployedAddress}`);
  } else {
    envContent += `\nCONTRACT_ADDRESS=${deployedAddress}\n`;
  }
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Updated CONTRACT_ADDRESS=${deployedAddress} in backend/.env`);
}

main().catch(err => {
  console.error('❌ Deployment failed:', err);
  process.exit(1);
});
