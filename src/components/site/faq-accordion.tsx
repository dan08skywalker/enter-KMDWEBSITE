import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { FaqEntry } from "@/lib/site/content";

export function FaqAccordion({ entries }: { entries: readonly FaqEntry[] }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {entries.map((entry, index) => (
        <AccordionItem key={entry.question} value={`faq-${index}`} className="border-b">
          <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">
            {entry.question}
          </AccordionTrigger>
          <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
            {entry.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
