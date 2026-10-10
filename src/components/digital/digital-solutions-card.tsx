import { Link } from "react-router-dom";
import { ArrowRight, BookOpenCheck, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DIGITAL_CATALOGUE_CATEGORY, DIGITAL_SOLUTIONS_CARD } from "@/lib/digital/types";

/**
 * The KMD Digital Solutions entry in the shop catalogue.
 *
 * It is presented as one category card inside the existing catalogue — the same
 * panel, image ratio and card proportions the products use — rather than as a
 * separate section above the shop. Clicking it opens the listing page where each
 * learning package and client service can be selected.
 */
export function DigitalSolutionsCard() {
  return (
    <article className="kmd-panel group flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-elegant)]">
      <Link to="/digital-solutions" className="relative block aspect-[4/3] overflow-hidden bg-secondary">
        <img
          src={DIGITAL_SOLUTIONS_CARD.image}
          alt={DIGITAL_SOLUTIONS_CARD.label}
          loading="lazy"
          crossOrigin="anonymous"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute left-3 top-3 whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">
          Catalogue
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="kmd-eyebrow flex items-center gap-1.5 text-muted-foreground">
          <MonitorSmartphone className="h-3 w-3" />
          {DIGITAL_CATALOGUE_CATEGORY}
        </p>
        <h3 className="mt-1.5 text-sm font-semibold leading-snug">
          <Link to="/digital-solutions" className="hover:text-accent">
            {DIGITAL_SOLUTIONS_CARD.label}
          </Link>
        </h3>

        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {DIGITAL_SOLUTIONS_CARD.blurb}
        </p>

        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <BookOpenCheck className="h-3.5 w-3.5 text-primary" />
          Learning packages and client services
        </p>

        <div className="mt-auto pt-4">
          <Button asChild variant="brand" size="sm" className="w-full">
            <Link to="/digital-solutions">
              Select a package or service
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

