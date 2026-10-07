import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  min?: number;
  disabled?: boolean;
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  max = 99,
  min = 1,
  disabled = false,
  className,
}: QuantityStepperProps) {
  const ceiling = Math.max(min, Math.min(max, 99));

  return (
    <div className={cn("inline-flex items-center rounded-md border bg-background", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-r-none"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Decrease quantity"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>

      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={ceiling}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) return;
          onChange(Math.min(Math.max(Math.floor(next), min), ceiling));
        }}
        className="h-9 w-12 border-x bg-transparent text-center text-sm font-semibold tabular-nums outline-none disabled:opacity-50"
        aria-label="Quantity"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-l-none"
        disabled={disabled || value >= ceiling}
        onClick={() => onChange(Math.min(ceiling, value + 1))}
        aria-label="Increase quantity"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
