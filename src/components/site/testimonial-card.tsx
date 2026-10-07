import { BadgeCheck, Quote } from "lucide-react";
import { TESTIMONIALS } from "@/lib/site/content";

export function TestimonialGrid({ limit }: { limit?: number }) {
  const entries = limit ? TESTIMONIALS.slice(0, limit) : TESTIMONIALS;

  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {entries.map((entry) => (
        <li key={entry.name} className="kmd-panel flex flex-col p-5">
          <Quote className="h-5 w-5 text-gold" />
          <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground/90">"{entry.quote}"</p>
          <div className="mt-4 border-t pt-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <BadgeCheck className="h-3.5 w-3.5 text-primary" />
              {entry.name}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{entry.location}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-accent">{entry.subject}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
