import { edenImages } from '@/lib/constants/eden-images';
import { cn } from '@/lib/utils';

import { GlowingEffect } from './ui/glowing-effect';

interface ArcadiaCardProps {
  title: string;
  subtitle: string;
  className?: string;
}

export function ArcadiaCard({ title, subtitle, className }: ArcadiaCardProps) {
  return (
    <div
      style={{ backgroundImage: `url(${edenImages.banner2})` }}
      className={cn(
        'order-secondary border-secondary relative min-h-40 rounded-xl border bg-cover p-5',
        className
      )}
    >
      <GlowingEffect />

      <div className="relative z-10 flex items-start gap-2">
        <img src="/misc/app-logo.png" alt="app-logo" />
        <div className="text-black">
          <h6 className="text-2xl font-[500]">{title}</h6>
          <p>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
