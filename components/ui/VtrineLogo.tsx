import { cn } from '@/lib/utils'

interface VtrineLogoProps {
  size?: 'sm' | 'md'
  className?: string
}

export function VtrineLogo({ size = 'md', className }: VtrineLogoProps) {
  const isSmall = size === 'sm'
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'bg-obsidian flex items-center justify-center flex-shrink-0',
          isSmall
            ? 'w-[30px] h-[30px] rounded-[8px]'
            : 'w-[34px] h-[34px] rounded-[9px]'
        )}
      >
        <svg
          viewBox="0 0 20 20"
          className={isSmall ? 'w-[15px] h-[15px]' : 'w-[17px] h-[17px]'}
          aria-hidden
        >
          <line
            x1="5" y1="4" x2="10" y2="16"
            stroke="white" strokeWidth="3" strokeLinecap="round"
          />
          <line
            x1="15" y1="4" x2="10" y2="16"
            stroke="#C9A96E" strokeWidth="1.5" strokeLinecap="round"
          />
        </svg>
      </span>
      <span
        className={cn(
          'font-display font-semibold tracking-tight',
          isSmall ? 'text-[17px]' : 'text-[19px]'
        )}
      >
        <span className="text-gold">V</span>
        <span className="text-obsidian">trine Digital</span>
      </span>
    </span>
  )
}
