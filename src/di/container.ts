/**
 * @file container.ts
 * @description Conteneur de dépendances simple.
 *              Simple dependency injection container.
 *
 *              SEUL fichier qui connaît les implémentations concrètes.
 *              Changer de provider = modifier UNE ligne ici.
 *
 *              ONLY file that knows concrete implementations.
 *              Swapping a provider = changing ONE line here.
 *
 * @module di/container
 */

// [ADDED] DI Container — wire-up des dépendances
import type { QueryClient } from '@tanstack/react-query'; // [ADDED]
import { createMMKV } from 'react-native-mmkv';
import type { ICrashReporter } from '@core/ports/ICrashReporter'; // [ADDED]
import type { IGeocodeService } from '@core/ports/IGeocodeService'; // [ADDED]
import type { IGeolocationService } from '@core/ports/IGeolocationService'; // [ADDED]
import type { IPOIService } from '@core/ports/IPOIService'; // [ADDED]
import type { IProfilePhotoService } from '@core/ports/IProfilePhotoService'; // [ADDED] F7 passe 2
import type { IRealtimeService } from '@core/ports/IRealtimeService'; // [ADDED] F4
import type { IStorageService } from '@core/ports/IStorageService';
import { CalculateMidpointUseCase } from '@core/usecases/CalculateMidpointUseCase'; // [ADDED]
import { CreateGuestUserUseCase } from '@core/usecases/CreateGuestUserUseCase';
import { GetCurrentLocationUseCase } from '@core/usecases/GetCurrentLocationUseCase'; // [ADDED]
import { SearchAddressUseCase } from '@core/usecases/SearchAddressUseCase'; // [ADDED]
import { SearchPOIUseCase } from '@core/usecases/SearchPOIUseCase'; // [ADDED]
import { TrackParticipantsUseCase } from '@core/usecases/TrackParticipantsUseCase'; // [ADDED] F4
import { UpdateProfileUseCase } from '@core/usecases/UpdateProfileUseCase'; // [ADDED] F7
import { SentryCrashReporter } from '@infrastructure/crash/SentryCrashReporter'; // [ADDED]
import { NominatimGeocodeService } from '@infrastructure/geocode/NominatimGeocodeService'; // [ADDED]
import { RNGeolocationService } from '@infrastructure/geolocation/RNGeolocationService'; // [ADDED]
import { ImagePickerProfilePhotoService } from '@infrastructure/media/ImagePickerProfilePhotoService'; // [ADDED] F7 passe 2
import { OverpassPOIService } from '@infrastructure/poi/OverpassPOIService'; // [ADDED]
import { FirebaseRealtimeService } from '@infrastructure/realtime/FirebaseRealtimeService'; // [ADDED] F4
import { MMKVStorageService } from '@infrastructure/storage/MMKVStorageService';
import { createZustandMMKVAdapter } from '@infrastructure/storage/zustand-mmkv-adapter';
import { createQueryClient } from './queryClient'; // [ADDED]

/**
 * Interface du conteneur de dépendances.
 * Dependency injection container interface.
 */
export interface Container {
  /** Service de storage persistant / Persistent storage service */
  storage: IStorageService;
  /** Adapter Zustand ↔ MMKV pour persist middleware */
  zustandStorage: ReturnType<typeof createZustandMMKVAdapter>;
  /** Use case de création de guest user */
  createGuestUserUseCase: CreateGuestUserUseCase;
  /** Crash reporter (Sentry) / Crash reporter service */ // [ADDED]
  crashReporter: ICrashReporter; // [ADDED]
  /** Service de géocodage (Nominatim) / Geocoding service */ // [ADDED]
  geocodeService: IGeocodeService; // [ADDED]
  /** Use case de recherche d'adresse / Address search use case */ // [ADDED]
  searchAddressUseCase: SearchAddressUseCase; // [ADDED]
  /** QueryClient TanStack Query / TanStack Query QueryClient */ // [ADDED]
  queryClient: QueryClient; // [ADDED]
  /** Service de géolocalisation native / Native geolocation service */ // [ADDED]
  geolocationService: IGeolocationService; // [ADDED]
  /** Use case de récupération de position courante / Get current location use case */ // [ADDED]
  getCurrentLocationUseCase: GetCurrentLocationUseCase; // [ADDED]
  /** Use case de calcul du midpoint (centroïde + rayon) / Midpoint calculation use case */ // [ADDED]
  calculateMidpointUseCase: CalculateMidpointUseCase; // [ADDED]
  /** Service de recherche de POI (Overpass) / POI search service */ // [ADDED]
  poiService: IPOIService; // [ADDED]
  /** Use case de recherche de POI / POI search use case */ // [ADDED]
  searchPOIUseCase: SearchPOIUseCase; // [ADDED]
  /** Use case de mise à jour du profil (nom + avatar) / Profile update use case */ // [ADDED] F7
  updateProfileUseCase: UpdateProfileUseCase; // [ADDED] F7
  /** Service de photo de profil (picker + FileSystem) / Profile photo service */ // [ADDED] F7 passe 2
  profilePhotoService: IProfilePhotoService; // [ADDED] F7 passe 2
  /** Service temps réel (Firebase Realtime Database) / Real-time service */ // [ADDED] F4
  realtimeService: IRealtimeService; // [ADDED] F4
  /** Use case de suivi temps réel des participants / Real-time tracking use case */ // [ADDED] F4
  trackParticipantsUseCase: TrackParticipantsUseCase; // [ADDED] F4
}

let containerInstance: Container | null = null;

/**
 * Initialise le container avec la clé de chiffrement MMKV.
 * À appeler UNE SEULE FOIS au démarrage de l'app, après getEncryptionKey().
 *
 * Initializes the container with the MMKV encryption key.
 * Must be called ONCE at app startup, after getEncryptionKey().
 *
 * @param encryptionKey - Clé de chiffrement MMKV / MMKV encryption key
 * @returns Le container initialisé / The initialized container
 */
export const initContainer = (encryptionKey: string): Container => {
  if (containerInstance) {
    return containerInstance;
  }

  const mmkv = createMMKV({
    id: 'mivro-storage', // [MODIFIED] MidPoint → Mivro
    encryptionKey,
  });

  const storage = new MMKVStorageService(mmkv);
  const zustandStorage = createZustandMMKVAdapter(storage);

  // [ADDED] Sentry crash reporter — init AVANT le reste du container
  const crashReporter = new SentryCrashReporter();
  crashReporter.init();

  // [ADDED] Geocoding
  const geocodeService = new NominatimGeocodeService(crashReporter);
  const searchAddressUseCase = new SearchAddressUseCase(geocodeService);

  // [ADDED] Geolocation
  const geolocationService = new RNGeolocationService(crashReporter);
  const getCurrentLocationUseCase = new GetCurrentLocationUseCase(
    geolocationService,
    geocodeService,
  );

  // [ADDED] POI service
  const poiService = new OverpassPOIService(crashReporter);
  const searchPOIUseCase = new SearchPOIUseCase(poiService);

  // [ADDED] F4 — Temps réel (Firebase Realtime Database)
  // ⚠️ Swap provider = remplacer FirebaseRealtimeService par un autre adapter ici.
  const realtimeService = new FirebaseRealtimeService(crashReporter);
  const trackParticipantsUseCase = new TrackParticipantsUseCase(realtimeService);

  // [ADDED] TanStack Query
  const queryClient = createQueryClient();

  containerInstance = {
    storage,
    zustandStorage,
    createGuestUserUseCase: new CreateGuestUserUseCase(),
    crashReporter, // [ADDED]
    geocodeService, // [ADDED]
    searchAddressUseCase, // [ADDED]
    queryClient, // [ADDED]
    geolocationService, // [ADDED]
    getCurrentLocationUseCase, // [ADDED]
    calculateMidpointUseCase: new CalculateMidpointUseCase(), // [ADDED]
    poiService, // [ADDED]
    searchPOIUseCase, // [ADDED]
    updateProfileUseCase: new UpdateProfileUseCase(), // [ADDED] F7
    profilePhotoService: new ImagePickerProfilePhotoService(crashReporter), // [ADDED] F7 passe 2
    realtimeService, // [ADDED] F4
    trackParticipantsUseCase, // [ADDED] F4
  };

  console.log(
    `[INFO][container][initContainer][?][${new Date().toISOString().slice(11, 19)}] ` +
      'DI container initialized',
  );

  return containerInstance;
};

/**
 * Récupère le container. À utiliser uniquement après initContainer().
 * Retrieves the container. Only use after initContainer().
 *
 * @returns Le container / The container
 * @throws Error si le container n'a pas été initialisé / if container not initialized
 */
export const getContainer = (): Container => {
  if (!containerInstance) {
    throw new Error('Container not initialized. Call initContainer() first.');
  }
  return containerInstance;
};
