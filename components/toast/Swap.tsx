import { CopyIcon } from "lucide-react";
import { copyToClipboard } from "@/lib/text";
import { ellipseAddress } from "@/lib/utils";
import { Link } from "../Link";

export const SwapSuccessToast = ({ txSignature }: { txSignature: string }) => {
  return (
    <div className="flex flex-col gap-0.5">
      <span>Swap successful</span>
      <div className="flex flex-row items-center gap-1">
        <span>Transaction signature: </span>
        <Link
          href={`https://solscan.io/tx/${txSignature}`}
          className="text-blue-500"
        >
          {ellipseAddress(txSignature, 4)}
        </Link>
        <CopyIcon
          className="h-4 w-4 cursor-pointer"
          onClick={() => copyToClipboard(txSignature)}
        />
      </div>
    </div>
  );
};

export const SwapUnknownErrorToast = () => {
  return (
    <div className="flex flex-col gap-0.5">
      <span>Swap failed with unknown reason.</span>
      <span>Please try again</span>
    </div>
  );
};
