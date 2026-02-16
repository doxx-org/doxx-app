import {
  Avatar,
  AvatarImage,
  AvatarUnknownFallback,
} from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenProfile } from "@/lib/config/tokens";
import { formatNumber } from "@/lib/utils";

export const TokenPriceDisplay = ({
  price,
  token,
  isLoading,
}: {
  price: number;
  token: TokenProfile;
  isLoading: boolean;
}) => {
  return (
    <div className="flex items-center gap-1">
      <Avatar className="size-4 bg-white/5">
        <AvatarImage src={token.image} alt={token.symbol} />
        <AvatarUnknownFallback className="border-none bg-white/5" />
      </Avatar>
      {isLoading ? (
        <Skeleton className="h-4 w-6" />
      ) : (
        <p className="text-gray-200">{formatNumber(price)}</p>
      )}
    </div>
  );
};
