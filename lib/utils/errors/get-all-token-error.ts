export enum GetTokenError {
  FAILED_TO_GET_TOKEN_INFOS = "Failed to get token infos",
}

export const simplifyGetAllTokenInfosErrorMsg = (error: unknown) => {
  if (error === undefined || error === null || !(error instanceof Error)) {
    return GetTokenError.FAILED_TO_GET_TOKEN_INFOS;
  }

  switch (error.message) {
    default:
      return GetTokenError.FAILED_TO_GET_TOKEN_INFOS;
  }
};
