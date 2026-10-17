import type { Coordinates } from '@/lib/location';

export type Place = {
  id: string;
  name: string;
  address: string;
  areaLabel: string;
  latitude: number;
  longitude: number;
};

const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

export const placeSearchAvailable = !!mapboxToken;

type MapboxFeature = {
  id: string;
  properties: {
    name: string;
    full_address?: string;
    place_formatted?: string;
    coordinates: { latitude: number; longitude: number };
    context?: {
      neighborhood?: { name: string };
      locality?: { name: string };
      place?: { name: string };
    };
  };
};

// Address search with the Mapbox Geocoding API (v6), biased towards the given point.
export async function searchPlaces(query: string, near: Coordinates, language: string): Promise<Place[]> {
  if (!mapboxToken || query.trim().length < 3) {
    return [];
  }
  const params = new URLSearchParams({
    q: query,
    access_token: mapboxToken,
    proximity: `${near.longitude},${near.latitude}`,
    language,
    limit: '5',
  });
  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`);
  if (!response.ok) {
    throw new Error(`Place search failed (${response.status})`);
  }
  const body: { features: MapboxFeature[] } = await response.json();
  return body.features.map((feature) => {
    const { properties } = feature;
    const context = properties.context ?? {};
    const area = context.neighborhood?.name ?? context.locality?.name;
    const city = context.place?.name;
    return {
      id: feature.id,
      name: properties.name,
      address: properties.full_address ?? [properties.name, properties.place_formatted].filter(Boolean).join(', '),
      areaLabel: [area, city].filter(Boolean).join(', ') || properties.name,
      latitude: properties.coordinates.latitude,
      longitude: properties.coordinates.longitude,
    };
  });
}
