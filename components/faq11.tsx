import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const categories = [
  {
    title: "Support",
    questions: [
      {
        question: "How do I update my account without breaking my laptop?",
        answer:
          "Lorem ipsum dolor sit amet consectetur adipisicing elit. Minus voluptates deserunt officia temporibus dignissimos.",
      },
      {
        question: "Is support free, or do I need to Google everything?",
        answer:
          "Lorem ipsum dolor sit amet consectetur adipisicing elit. Minus voluptates deserunt officia temporibus dignissimos.",
      },
      {
        question: "Are you going to be subsumed by AI?",
        answer:
          "Lorem ipsum dolor sit amet consectetur adipisicing elit. Minus voluptates deserunt officia temporibus dignissimos.",
      },
    ],
  },
  {
    title: "Your account",
    questions: [
      {
        question: "Is support free, or do I need to Google everything?",
        answer:
          "Lorem ipsum dolor sit amet consectetur adipisicing elit. Minus voluptates deserunt officia temporibus dignissimos.",
      },
      {
        question: "Are you going to be subsumed by AI?",
        answer:
          "Lorem ipsum dolor sit amet consectetur adipisicing elit. Minus voluptates deserunt officia temporibus dignissimos.",
      },
    ],
  },
  {
    title: "Other questions",
    questions: [
      {
        question: "Is support free, or do I need to Google everything?",
        answer:
          "Lorem ipsum dolor sit amet consectetur adipisicing elit. Minus voluptates deserunt officia temporibus dignissimos.",
      },
      {
        question: "Are you going to be subsumed by AI?",
        answer:
          "Lorem ipsum dolor sit amet consectetur adipisicing elit. Minus voluptates deserunt officia temporibus dignissimos.",
      },
    ],
  },
];

interface Faq11Props {
  className?: string;
}

const Faq11 = ({ className }: Faq11Props) => {
  return (
    <section
      className={cn(
        "relative mx-2.5 mt-2.5 rounded-t-2xl rounded-b-[36px] bg-linear-to-b from-background via-background to-slate-100 lg:mx-4 dark:to-slate-900",
        className,
      )}
    >
      <section className="py-32">
        <div className="container grid max-w-5xl gap-16 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
              Got Questions?
            </h2>

            <p className="max-w-md leading-snug font-medium text-muted-foreground lg:mx-auto">
              If you can't find what you're looking for,{" "}
              <a href="#" className="underline underline-offset-4">
                get in touch
              </a>
              .
            </p>
          </div>

          <div className="grid gap-6 text-start">
            {categories.map((category, categoryIndex) => (
              <div key={category.title} className="">
                <h3 className="border-b py-4 font-medium text-muted-foreground">
                  {category.title}
                </h3>
                <Accordion className="w-full">
                  {category.questions.map((item, i) => (
                    <AccordionItem key={i}>
                      <AccordionTrigger className="text-start">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
};

export { Faq11 };
