import { ArrowUp, BarChart3, Search, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Hero235Props {
  className?: string;
  onCtaClick?: () => void;
}

const SERVICES = [
  {
    icon: BarChart3,
    title: "Booking Flow Score",
    description:
      "Is your reservation process leaking guests at every step?",
  },
  {
    icon: Search,
    title: "Google Presence Grade",
    description:
      "How you stack up in local search vs. nearby parks.",
  },
  {
    icon: Zap,
    title: "Top 3 Revenue Leaks",
    description:
      "Your biggest issues ranked by impact.",
  },
];

const Hero235 = ({ className, onCtaClick }: Hero235Props) => {
  return (
    <section
      className={cn(
        "relative flex min-h-[70dvh] items-center justify-center overflow-hidden bg-background py-20",
        className,
      )}
    >
      <div aria-hidden={true}>
        <div className="absolute -right-0 -bottom-[30rem] size-[35rem] rounded-full bg-[#2DA4A9] opacity-20 blur-[5rem] md:-right-[2rem] md:-bottom-[50rem] md:size-[55rem]" />
        <div className="absolute -right-[20rem] -bottom-[20rem] size-[35rem] rounded-full bg-[#005056] opacity-20 blur-[5rem] md:-right-[32rem] md:-bottom-[36rem] md:size-[55rem]" />
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-30"
          style={{
            backgroundImage:
              "url(https://deifkwefumgah.cloudfront.net/shadcnblocks/block/noise.png)",
            backgroundRepeat: "repeat",
          }}
        />
      </div>
      <div className="relative container flex h-full flex-col justify-between">
        <div className="flex flex-1 items-center justify-center">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">What&apos;s in the report</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground md:text-4xl lg:text-5xl">
              Your full audit in 60 seconds
            </h2>
            <p className="mt-6 max-w-xl text-pretty text-muted-foreground md:text-lg">
              We scan your website for the issues that cost you bookings — and show you exactly how to fix them.
            </p>
            <Button
              size="lg"
              className="mt-10 bg-[#2DA4A9] hover:bg-[#24858A]"
              onClick={onCtaClick}
            >
              Get My Free Audit
              <ArrowUp className="shrink-0" aria-hidden />
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">Takes 60 seconds. 100% free.</p>
          </div>
        </div>
        <div className="pt-16">
          <div className="grid gap-12 lg:grid-cols-3 lg:gap-0">
            {SERVICES.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.title}
                  className={cn(
                    "flex flex-col border-l border-[#2DA4A9] px-6 md:px-8",
                  )}
                >
                  <Icon className="mb-4 size-6 text-[#2DA4A9]" aria-hidden />
                  <h2 className="font-semibold text-foreground">
                    {service.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {service.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export { Hero235 };
