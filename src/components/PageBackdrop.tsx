import { assetCssBackground, assetUrl } from '@/lib/assets';
import { cn } from '@/lib/utils';

type PageBackdropProps = {
  image?: string | null;
  mobileImage?: string | null;
  background?: string | null;
  position?: string;
  mobilePosition?: string;
  blur?: boolean;
  mobileBlur?: boolean;
  className?: string;
  imageClassName?: string;
  overlayClassName?: string;
};

export default function PageBackdrop({
  image,
  mobileImage,
  background,
  position = 'center',
  mobilePosition,
  blur = false,
  mobileBlur,
  className,
  imageClassName,
  overlayClassName,
}: PageBackdropProps) {
  const backgroundStyle = background
    ? { background: assetCssBackground(background) }
    : image
      ? {
          backgroundImage: `url("${assetUrl(image)}")`,
          backgroundPosition: position,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }
      : undefined;
  const mobileStyle = mobileImage
    ? {
        backgroundImage: `url("${assetUrl(mobileImage)}")`,
        backgroundPosition: mobilePosition ?? 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }
    : undefined;
  const hasMobileImage = Boolean(mobileStyle);
  const effectiveMobileBlur = mobileBlur ?? (hasMobileImage ? false : blur);

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#050914]', className)} aria-hidden="true">
      {backgroundStyle && (
        <div
          className={cn(
            'absolute inset-0 scale-[1.02]',
            hasMobileImage && 'hidden md:block',
            blur && 'scale-[1.06] blur-md',
            imageClassName,
          )}
          style={backgroundStyle}
        />
      )}
      {mobileStyle && (
        <div
          className={cn(
            'absolute inset-0 scale-[1.02] md:hidden',
            effectiveMobileBlur && 'scale-[1.06] blur-md',
            imageClassName,
          )}
          style={mobileStyle}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(251,191,36,0.16),transparent_28%),radial-gradient(circle_at_82%_8%,rgba(56,189,248,0.12),transparent_30%)]" />
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/60 to-slate-950/90',
          overlayClassName,
        )}
      />
      <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(circle,rgba(255,255,255,0.32)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.72)]" />
    </div>
  );
}
