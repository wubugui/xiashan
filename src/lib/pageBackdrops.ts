export type BackdropAsset = {
  image: string;
  mobileImage: string;
  position?: string;
};

export const SCENE_BACKDROPS = {
  street: {
    image: '/bg/scene/street-storefront.jpg',
    mobileImage: '/bg/mobile/street-storefront-portrait.jpg',
    position: 'center',
  },
  store: {
    image: '/bg/scene/store-night.jpg',
    mobileImage: '/bg/mobile/store-night-portrait.jpg',
    position: 'center',
  },
  studio: {
    image: '/bg/scene/studio-room.jpg',
    mobileImage: '/bg/mobile/studio-room-portrait.jpg',
    position: 'center',
  },
  office: {
    image: '/bg/scene/office-lobby.jpg',
    mobileImage: '/bg/mobile/office-lobby-portrait.jpg',
    position: 'center',
  },
  subway: {
    image: '/bg/scene/subway-station.jpg',
    mobileImage: '/bg/mobile/subway-station-portrait.jpg',
    position: 'center',
  },
  apartment: {
    image: '/bg/scene/apartment-stairs.jpg',
    mobileImage: '/bg/mobile/apartment-stairs-portrait.jpg',
    position: 'center',
  },
  park: {
    image: '/bg/scene/city-park.jpg',
    mobileImage: '/bg/mobile/city-park-portrait.jpg',
    position: 'center',
  },
  hospital: {
    image: '/bg/scene/night-hospital.jpg',
    mobileImage: '/bg/mobile/night-hospital-portrait.jpg',
    position: 'center',
  },
  rooftop: {
    image: '/bg/scene/office-rooftop.jpg',
    mobileImage: '/bg/mobile/office-rooftop-portrait.jpg',
    position: 'center',
  },
} as const satisfies Record<string, BackdropAsset>;

type SceneKey = keyof typeof SCENE_BACKDROPS;

const LOCATION_SCENE: Record<string, SceneKey> = {
  subway: 'subway',
  office: 'office',
  store: 'store',
  apartment: 'apartment',
  studio: 'studio',
  park: 'park',
  hospital: 'hospital',
  rooftop: 'rooftop',
};

const CHARACTER_SCENE: Record<string, SceneKey> = {
  suli: 'studio',
  aruo: 'studio',
  sangluo: 'store',
  aman: 'apartment',
  shenzhaoning: 'office',
  murongxue: 'office',
  yunzhiyi: 'store',
  linxia: 'office',
};

export function backdropForLocation(locationId?: string | null): BackdropAsset {
  return SCENE_BACKDROPS[LOCATION_SCENE[locationId ?? ''] ?? 'street'];
}

export function backdropForCharacter(characterId?: string | null): BackdropAsset {
  return SCENE_BACKDROPS[CHARACTER_SCENE[characterId ?? ''] ?? 'street'];
}
