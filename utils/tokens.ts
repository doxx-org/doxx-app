export function ellipseAddress(
  address: string,
  startLength: number = 6,
  endLength: number = 4,
): string {
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}
