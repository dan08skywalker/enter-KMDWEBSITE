import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { COUNTRIES, COUNTRY_PLACEHOLDER } from "@/lib/site/countries";

interface CountrySelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Rendered under the field, matching the other registration fields. */
  hint?: string;
}

/**
 * Searchable country dropdown for the registration form.
 *
 * Nothing is preselected: the trigger shows "Select your country" until the
 * customer picks one, so the saved record reflects their own choice rather than
 * a default. Typing filters the list, which matters on a phone where scrolling
 * through every country is slow.
 */
export function CountrySelect({ id, value, onChange, disabled = false, hint }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => COUNTRIES.find((country) => country.name === value) ?? null,
    [value],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return COUNTRIES;
    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(needle) || country.code.toLowerCase() === needle,
    );
  }, [query]);

  return (
    <div>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (disabled) return;
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Country"
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground",
            )}
          >
            <span className="truncate">{selected ? selected.name : COUNTRY_PLACEHOLDER}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search countries…"
              aria-label="Search countries"
            />
            <CommandList className="max-h-72">
              <CommandEmpty>No country matches that search.</CommandEmpty>
              <CommandGroup>
                {matches.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={country.name}
                    onSelect={() => {
                      onChange(country.name);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected?.code === country.code ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1 truncate">{country.name}</span>
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                      {country.code}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
