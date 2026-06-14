import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Calendrier (react-day-picker v8), style sombre aligné sur le studio.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={fr}
      className={cn('p-2', className)}
      classNames={{
        root: 'w-full',
        months: 'flex flex-col gap-4 w-full',
        month: 'w-full space-y-4',
        caption: 'flex justify-center pt-1 relative items-center min-h-10 px-1',
        caption_label: 'text-base font-semibold tracking-tight text-white font-display',
        caption_dropdowns: 'flex justify-center items-center gap-2',
        dropdown: 'rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[#0a0908] text-white text-sm py-1.5 pl-2 pr-8',
        dropdown_month: 'text-white',
        dropdown_year: 'text-white',
        dropdown_icon: 'text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)]',
        nav: 'flex items-center gap-1',
        nav_button: cn(
          'absolute h-9 w-9 inline-flex items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)]',
          'bg-white/[0.04] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] hover:text-[#f5e6c8]',
        ),
        nav_button_previous: 'left-0',
        nav_button_next: 'right-0',
        table: 'w-full border-collapse',
        head_row: 'flex w-full justify-between',
        head_cell: 'text-white/40 w-10 font-medium text-[0.65rem] uppercase tracking-[0.12em]',
        row: 'flex w-full mt-1.5 justify-between',
        cell: cn(
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
          'h-10 w-10 sm:h-11 sm:w-11',
        ),
        day: cn(
          'h-10 w-10 sm:h-11 sm:w-11 p-0 font-medium rounded-xl text-white/95',
          'hover:bg-white/10 aria-selected:opacity-100',
        ),
        day_selected:
          'bg-gradient-to-br from-[var(--school-accent)] to-amber-500 text-black hover:text-black hover:from-amber-300 hover:to-[var(--school-accent)] focus:bg-[var(--school-accent)]',
        day_today: 'ring-1 ring-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-white/[0.06] text-white font-semibold',
        day_outside: 'text-white/20 opacity-40',
        day_disabled: 'text-white/15 opacity-25',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        IconLeft: (p) => <ChevronLeft className="h-4 w-4" {...p} />,
        IconRight: (p) => <ChevronRight className="h-4 w-4" {...p} />,
      }}
      {...props}
    />
  );
}

Calendar.displayName = 'Calendar';

export { Calendar };
