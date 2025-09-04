interface KnownError {
  message: string;
  simplifiedMessage: string;
}

const USER_REJECTED_ERROR: KnownError = {
  message: "User rejected the request.",
  simplifiedMessage: "User rejected the request.",
};

// NOTE: add more known errors here
const KNOWN_ERRORS: KnownError[] = [USER_REJECTED_ERROR];

export const simplifyErrorMessage = (error: Error) => {
  if (KNOWN_ERRORS.some((knownError) => knownError.message === error.message)) {
    return KNOWN_ERRORS.find(
      (knownError) => knownError.message === error.message,
    )?.simplifiedMessage;
  }

  return "An unknown error occurred.";
};
