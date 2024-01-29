import axios from 'axios';

export interface WebManifest {
  icons?: { src: string; sizes?: string }[];
}

// Fetch the web manifest
async function getManifestFile(url: string) {
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
  const UrlParsed = url.split('/');
  const baseURL = `${UrlParsed[0]}://${UrlParsed[2]}`;
  const manifest = await getManifestFile(baseURL);

  if (manifest) {
    // Extract the app icons' URLs
    const icons = manifest.icons?.filter((icon) => icon.sizes === '48x48');
    if (icons) {
      return `${baseURL}/${icons[0].src}`;
    }
    return '';
  } else {
    return '';
  }
}
