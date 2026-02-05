import { CopyIcon } from "lucide-react";
import { copyToClipboard } from "@/lib/text";
import { ellipseAddress } from "@/lib/utils";
import { getAddressExplorerUrl } from "@/lib/utils/network";
import { Link } from "../Link";

export const CreatePoolSuccessToast = ({
  txSignature,
}: {
  txSignature: string;
}) => {
  return (
    <div className="flex flex-col gap-0.5">
      <span>Pool created successfully!</span>
      <div className="flex flex-row items-center gap-1">
        <span>TX: </span>
        <Link
          href={getAddressExplorerUrl(txSignature)}
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

export const CreatePoolUnknownErrorToast = () => {
  return (
    <div className="flex flex-col gap-0.5">
      <span>Pool creation failed with unknown reason.</span>
      <span>Please try again.</span>
    </div>
  );
};
