import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type Coordinates = { latitude: number; longitude: number };

// Valencia city centre, used when location is not available. Valencia is the launch city.
export const VALENCIA: Coordinates = { latitude: 39.4699, longitude: -0.3763 };

type PositionState =
  | { status: 'loading' }
  | { status: 'ready'; coords: Coordinates }
  | { status: 'denied'; coords: Coordinates };

// How long to wait for the position (including an unanswered permission prompt)
// before showing events around Valencia instead.
const POSITION_TIMEOUT_MS = 8000;

// The device's position, asked for once. It is only sent with each Nearby request and
// never stored on the server.
export function useCurrentPosition(): PositionState {
  const [state, setState] = useState<PositionState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const fallback = setTimeout(() => {
      if (!cancelled) setState((current) => (current.status === 'loading' ? { status: 'denied', coords: VALENCIA } : current));
    }, POSITION_TIMEOUT_MS);
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          if (!cancelled) setState({ status: 'denied', coords: VALENCIA });
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          clearTimeout(fallback);
          setState({
            status: 'ready',
            coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
          });
        }
      } catch {
        if (!cancelled) setState({ status: 'denied', coords: VALENCIA });
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  return state;
}
