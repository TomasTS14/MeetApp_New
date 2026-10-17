import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Writes the file to the app's cache and opens the share sheet, where the person can
// save it to Files, email it or send it to another app.
export async function saveTextFile(name: string, contents: string, mimeType: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}
