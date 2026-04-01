import { ReactNode } from 'react';

interface OnboardingStepCardProps {
  image: string;
  number: string | number;
  title: string;
  description: ReactNode;
}

export const OnboardingStepCard = ({
  image,
  number,
  title,
  description,
}: OnboardingStepCardProps) => {
  return (
    <div
      className="relative -z-10 -mb-4 rounded-tl-2xl rounded-tr-2xl bg-cover px-6 pt-6 pb-8"
      style={{ backgroundImage: `url(${image})` }}
    >
      {/* Blur overlay with gradient mask */}
      <div
        className="absolute inset-0 rounded-tl-2xl rounded-tr-2xl backdrop-blur-md"
        style={{
          maskImage:
            'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)',
        }}
      />

      <div className="relative">
        <header className="mb-3.5 flex items-center gap-2">
          <span className="grid size-4.5 place-items-center rounded-full bg-[#35A35A] text-[8.4px] text-white">
            {number}
          </span>
          <h3>{title}</h3>
        </header>
        <p>{description}</p>
      </div>
    </div>
  );
};
