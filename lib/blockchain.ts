// Worldchain Blockchain Integration
// Read token balances from Worldchain mainnet

import { WORLDCHAIN_TOKENS, WORLDCHAIN_RPC } from './game-config'

// ERC20 ABI for balanceOf
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
]

export interface TokenBalances {
  wld: string
  hachi: string
  koban: string
  wldRaw: bigint
  hachiRaw: bigint
  kobanRaw: bigint
}

// Helper to encode function call
function encodeFunctionCall(functionName: string, address: string): string {
  // balanceOf(address) selector = 0x70a08231
  const selector = '0x70a08231'
  // Pad address to 32 bytes
  const paddedAddress = address.toLowerCase().replace('0x', '').padStart(64, '0')
  return selector + paddedAddress
}

// Make JSON-RPC call
async function jsonRpcCall(method: string, params: any[]): Promise<any> {
  const response = await fetch(WORLDCHAIN_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  })
  
  const data = await response.json()
  if (data.error) {
    throw new Error(data.error.message)
  }
  return data.result
}

// Get token balance
async function getTokenBalance(tokenAddress: string, walletAddress: string): Promise<bigint> {
  if (tokenAddress === '0x0000000000000000000000000000000000000000') {
    // Token address not configured yet
    return BigInt(0)
  }
  
  try {
    const data = encodeFunctionCall('balanceOf', walletAddress)
    const result = await jsonRpcCall('eth_call', [
      {
        to: tokenAddress,
        data,
      },
      'latest',
    ])
    
    return BigInt(result || '0x0')
  } catch (error) {
    console.error(`Error fetching balance for ${tokenAddress}:`, error)
    return BigInt(0)
  }
}

// Get ETH balance (native token)
async function getEthBalance(walletAddress: string): Promise<bigint> {
  try {
    const result = await jsonRpcCall('eth_getBalance', [walletAddress, 'latest'])
    return BigInt(result || '0x0')
  } catch (error) {
    console.error('Error fetching ETH balance:', error)
    return BigInt(0)
  }
}

// Format balance with decimals
function formatBalance(balance: bigint, decimals: number = 18): string {
  const divisor = BigInt(10 ** decimals)
  const integerPart = balance / divisor
  const fractionalPart = balance % divisor
  
  // Format to 4 decimal places
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0').slice(0, 4)
  
  return `${integerPart.toLocaleString()}.${fractionalStr}`
}

// Main function to get all token balances
export async function getWalletBalances(walletAddress: string): Promise<TokenBalances> {
  if (!walletAddress || walletAddress === '0x0000000000000000000000000000000000000000') {
    return {
      wld: '0.0000',
      hachi: '0.0000',
      koban: '0.0000',
      wldRaw: BigInt(0),
      hachiRaw: BigInt(0),
      kobanRaw: BigInt(0),
    }
  }
  
  try {
    const [wldRaw, hachiRaw, kobanRaw] = await Promise.all([
      getTokenBalance(WORLDCHAIN_TOKENS.WLD, walletAddress),
      getTokenBalance(WORLDCHAIN_TOKENS.HACHI, walletAddress),
      getTokenBalance(WORLDCHAIN_TOKENS.KOBAN, walletAddress),
    ])
    
    return {
      wld: formatBalance(wldRaw, 18),
      hachi: formatBalance(hachiRaw, 18),
      koban: formatBalance(kobanRaw, 18),
      wldRaw,
      hachiRaw,
      kobanRaw,
    }
  } catch (error) {
    console.error('Error fetching wallet balances:', error)
    return {
      wld: '0.0000',
      hachi: '0.0000',
      koban: '0.0000',
      wldRaw: BigInt(0),
      hachiRaw: BigInt(0),
      kobanRaw: BigInt(0),
    }
  }
}

// Hook-friendly version that returns formatted balances
export async function fetchBlockchainBalances(walletAddress: string) {
  const balances = await getWalletBalances(walletAddress)
  return {
    wld: balances.wld,
    hachi: balances.hachi,
    koban: balances.koban,
  }
}
