import { useMemo } from "react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { DoxxCpmmIdl, doxxCpmmIdl } from "@/lib/idl";

export function useDoxxCpmmProgram({
  provider,
}: {
  provider: AnchorProvider | undefined;
}) {
  const program = useMemo(() => {
    if (!provider) return undefined;
    return new Program<DoxxCpmmIdl>(doxxCpmmIdl, provider);
  }, [provider]);

  return program;
}
