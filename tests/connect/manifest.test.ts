import { assert, test, vi, vitest } from 'vitest';
import axios from 'axios';
import { getAppIconFromWebManifest, getManifestFile, WebManifest } from '../../connect/manifest';

const mocked = vi.hoisted(() => ({
  get: vi.fn(),
}));
vi.mock('axios', async () => ({
  ...(await vi.importActual<any>('axios')),
  default: {
    get: mocked.get,
  },
}));

const mockManifest: WebManifest = {
  icons: [{ src: 'icon.png', sizes: '48x48' }],
};

test('getManifestFile should fetch manifest.json successfully', async () => {
  mocked.get.mockResolvedValueOnce({ data: mockManifest });

  const result = await getManifestFile('https://example.com');
  assert.equal(result, mockManifest);
});

test('getManifestFile should fallback to manifest.webmanifest if manifest.json fails', async () => {
  mocked.get.mockRejectedValueOnce(new Error('Failed to fetch manifest.json'));

  mocked.get.mockResolvedValueOnce({ data: mockManifest });

  const result = await getManifestFile('https://example.com');
  assert.equal(result, mockManifest);
});

// Test getAppIconFromWebManifest function
test('getAppIconFromWebManifest should return the correct icon URL', async () => {
  vitest.spyOn(axios, 'get').mockResolvedValueOnce({ data: mockManifest });

  const result = await getAppIconFromWebManifest('https://example.com');
  assert.equal(result, 'https://example.com/icon.png');
});

test('getAppIconFromWebManifest should handle missing icons or sizes', async () => {
  vitest.spyOn(axios, 'get').mockResolvedValueOnce({ data: {} });

  const result = await getAppIconFromWebManifest('https://example.com');
  assert.equal(result, '');
});

test('getAppIconFromWebManifest should handle invalid URL format', async () => {
  vitest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('Invalid URL format'));

  try {
    await getAppIconFromWebManifest('invalid-url');
    assert.fail('Expected an error but did not throw.');
  } catch (error) {
    assert.equal(error.message, 'Invalid URL format');
  }
});
