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

export const simplifyErrorMessage = (error: Error, defaultMessage?: string) => {
  const unhandledError = defaultMessage ?? "An unknown error occurred.";
  // try to simplify the error message
  try {
    const index = KNOWN_ERRORS.findIndex((knownError) =>
      knownError.message.toLowerCase().includes(error.message.toLowerCase()),
    );

    if (index !== -1) {
      return KNOWN_ERRORS[index].simplifiedMessage;
    }

    return unhandledError;
  } catch {
    // if the error is not a known error, return the unhandled error
    return unhandledError;
  }
};
