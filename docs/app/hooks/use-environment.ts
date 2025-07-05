import { useState, useEffect } from 'react';

interface Environment {
  platform: 'windows' | 'macos' | 'linux' | 'unknown';
  userAgent: string;
  isMobile: boolean;
  isTouch: boolean;
  prefersDark: boolean;
}

export function useEnvironment(): Environment {
  const [env, setEnv] = useState<Environment>({
    platform: 'unknown',
    userAgent: '',
    isMobile: false,
    isTouch: false,
    prefersDark: false,
  });

  useEffect(() => {
    const detectPlatform = (): Environment['platform'] => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      
      if (userAgent.includes('win')) return 'windows';
      if (userAgent.includes('mac')) return 'macos';
      if (userAgent.includes('linux')) return 'linux';
      
      return 'unknown';
    };

    const detectMobile = (): boolean => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    };

    const detectTouch = (): boolean => {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    };

    const detectDarkMode = (): boolean => {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    };

    setEnv({
      platform: detectPlatform(),
      userAgent: navigator.userAgent,
      isMobile: detectMobile(),
      isTouch: detectTouch(),
      prefersDark: detectDarkMode(),
    });

    // Listen for dark mode changes
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleDarkModeChange = (e: MediaQueryListEvent) => {
      setEnv(prev => ({ ...prev, prefersDark: e.matches }));
    };

    darkModeQuery.addEventListener('change', handleDarkModeChange);
    return () => darkModeQuery.removeEventListener('change', handleDarkModeChange);
  }, []);

  return env;
}
