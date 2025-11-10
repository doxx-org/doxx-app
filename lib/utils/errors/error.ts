import { ReactNode } from "react";

interface KnownError {
  message: string;
  simplifiedMessage: ReactNode;
}

export const USER_REJECTED_ERROR: KnownError = {
  message: "User rejected the request.",
  simplifiedMessage: "User rejected the request.",
};

export const PROGRAM_WALLET_UNAVAILABLE_ERROR: KnownError = {
  message: "Program/wallet unavailable",
  simplifiedMessage: "Program/wallet unavailable",
};

export const PROVIDER_UNAVAILABLE_ERROR: KnownError = {
  message: "Provider unavailable",
  simplifiedMessage: "Provider unavailable",
};

export const SWAP_EXCEEDED_SLIPPAGE_ERROR: KnownError = {
  message: "ExceededSlippage",
  simplifiedMessage:
    "Swap failed due to slippage.\nPlease try adjusting slippage",
};

// NOTE: add more known errors here
const KNOWN_ERRORS: KnownError[] = [
  USER_REJECTED_ERROR,
  PROGRAM_WALLET_UNAVAILABLE_ERROR,
  SWAP_EXCEEDED_SLIPPAGE_ERROR,
];

export const simplifyErrorMessage = (error: Error, defaultMessage?: string) => {
  const unhandledError = defaultMessage ?? "An unknown error occurred.";
  // try to simplify the error message
  try {
    const index = KNOWN_ERRORS.findIndex((knownError) => {
      return error.message
        .toLowerCase()
        .includes(knownError.message.toLowerCase());
    });

    if (index !== -1) {
      return KNOWN_ERRORS[index].simplifiedMessage;
    }

    return unhandledError;
  } catch {
    // if the error is not a known error, return the unhandled error
    return unhandledError;
  }
};
