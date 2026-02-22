export enum RoutingError {
  NO_POOLS_FOUND = "No available pools found",
  NO_BEST_QUOTE_FOUND = "No best quote found",
  FAILED_TO_GET_BEST_QUOTE = "Failed to get best quote",
}

export const simplifyRoutingErrorMsg = (error: unknown) => {
  if (error === undefined || error === null || !(error instanceof Error)) {
    return RoutingError.FAILED_TO_GET_BEST_QUOTE;
  }

  switch (error.message) {
    case RoutingError.NO_BEST_QUOTE_FOUND:
      return RoutingError.NO_BEST_QUOTE_FOUND;
    case RoutingError.NO_POOLS_FOUND:
      return RoutingError.NO_POOLS_FOUND;
    default:
      return RoutingError.FAILED_TO_GET_BEST_QUOTE;
  }
};
