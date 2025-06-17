import ChevronUpDown from "@/assets/icons/chevron-up-down.svg";

export function SortColumn({
  header,
}: {
  header: string;
}) {
  return (
    <div className='flex flex-row items-center gap-1 justify-end'>
      <p>{header}</p>
      <ChevronUpDown className='hover:stroke-gray-600' />
    </div>
  );
}
