import Image from "next/image";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/agri-one-logo.png"
      alt=""
      aria-hidden="true"
      width={96}
      height={65}
      className={className}
    />
  );
}
