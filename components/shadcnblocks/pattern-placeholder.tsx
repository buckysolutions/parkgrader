import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PatternPlaceholder = () => {
  return (
    <div className="relative z-10">
      <div className="container py-28 md:py-32">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
          <Badge variant="secondary">Shadcnblocks.com</Badge>
          <div className="max-w-3xl">
            <h1 className="mb-6 text-4xl font-medium tracking-tight text-pretty text-foreground md:text-5xl lg:text-6xl">
              Modern background patterns for any section.
            </h1>
            <p className="mx-auto max-w-2xl font-light tracking-tighter text-pretty text-muted-foreground md:text-lg lg:text-xl">
              Easily insertable background patterns that use Tailwind CSS and
              SVGs. Copy and paste as an absolute positioned div in any section.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button>Get Started</Button>
            <Button variant="secondary">Learn More</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { PatternPlaceholder };
