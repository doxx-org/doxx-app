import { useMemo } from "react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { DoxxClmmIdl, doxxClmmIdl } from "@/lib/idl";

export function useDoxxClmmProgram({
  provider,
}: {
  provider: AnchorProvider | undefined;
}) {
  const program = useMemo(() => {
    if (!provider) return undefined;
    return new Program<DoxxClmmIdl>(doxxClmmIdl, provider);
  }, [provider]);

  return program;
}
