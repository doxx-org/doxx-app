// should select show display value  % or dollar sign
export function NumberRows({
  value,
  displayValue,
}: {
  value: string;
  displayValue: "percent" | "dollar";
}) {
  return (
    <div className='flex flex-row items-center gap-2 justify-end'>
      {displayValue === "dollar" && <p className='text-gray-700'>$</p>}
      {/* format value to 2 decimal places and add comma every 3 digits */}
      <p>
        {Number(value).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
      {displayValue === "percent" && <p className='text-gray-700'>%</p>}
    </div>
  );
}
