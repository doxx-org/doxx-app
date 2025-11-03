/**
 * Script to initialize the pool creation fee account on testnet
 * This account must exist before pools can be created
 */

import { Connection, PublicKey, SystemProgram, Transaction, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';

const FEE_ACCOUNT = '2uxK8m4GQSnY9TZK4Crh6ggh4uSvyAgMNVHUj5viTUNu';
const TESTNET_RPC = 'https://api.testnet.solana.com';

async function initializeFeeAccount() {
  console.log('🚀 Initializing Pool Creation Fee Account on Testnet\n');
  
  const connection = new Connection(TESTNET_RPC, 'confirmed');
  const feeAccountPubkey = new PublicKey(FEE_ACCOUNT);
  
  console.log('📍 Fee Account:', FEE_ACCOUNT);
  
  // Check if account already exists
  const accountInfo = await connection.getAccountInfo(feeAccountPubkey);
  
  if (accountInfo) {
    console.log('✅ Account already exists!');
    console.log('   Owner:', accountInfo.owner.toBase58());
    console.log('   Balance:', accountInfo.lamports / 1e9, 'SOL');
    return;
  }
  
  console.log('❌ Account does not exist. It needs to be initialized.');
  console.log('\n📋 To initialize this account, you need to send SOL to it.');
  console.log('\n🔧 Options:');
  console.log('   1. Using Phantom/Solflare wallet:');
  console.log('      - Switch to Testnet');
  console.log(`      - Send 0.001 SOL to: ${FEE_ACCOUNT}`);
  console.log('   2. Using Solana CLI:');
  console.log(`      solana transfer ${FEE_ACCOUNT} 0.001 --url testnet --allow-unfunded-recipient`);
  console.log('   3. Using this script with a funded keypair (see code comments)');
  
  console.log('\n💡 After initialization, try creating your pool again!');
}

initializeFeeAccount().catch(console.error);

