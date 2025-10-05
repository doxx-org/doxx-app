/**
 * Script to check which AMM configs exist on testnet
 * This helps you know which fee tiers are available
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { DoxxAmm } from '../lib/idl/doxxIdl';
import DoxxAmmIdl from '../lib/idl/doxx_amm.json';

const TESTNET_RPC = 'https://api.testnet.solana.com';
const PROGRAM_ID = 'BRgEXNPkWvuYDTpGdpKPnyKvrv8wXrj55u13uaotmhGb';

// Derive AMM config address
function getAmmConfigAddress(index: number, programId: PublicKey): PublicKey {
  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16LE(index, 0);
  
  const [address] = PublicKey.findProgramAddressSync(
    [Buffer.from('amm_config'), indexBuffer],
    programId,
  );
  return address;
}

async function checkAmmConfigs() {
  console.log('🔍 Checking AMM Configs on Testnet\n');
  console.log('Program:', PROGRAM_ID);
  console.log('Network: Testnet\n');
  
  const connection = new Connection(TESTNET_RPC, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  
  // Check indices 0-10
  for (let i = 0; i <= 10; i++) {
    const configAddress = getAmmConfigAddress(i, programId);
    
    try {
      const accountInfo = await connection.getAccountInfo(configAddress);
      
      if (accountInfo) {
        console.log(`✅ Index ${i}: ${configAddress.toBase58()}`);
        console.log(`   Owner: ${accountInfo.owner.toBase58()}`);
        console.log(`   Size: ${accountInfo.data.length} bytes`);
        
        // Try to decode if possible
        try {
          // Read trade fee rate (at offset 4 bytes after bump+bool+index)
          // Structure: bump(1) + disable(1) + index(2) + tradeFee(8)
          const tradeFeeRate = accountInfo.data.readBigUInt64LE(4);
          const feePct = Number(tradeFeeRate) / 1000000; // ppm to percentage
          console.log(`   Fee: ${feePct}%`);
        } catch (e) {
          console.log('   (Could not decode fee)');
        }
        console.log('');
      } else {
        console.log(`❌ Index ${i}: Not found (${configAddress.toBase58()})`);
      }
    } catch (error) {
      console.log(`❌ Index ${i}: Error - ${error}`);
    }
  }
  
  console.log('\n💡 Tips:');
  console.log('   - Use an existing index to create pools');
  console.log('   - If no configs exist, contact your protocol admin to initialize them');
  console.log('   - Each config represents a different fee tier');
}

checkAmmConfigs().catch(console.error);

