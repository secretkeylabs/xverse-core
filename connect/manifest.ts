import axios from 'axios';

export interface WebManifest {
  icons?: { src: string; sizes?: string }[];
}

// Fetch the web manifest
export async function getManifestFile(url: string) {
  try {
    const response = await axios.get<WebManifest>(`${url}/manifest.json`);
    return response.data;
  } catch (err) {
    const response = await axios.get<WebManifest>(`${url}/manifest.webmanifest`);
    if (response.data) {
      return response.data;
    }
  }
}

export async function getAppIconFromWebManifest(url: string): Promise<string> {
  // Validate URL format
  if (!/^https?:\/\/.*/.test(url)) {
    throw new Error('Invalid URL format');
  }
  const { origin } = new URL(url);
  const manifest = await getManifestFile(origin);

  if (manifest) {
    // Extract the app icons' URLs

    const firstIconSrc = manifest?.icons?.find((icon) => icon.sizes === '48x48')?.src?.replace(/^\/+/, '');

    if (!firstIconSrc) {
      return '';
    }
    return `${origin}/${firstIconSrc}`;
  } else {
    return '';
  }
}
