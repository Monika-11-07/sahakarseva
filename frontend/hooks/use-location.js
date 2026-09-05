import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { locationApi } from '../services/api';

export default function useLocation(isWorker = false) {
  const [location, setLocation] = useState(null);
  const [locationLabel, setLocationLabel] = useState('Detecting location...');
  const [nearbyWorkers, setNearbyWorkers] = useState([]);
  const [locationState, setLocationState] = useState('loading'); // 'loading' | 'ready' | 'denied' | 'error'
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLocationAndWorkers = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationState('denied');
        setLocationLabel('Location permission denied');
        setIsRefreshing(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coordinates = currentLocation.coords;
      setLocation(coordinates);
      setLocationState('ready');

      // 1. Reverse Geocode to display location name
      try {
        const places = await Location.reverseGeocodeAsync(coordinates);
        const place = places[0];
        if (place) {
          const label = [place.district || place.subregion || place.name, place.city]
            .filter(Boolean)
            .join(', ');
          setLocationLabel(label || 'Current Location');
        }
      } catch (_e) {
        setLocationLabel(`${coordinates.latitude.toFixed(3)}, ${coordinates.longitude.toFixed(3)}`);
      }

      // 2. Fetch nearby workers within 15km radius from backend
      try {
        const result = await locationApi.getNearbyWorkers(coordinates.latitude, coordinates.longitude, 15);
        const list = result.workers || result.data?.workers || [];
        setNearbyWorkers(list);
      } catch (err) {
        console.warn('Failed to fetch nearby workers:', err.message);
        setNearbyWorkers([]);
      }

      // 3. If authenticated worker, update live location in backend database
      if (isWorker) {
        try {
          await locationApi.updateLocation(coordinates.latitude, coordinates.longitude);
        } catch (_err) {
          // Non-blocking if worker profile not created yet
        }
      }
    } catch (err) {
      console.error('Location error:', err);
      setLocationState('error');
      setLocationLabel('Location unavailable');
    } finally {
      setIsRefreshing(false);
    }
  }, [isWorker]);

  useEffect(() => {
    fetchLocationAndWorkers();
  }, [fetchLocationAndWorkers]);

  return {
    location,
    locationLabel,
    nearbyWorkers,
    nearbyServices: nearbyWorkers, // Alias for backwards compatibility
    locationState,
    isRefreshing,
    refreshLocation: fetchLocationAndWorkers,
  };
}

