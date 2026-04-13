import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Hero49Props {
  className?: string;
}

const Hero49 = ({ className }: Hero49Props) => {
  return (
    <section className={cn("bg-transparent", className)}>
      <div className="container mx-auto flex flex-col items-center px-4 pt-10 lg:flex-row lg:items-center lg:gap-0 lg:pt-16">
        <div className="flex max-w-3xl flex-col items-center gap-8 text-center lg:max-w-lg lg:items-start lg:text-left lg:flex-[1.2] lg:pl-[8%]">
          <h1 className="text-4xl font-semibold text-[#0A1628] lg:text-5xl">
            35+ checks. 60 seconds. Zero fluff.
          </h1>
          <p className="max-w-xl text-base leading-7 text-[#5B6776] sm:text-lg sm:leading-8">
            Most park owners have no idea their website is turning away guests.
            In 60 seconds you&apos;ll know exactly what&apos;s broken and what
            to fix first.
          </p>
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="min-h-12 w-full rounded-2xl bg-[#2DA4A9] px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-[#24858A] sm:w-auto sm:max-w-[260px]"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            Get My Free Audit
          </motion.button>
        </div>
        <div className="relative translate-x-[14.7%] lg:translate-x-[20%] lg:flex-1">
          {/* Audit mockup inside Iphone */}
          <div className="absolute top-[12%] left-[36.5%]! h-[67%]! w-[31%]! -translate-x-[52%] overflow-hidden rounded-[10px] bg-[#F8FAFC]">            {/* iOS status bar overlay */}
            <div className="relative z-10 flex items-center justify-between bg-[#F8FAFC] px-[8%] pt-[4%] pb-[1.5%]">
              <span className="text-[clamp(4px,1.8vw,10px)] font-semibold text-[#0A1628]">9:41</span>
              <div className="flex items-center gap-[6%]">
                {/* Signal bars */}
                <svg className="h-[clamp(4px,1.2vw,8px)] w-auto" viewBox="0 0 17 10" fill="#0A1628">
                  <rect x="0" y="6" width="3" height="4" rx="0.5"/>
                  <rect x="4" y="4" width="3" height="6" rx="0.5"/>
                  <rect x="8" y="2" width="3" height="8" rx="0.5"/>
                  <rect x="12" y="0" width="3" height="10" rx="0.5"/>
                </svg>
                {/* Wifi */}
                <svg className="h-[clamp(4px,1.2vw,8px)] w-auto" viewBox="0 0 16 12" fill="#0A1628">
                  <path d="M8 0C5.2 0 2.6 1.1.8 3l1.5 1.4C3.8 2.8 5.8 2 8 2s4.2.8 5.7 2.4L15.2 3C13.4 1.1 10.8 0 8 0z"/>
                  <path d="M8 4C6.1 4 4.4 4.8 3.2 6l1.5 1.4C5.5 6.5 6.7 6 8 6s2.5.5 3.3 1.4L12.8 6C11.6 4.8 9.9 4 8 4z"/>
                  <path d="M8 8c-.8 0-1.6.3-2.1.9L8 11l2.1-2.1C9.6 8.3 8.8 8 8 8z"/>
                </svg>
                {/* Battery */}
                <svg className="h-[clamp(4px,1.2vw,8px)] w-auto" viewBox="0 0 25 10" fill="none">
                  <rect x=".5" y=".5" width="20" height="9" rx="1.5" stroke="#0A1628" strokeWidth="1"/>
                  <rect x="2" y="2" width="14" height="6" rx=".5" fill="#0A1628"/>
                  <path d="M22 3.5h1.5a1 1 0 011 1v1a1 1 0 01-1 1H22V3.5z" fill="#0A1628" fillOpacity=".4"/>
                </svg>
              </div>
            </div>            <img
              className="h-full w-full object-cover object-top"
              src="https://assets.buckysolutions.com/website-assets/www.parkgrader.com_screenshot.png"
              alt="ParkGrader audit report on iPhone"
            />
          </div>
          {/* Iphone Image  */}
          <img
            alt=""
            src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/hero49/iphone.png"
            className="relative z-10"
            loading="lazy"
            width="1008.71"
            height="857"
          />
          {/* Top edge line */}
          <div className="absolute top-0 left-1/2 z-20 h-px w-[200vw] -translate-x-1/2 bg-[#0A1628]/10" />
          {/* Bottom edge line so the hand doesn't float */}
          <div className="absolute bottom-0 left-1/2 z-20 h-px w-[200vw] -translate-x-1/2 bg-[#0A1628]/10" />
        </div>
      </div>
    </section>
  );
};

export { Hero49 };
