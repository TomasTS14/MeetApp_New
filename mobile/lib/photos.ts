import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Phone cameras take 12 megapixel photos; nothing in the app shows them that large.
// Shrinking before upload keeps storage costs down and Nearby fast on mobile data.
export async function shrinkPhoto(uri: string, maxSide: number): Promise<{ uri: string; mimeType: string }> {
  const image = await ImageManipulator.manipulate(uri).renderAsync();
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const context = ImageManipulator.manipulate(uri);
  if (scale < 1) context.resize({ width: Math.round(image.width * scale) });
  const result = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { uri: result.uri, mimeType: 'image/jpeg' };
}

export const EVENT_PHOTO_MAX_SIDE = 1600;
export const AVATAR_MAX_SIDE = 512;
