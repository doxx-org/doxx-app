import { PublicKey } from "@solana/web3.js";

export function parseDisplayAccount(account: string): string {
  return account.slice(0, 5) + "..." + account.slice(-4);
}

export function compareTokenAddressesString(
  address1: string,
  address2: string,
): boolean {
  return address1.toLowerCase() === address2.toLowerCase();
}

export function compareTokenAddresses(
  address1: PublicKey,
  address2: PublicKey,
): boolean {
  return (
    address1.toBase58().toLowerCase() === address2.toBase58().toLowerCase()
  );
}

export function isTokenMatchPool(
  inputTokenA: PublicKey,
  inputTokenB: PublicKey,
  poolTokenA: PublicKey,
  poolTokenB: PublicKey,
): boolean {
  return (
    (compareTokenAddresses(inputTokenA, poolTokenA) &&
      compareTokenAddresses(inputTokenB, poolTokenB)) ||
    (compareTokenAddresses(inputTokenA, poolTokenB) &&
      compareTokenAddresses(inputTokenB, poolTokenA))
  );
}
