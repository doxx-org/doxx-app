# Pool Creation Guide

This guide explains how to create swap pools on the sol-layer chain using the Doxx AMM program.

## Overview

The pool creation functionality allows you to create new liquidity pools for token pairs on the Solana blockchain using the Doxx AMM (Automated Market Maker) protocol.

## Key Components

### 1. `useCreatePool` Hook

Located at `lib/hooks/chain/useCreatePool.ts`, this React hook provides the core functionality for creating pools.

**Usage:**

```typescript
import { useCreatePool } from "@/lib/hooks/chain/useCreatePool";

const { createPool, isCreating, createError } = useCreatePool(
  doxxAmmProgram,
  wallet,
  onSuccess,
  onError,
);
```

**Parameters:**

- `doxxAmmProgram`: The Doxx AMM program instance
- `wallet`: The connected Anchor wallet
- `onSuccess`: Callback function called on successful pool creation
- `onError`: Callback function called on error

**Returns:**

- `createPool`: Function to create a new pool
- `isCreating`: Boolean indicating if pool creation is in progress
- `createError`: Error object if pool creation fails

### 2. Pool Creation Parameters

The `createPool` function accepts the following parameters:

```typescript
type CreatePoolParams = {
  ammConfig: PublicKey; // AMM configuration address
  token0Mint: PublicKey; // First token mint address
  token1Mint: PublicKey; // Second token mint address
  token0Program?: PublicKey; // Token program (defaults to TOKEN_PROGRAM_ID)
  token1Program?: PublicKey; // Token program (defaults to TOKEN_PROGRAM_ID)
  initAmount0: BN; // Initial amount of token0 (in token decimals)
  initAmount1: BN; // Initial amount of token1 (in token decimals)
  openTime?: BN; // Pool open timestamp (defaults to current time)
};
```

### 3. Helper Functions

#### `getAmmConfigAddress(index, programId)`

Derives the AMM config PDA address for a given index.

```typescript
import { getAmmConfigAddress } from "@/lib/utils/instructions";

const [ammConfig] = getAmmConfigAddress(0, programId); // Get default config (index 0)
```

#### `parseAmountBN(amount, decimals)`

Converts a human-readable amount string to a BN with proper decimals.

```typescript
import { parseAmountBN } from "@/lib/utils/number";

const amount = parseAmountBN("100.5", 6); // 100.5 tokens with 6 decimals
```

## Complete Example

### React Component Example

```typescript
import { useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";

import { useDoxxAmmProgram } from "@/lib/hooks/chain/useDoxxAmmProgram";
import { useProvider } from "@/lib/hooks/chain/useProvider";
import { useCreatePool } from "@/lib/hooks/chain/useCreatePool";
import { getAmmConfigAddress } from "@/lib/utils/instructions";
import { parseAmountBN } from "@/lib/utils/number";

export function CreatePoolExample() {
  const [isCreating, setIsCreating] = useState(false);

  // Setup wallet and program connections
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useProvider({ connection, wallet });
  const doxxAmmProgram = useDoxxAmmProgram({ provider });

  // Success handler
  const handleSuccess = (txSignature: string | undefined) => {
    if (txSignature) {
      toast.success(`Pool created! TX: ${txSignature.slice(0, 8)}...`);
      console.log("Transaction:", txSignature);
    }
  };

  // Error handler
  const handleError = (error: Error) => {
    toast.error(`Failed to create pool: ${error.message}`);
    console.error("Pool creation error:", error);
  };

  // Initialize the hook
  const { createPool } = useCreatePool(
    doxxAmmProgram,
    wallet,
    handleSuccess,
    handleError
  );

  // Create a USDC/SOL pool
  const handleCreatePool = async () => {
    if (!doxxAmmProgram || !wallet) return;

    try {
      setIsCreating(true);

      // Token mint addresses (example)
      const usdcMint = new PublicKey("EAqRCe9xcQvfAfqCCzVhbu839ysxLawL8NPkngRweE6i");
      const solMint = new PublicKey("So11111111111111111111111111111111111111112");

      // Get AMM config
      const [ammConfig] = getAmmConfigAddress(0, doxxAmmProgram.programId);

      // Parse amounts
      const initAmount0 = parseAmountBN("1000", 6); // 1000 USDC
      const initAmount1 = parseAmountBN("10", 9);   // 10 SOL

      // Create the pool
      const result = await createPool({
        ammConfig,
        token0Mint: usdcMint,
        token1Mint: solMint,
        initAmount0,
        initAmount1,
      });

      console.log("Pool created:", result);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <button
      onClick={handleCreatePool}
      disabled={isCreating || !wallet}
    >
      {isCreating ? "Creating Pool..." : "Create Pool"}
    </button>
  );
}
```

## Important Notes

### Token Ordering

The Doxx AMM program requires that `token0Mint < token1Mint` (lexicographically). The `useCreatePool` hook automatically handles this ordering for you.

### AMM Config

The examples use AMM config index 0 (the default). Different configs may have different fee structures. You can create custom configs using the `createAmmConfig` instruction (requires admin privileges).

### Minimum Amounts

The program may have minimum initial liquidity requirements. Ensure your initial amounts meet these requirements to avoid transaction failures.

### Pool Fees

Creating a pool requires paying a creation fee to the protocol. This fee is automatically handled by the hook.

### Network Considerations

Make sure you're using the correct token mint addresses for your target network (mainnet, devnet, testnet).

## Integration with UI

The `CreatePoolDialog` component in `components/earn/CreatePoolDialog.tsx` provides a complete UI example of how to integrate pool creation into your application.

Key features:

- Token selection interface
- Amount input validation
- Loading states during creation
- Success/error toast notifications
- Form reset after successful creation

## Error Handling

Common errors and their meanings:

- **"Program or wallet not available"**: Ensure wallet is connected and program is initialized
- **"Invalid vault"**: Token mint addresses may be incorrect
- **"Insufficient funds"**: User doesn't have enough tokens for initial liquidity
- **"Pool already exists"**: A pool for this token pair already exists
- **"Math overflow"**: Amounts are too large for the program to handle

## Testing

Before creating pools on mainnet:

1. Test on devnet first
2. Use small amounts for initial testing
3. Verify token mint addresses are correct
4. Ensure you have sufficient balance for both tokens plus fees

## Advanced Usage

For more advanced use cases, you can:

- Specify custom token programs (for Token2022 tokens)
- Set custom pool open times
- Create pools with different AMM configs
- Handle multiple pool creation transactions in batch

See `lib/examples/createPoolExample.ts` for additional usage patterns.
