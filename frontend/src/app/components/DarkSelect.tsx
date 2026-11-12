import { type ReactNode, useState } from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

// Radix Select cannot hold an empty-string value, so "" maps to a sentinel.
const emptySelectValue = "__applytogether_empty__";

/** The app's themed dropdown, built on Radix Select. */
export function DarkSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  contentClassName = "",
  header,
  footer,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  className?: string;
  contentClassName?: string;
  header?: ReactNode;
  footer?: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const normalizedValue = value === "" ? emptySelectValue : value;
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? "";
  const triggerLabel = selectedLabel ? `${ariaLabel}: ${selectedLabel}` : ariaLabel;

  return (
    <RadixSelect.Root
      open={open}
      onOpenChange={setOpen}
      value={normalizedValue}
      onValueChange={(nextValue) =>
        onChange(nextValue === emptySelectValue ? "" : nextValue)
      }
    >
      <RadixSelect.Trigger
        aria-label={triggerLabel}
        className={`inline-flex min-h-8 w-full items-center justify-between gap-2 overflow-hidden rounded-lg border border-border bg-input px-3 py-2 text-left text-xs text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-colors hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 data-[state=open]:border-primary/35 data-[state=open]:bg-secondary ${className}`}
      >
        <span
          aria-hidden="true"
          title={selectedLabel}
          className="min-w-0 flex-1"
          style={{
            display: "block",
            flexBasis: 0,
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedLabel}
        </span>
        <RadixSelect.Icon className="shrink-0 text-muted-foreground">
          <ChevronDown size={14} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className={`z-[100] min-w-[var(--radix-select-trigger-width)] max-w-[280px] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-foreground shadow-[var(--shadow-raised)] ${contentClassName}`}
        >
          {header ? (
            <div className="px-3 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {header}
            </div>
          ) : null}
          <RadixSelect.Viewport>
            {options.map((option) => {
              const optionValue =
                option.value === "" ? emptySelectValue : option.value;
              return (
                <RadixSelect.Item
                  key={optionValue}
                  value={optionValue}
                  className="relative flex min-w-0 cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-8 text-xs outline-none transition-colors data-[highlighted]:bg-primary/15 data-[highlighted]:text-primary data-[state=checked]:text-foreground"
                >
                  <RadixSelect.ItemText>
                    <span className="block truncate">{option.label}</span>
                  </RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="absolute right-2.5 text-primary">
                    <Check size={13} />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              );
            })}
          </RadixSelect.Viewport>
          {footer ? (
            <div className="mt-1 border-t border-border pt-1">
              {footer(() => setOpen(false))}
            </div>
          ) : null}
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
