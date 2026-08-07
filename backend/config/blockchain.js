/**
 * Blockchain Configuration (Polygon Network)
 * Supports switching between Polygon Amoy Testnet and Polygon Mainnet via ENV.
 */

const NETWORK = process.env.POLYGON_NETWORK || 'amoy'; // 'amoy' or 'mainnet'

const CONFIG = {
  amoy: {
    name: 'Polygon Amoy Testnet',
    chainId: 80002,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-amoy.drpc.org',
    explorerUrl: 'https://amoy.polygonscan.com',
    contractAddress: process.env.CONTRACT_ADDRESS || '0x43FA8B854483759C9989E78F5605dFA0454378A5', // Deployed verification contract
  },
  mainnet: {
    name: 'Polygon Mainnet',
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    contractAddress: process.env.CONTRACT_ADDRESS || '0x43FA8B854483759C9989E78F5605dFA0454378A5',
  },
};

const activeConfig = CONFIG[NETWORK] || CONFIG.amoy;

// Minimal ABI for HiFixVerification contract
const CONTRACT_ABI = [
  'function registerRecord(bytes32 _hash, string calldata _entityType, uint256 _bookingId) external returns (bool)',
  'function verifyHash(bytes32 _hash) external view returns (bool exists, string memory entityType, uint256 bookingId, uint256 timestamp, address registeredBy)',
  'function isRegistered(bytes32 _hash) external view returns (bool)',
  'event RecordRegistered(bytes32 indexed entityHash, string entityType, uint256 indexed bookingId, uint256 timestamp, address registeredBy)',
];

module.exports = {
  NETWORK,
  ACTIVE_CONFIG: activeConfig,
  CONTRACT_ABI,
  PRIVATE_KEY: process.env.POLYGON_PRIVATE_KEY || null,
  SIMULATION_MODE: !process.env.POLYGON_PRIVATE_KEY, // True when no wallet private key is supplied
};
