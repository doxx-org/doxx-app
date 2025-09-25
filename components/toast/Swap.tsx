import { CopyIcon } from "lucide-react";
import { copyToClipboard } from "@/lib/text";
import { ellipseAddress } from "@/lib/utils";

export const SwapSuccessToast = ({ txSignature }: { txSignature: string }) => {
  return (
    <div className="flex flex-col gap-0.5">
      <span>Swap successful</span>
      <div className="flex flex-row items-center gap-1">
        <span>Transaction signature: </span>
        <a
          href={`https://solscan.io/tx/${txSignature}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline"
        >
          {ellipseAddress(txSignature, 4)}
        </a>
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
