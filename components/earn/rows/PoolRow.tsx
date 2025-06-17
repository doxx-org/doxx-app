import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import DollarIcon from "@/assets/icons/table/dollar.svg";

type PoolRowProps = {
  pool: {
    token1: {
      name: string;
      image: string;
    };
    token2: {
      name: string;
      image: string;
    };
  };
};

export function PoolRow({ pool }: PoolRowProps) {
  return (
    <div className='flex flex-row items-center gap-2'>
      <div className='*:data-[slot=avatar]:ring-gray-800 flex -space-x-2 *:data-[slot=avatar]:ring-2 '>
        <Avatar className='size-7 z-10 bg-gray-800'>
          <AvatarImage src={pool.token1.image} alt={pool.token1.name} />
          <AvatarFallback>
            <DollarIcon className='opacity-10' />
          </AvatarFallback>
        </Avatar>
        <Avatar className='size-7'>
          <AvatarImage src={pool.token2.image} alt={pool.token2.name} />
          <AvatarFallback>
            <DollarIcon className='opacity-10' />
          </AvatarFallback>
        </Avatar>
      </div>
      <p>
        {pool.token1.name} / {pool.token2.name}
      </p>
    </div>
  );
}
