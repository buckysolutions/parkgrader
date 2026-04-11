import { PatternPlaceholder } from "@/components/shadcnblocks/pattern-placeholder";
import { cn } from "@/lib/utils";

interface BackgroundPattern97Props {
  className?: string;
}

const BackgroundPattern97 = ({ className }: BackgroundPattern97Props) => {
  return (
    <section
      className={cn(
        "relative flex min-h-screen w-full items-center justify-center",
        className,
      )}
    >
      {/* Background Pattern */}
      {/* Mesh Glow with Noise Texture */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: `
            radial-gradient(circle at 0% 0%, oklch(from var(--chart-1) calc(l * 1.2) calc(c * 1.5) h / 0.4) 0%, transparent 30%),
            radial-gradient(circle at 100% 100%, oklch(from var(--chart-2) calc(l * 1.1) calc(c * 1.6) h / 0.35) 0%, transparent 35%),
            radial-gradient(circle at 50% 50%, oklch(from var(--chart-3) calc(l * 0.9) calc(c * 1.4) h / 0.25) 0%, transparent 50%),
            radial-gradient(ellipse 120% 100% at 30% 70%, oklch(from var(--chart-4) calc(l * 1.1) calc(c * 1.5) h / 0.3) 0%, transparent 40%),
            var(--background)
          `,
          filter: "blur(100px)",
        }}
      />

      <div className="pointer-events-none absolute inset-0 z-10">
        <svg
          className="h-full w-full opacity-20"
          style={{ mixBlendMode: "overlay" }}
        >
          <filter id="noise-pattern">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="4"
              stitchTiles="stitch"
              seed="2"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect
            width="100%"
            height="100%"
            filter="url(#noise-pattern)"
            fill="white"
          />
        </svg>
      </div>
      <PatternPlaceholder />
    </section>
  );
};

export { BackgroundPattern97 };
