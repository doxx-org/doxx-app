import { CopyIcon } from "lucide-react";
import { copyToClipboard } from "@/lib/text";
import { ellipseAddress } from "@/lib/utils";
import { getTxExplorerUrl } from "@/lib/utils/network";
import { Link } from "../Link";

export const CheckSignatureTimeoutToast = ({
  signature,
}: {
  signature: string;
}) => {
  return (
    <div className="flex flex-col gap-0.5">
      <span>
        Transaction broadcast returned a signature, but it could not be
        confirmed on RPC within timeout.
      </span>
      <span>
        TX:{" "}
        <Link href={getTxExplorerUrl(signature)} className="text-blue-500">
          {ellipseAddress(signature, 4)}
        </Link>
        <CopyIcon
          className="h-4 w-4 cursor-pointer"
          onClick={() => copyToClipboard(signature)}
        />
      </span>
      <span>Please try seeing the transaction on the explorer.</span>
    </div>
  );
};
