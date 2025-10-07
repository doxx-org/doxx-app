import { useMemo } from "react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { DoxxAmm } from "@/lib/idl/doxxIdl";
import doxxIdl from "@/lib/idl/doxx_amm.json";

export function useDoxxAmmProgram({
  provider,
}: {
  provider: AnchorProvider | undefined;
}) {
  const program = useMemo(() => {
    if (!provider) return undefined;
    return new Program<DoxxAmm>(doxxIdl, provider);
  }, [provider]);

  return program;
}
