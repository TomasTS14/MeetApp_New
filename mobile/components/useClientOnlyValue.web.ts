import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

// `useSyncExternalStore` returns the server value during server rendering and hydration,
// and the client value afterwards, without a second render pass.
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  return useSyncExternalStore<S | C>(
    subscribe,
    () => client,
    () => server
  );
}
