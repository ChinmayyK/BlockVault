import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const ThemeToggle = () => {
  const { theme, setTheme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const handleToggle = () => {
    if (toggleTheme) {
      toggleTheme();
    } else {
      setTheme(isDark ? 'light' : 'dark');
    }
  };

  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={label}
          onClick={handleToggle}
          className="relative h-10 w-10 overflow-hidden border border-border bg-[hsl(var(--card))] text-muted-foreground transition hover:border-[hsl(var(--accent-blue))] hover:text-foreground"
        >
          <Sun className={`absolute h-5 w-5 transition-all duration-300 ${isDark ? '-translate-y-4 opacity-0' : 'translate-y-0 opacity-100'}`} />
          <Moon className={`absolute h-5 w-5 transition-all duration-300 ${isDark ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
};
