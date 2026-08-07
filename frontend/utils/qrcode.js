import { API_BASE_URL } from '../config/api';

/**
 * QR Code & Public Verification URL Helper
 */
export const getPublicVerificationUrl = (type, idOrHash) => {
  const baseUrl = API_BASE_URL.replace('/api', '');
  return `${baseUrl}/api/blockchain/verify/${type}/${idOrHash}`;
};

export const getPolygonExplorerUrl = (txHash, network = 'Polygon Amoy') => {
  if (!txHash) return '#';
  const cleanHash = txHash.startsWith('0x') ? txHash : `0x${txHash}`;
  const isMainnet = network.toLowerCase().includes('mainnet');
  const base = isMainnet ? 'https://polygonscan.com/tx' : 'https://amoy.polygonscan.com/tx';
  return `${base}/${cleanHash}`;
};
