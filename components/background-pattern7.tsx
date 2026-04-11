import { cn } from "@/lib/utils";

interface BackgroundPattern7Props {
  className?: string;
}

const BackgroundPattern7 = ({ className }: BackgroundPattern7Props) => {
  return (
    <section
      className={cn(
        "relative flex min-h-screen w-full items-center justify-center",
        className,
      )}
    >
      {/* Background Pattern */}
      {/* Bottom Fade Grid Pattern */}
      <div
        className="absolute inset-0 z-0 bg-[linear-gradient(to_right,_rgba(10,22,40,0.05)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(10,22,40,0.05)_1px,_transparent_1px)] bg-[length:32px_32px]"
        style={{
          WebkitMaskImage:
            "radial-gradient(ellipse 100% 80% at 50% 100%, #000 50%, transparent 90%)",
          maskImage:
            "radial-gradient(ellipse 100% 80% at 50% 100%, #000 50%, transparent 90%)",
        }}
      />
    </section>
  );
};

export { BackgroundPattern7 };
