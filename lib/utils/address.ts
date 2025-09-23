export function parseDisplayAccount(account: string): string {
  return account.slice(0, 5) + "..." + account.slice(-4);
}
