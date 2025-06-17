import { Marquee } from "@/components/magicui/marquee";
import { cn } from "@/lib/utils";
import { text } from "@/lib/text";

// export function TrendingTokens() {
const mockTokens = [
  {
    name: "ETH",
    symbol: "ETH",
    img: "https://assets.coingecko.com/coins/images/279/large/ethereum.png?1747033579",
  },
  {
    name: "USDC",
    symbol: "USDC",
    img: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042194",
  },
  {
    name: "USDT",
    symbol: "USDT",
    img: "https://assets.coingecko.com/coins/images/325/large/Tether.png?1598003707",
  },
  {
    name: "SOL",
    symbol: "SOL",
    img: "https://assets.coingecko.com/coins/images/4128/large/solana.png?1640133422",
  },
  {
    name: "BTC",
    symbol: "BTC",
    img: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1547033579",
  },
  {
    name: "DOGE",
    symbol: "DOGE",
    img: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png?1696501628",
  },
];

const TokenContainer = ({
  rank,
  img,
  name,
}: {
  rank: number;
  img: string;
  symbol: string;
  name: string;
}) => {
  return (
    <figure>
      <div className='flex flex-row items-center gap-1 justify-center'>
        <p className='text-gray-700'>#{rank}</p>
        <img className='rounded-full' width='12' height='10' alt='' src={img} />
        <p className='text-gray-400'>{name}</p>
      </div>
    </figure>
  );
};
export function TrendingTokens() {
  return (
    <div
      className={cn(
        text.b4(),
        "relative flex w-full flex-row items-center justify-center overflow-hidden border-1 border-gray-800 bg-black-800 rounded-full px-6 py-3 gap-4"
      )}
    >
      {/* add gradient to text */}
      <h1 className='bg-gradient-to-r from-gray-400 to-gray-700 bg-clip-text text-transparent'>
        Trending:
      </h1>
      <Marquee pauseOnHover className='[--duration:20s]'>
        {mockTokens.map((token, index) => (
          <TokenContainer key={token.symbol} rank={index + 1} {...token} />
        ))}
      </Marquee>
    </div>
  );
}
