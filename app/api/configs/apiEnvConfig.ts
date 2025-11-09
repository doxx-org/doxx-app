import z from "zod";

const envSchema = z.object({
  RPC_URL: z.url(),
});

/**
 * Next.js replaces process.env.NEXT_PUBLIC_* at build time.
 * We pass a minimal object to avoid reading non-public keys on the client.
 */
const parsed = envSchema.safeParse({
  RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
});

if (!parsed.success) {
  const format = z.treeifyError(parsed.error).properties;
  if (format) {
    console.error(
      "❌ Some of these api environment variables are missing or invalid:",
      format,
    );
  }
  throw new Error(
    "Invalid api environment variables. See logs for details.",
  );
}

export const apiEnvConfig = parsed.data;
