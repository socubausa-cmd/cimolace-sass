import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import React from 'react';

const buttonVariants = cva(
	'inline-flex items-center justify-center rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				default: 'bg-gradient-to-r from-[var(--school-accent)] to-[#e8c45a] text-black hover:brightness-105 shadow-[0_8px_22px_rgba(212,175,55,0.2)]',
				/** Accent LIRI plein (ambre chaud) — sans dégradé or du default ; charte « tout chaud » */
				accent:
					'bg-none bg-[#d4a36a] text-black hover:bg-[#e0b47e] shadow-[0_8px_28px_-6px_rgba(212,163,106,0.45)] focus-visible:ring-[#d4a36a]/45',
				destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
				outline:
          'border border-white/15 bg-white/5 text-white hover:bg-white/10',
				secondary:
          'bg-[#192734] text-white hover:bg-[#223244]',
				ghost: 'text-gray-300 hover:bg-white/5 hover:text-white',
				link: 'text-[var(--school-accent)] underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-10 px-4 py-2',
				sm: 'h-9 rounded-md px-3',
				lg: 'h-11 rounded-md px-8',
				icon: 'h-10 w-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	const Comp = asChild ? Slot : 'button';
	return (
		<Comp
			className={cn(buttonVariants({ variant, size }), className)}
			ref={ref}
			{...props}
		/>
	);
});
Button.displayName = 'Button';

export { Button, buttonVariants };