import { useEffect, useState } from 'react';

import { isAppleAvailable, isGoogleAvailable } from '@/services/auth-providers';

/** Welche Login-Anbieter auf diesem Gerät/in dieser App-Variante gehen. */
export function useAuthAvailability() {
  const [apple, setApple] = useState(false);
  const google = isGoogleAvailable();

  useEffect(() => {
    let active = true;
    isAppleAvailable().then((ok) => active && setApple(ok));
    return () => {
      active = false;
    };
  }, []);

  return { apple, google, any: apple || google };
}
