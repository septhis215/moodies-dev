import { OpenverseMediaProvider } from './openverse-media.provider';
import { MediaHttpService } from './media-http.service';
import { CelebrityIdentity, dedupePhotos } from './celebrity-media.types';
import { photoRelevance } from './photo-discovery';

const identity: CelebrityIdentity = {
  id: 1,
  name: 'Woni',
  aliases: ['Woni', '원이'],
  contexts: ['RESCENE'],
  department: 'Acting',
  officialChannelIds: [],
};
const base = {
  id: '12',
  title: 'Woni RESCENE at a concert',
  width: 1200,
  height: 1600,
  url: 'https://live.staticflickr.com/1/12345_abc_o.jpg',
  thumbnail: 'https://live.staticflickr.com/1/12345_abc_c.jpg',
  foreign_landing_url: 'https://www.flickr.com/photos/photographer/12345/',
  creator: 'Photographer',
  license: 'by-sa',
  license_version: '4.0',
  license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
  mature: false,
};
describe('external photo discovery', () => {
  it('fetches Openverse photos with attribution and rejects mature, wrong-person, group and unusable results', async () => {
    const http = {
      json: jest
        .fn()
        .mockResolvedValue({
          results: [
            base,
            { ...base, mature: true },
            { ...base, title: 'Woni elsewhere' },
            { ...base, title: 'Woni Minami RESCENE group photo' },
            { ...base, license: 'by-nc' },
            { ...base, url: 'http://localhost/a.jpg' },
            { ...base, width: 100 },
          ],
        }),
    };
    const result = await new OpenverseMediaProvider(
      http as unknown as MediaHttpService,
    ).discover(identity);
    expect(dedupePhotos(result.photos)).toHaveLength(1);
    expect(result.photos[0]).toMatchObject({
      source: 'openverse',
      attribution: 'Photographer',
      license: 'CC BY-SA 4.0',
    });
    expect(http.json.mock.calls[0][0].searchParams.get('mature')).toBe('false');
  });
  it('reports a provider outage while accepting partial alias results', async () => {
    const http = { json: jest.fn().mockRejectedValue(new Error('429')) };
    const provider = new OpenverseMediaProvider(
      http as unknown as MediaHttpService,
    );
    await expect(provider.discover(identity)).rejects.toThrow(
      'Openverse unavailable',
    );
    http.json.mockResolvedValueOnce({ results: [base] });
    expect((await provider.discover(identity)).photos).toHaveLength(1);
  });
  it('does not require unrelated film context for an exact full-name portrait', () => {
    expect(
      photoRelevance(
        { ...identity, name: 'Tom Hanks', aliases: ['Tom Hanks'] },
        'Tom Hanks at a premiere',
      ),
    ).toBeGreaterThan(0);
    expect(photoRelevance(identity, 'May RESCENE portrait')).toBe(0);
    expect(
      photoRelevance(
        { ...identity, aliases: ['Woni', 'RESCENE'] },
        'Liv RESCENE portrait',
      ),
    ).toBe(0);
  });
  it('deduplicates Flickr photos found through multiple sources and sizes', () => {
    const photo = {
      ...base,
      id: 'one',
      title: base.title,
      source: 'openverse' as const,
      sourceUrl: base.foreign_landing_url,
      attribution: base.creator,
      relevanceScore: 0.9,
    };
    expect(
      dedupePhotos([
        photo,
        {
          ...photo,
          id: 'two',
          source: 'wikimedia',
          url: 'https://live.staticflickr.com/1/12345_xyz_b.jpg',
        },
      ]),
    ).toHaveLength(1);
  });
});
