export enum RoutingError {
  NO_BEST_QUOTE_FOUND = "No best quote found",
  FAILED_TO_GET_BEST_QUOTE = "Failed to get best quote",
}

export const simplifyRoutingErrorMsg = (error: unknown) => {
  if (error === undefined || error === null || !(error instanceof Error)) {
    console.log("🚀 ~ error is undefined or null or not an Error");
    return RoutingError.FAILED_TO_GET_BEST_QUOTE;
  }

  console.log("🚀 ~ error.message:", error.message);
  switch (error.message) {
    case RoutingError.NO_BEST_QUOTE_FOUND:
      return RoutingError.NO_BEST_QUOTE_FOUND;
    default:
      return RoutingError.FAILED_TO_GET_BEST_QUOTE;
  }
};
