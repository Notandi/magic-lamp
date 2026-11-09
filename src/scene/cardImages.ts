import * as THREE from 'three';

// Keep loaded images in three's cache, so a Card's texture is built from an image that was
// already downloaded and decoded before the Wish (see `loadCardImage`).
THREE.Cache.enabled = true;

const imageLoader = new THREE.ImageLoader();

/**
 * Downloads a Card image into three's cache. The Cards' `useTexture` then finds it there
 * instead of downloading it at the moment of the Wish.
 */
export function loadCardImage(url: string): Promise<unknown> {
  return imageLoader.loadAsync(url);
}
