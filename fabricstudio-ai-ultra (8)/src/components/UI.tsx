import { cn } from '../lib/utils';
import { motion, HTMLMotionProps } from 'motion/react';
import { ReactNode } from 'react';

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export function Button({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  children, 
  disabled,
  ...props 
}: ButtonProps) {
  const variants = {
    primary: 'bg-gray-900 text-white hover:bg-slate-800',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
    accent: 'bg-indigo-600 text-white hover:bg-indigo-700',
    outline: 'border border-slate-200 text-slate-900 hover:bg-slate-50',
    ghost: 'hover:bg-slate-100 text-slate-600 hover:text-slate-900',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2 text-sm',
    lg: 'px-8 py-3 text-base',
    icon: 'p-2',
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={isLoading || (disabled as boolean)}
      {...props}
    >
      {isLoading ? (
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children as any}
    </motion.button>
  );
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden', className)} {...props}>
      {children}
    </div>
  );
}
