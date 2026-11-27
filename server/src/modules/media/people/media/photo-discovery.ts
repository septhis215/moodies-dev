import {
  CelebrityIdentity,
  mentions,
  normalize,
} from './celebrity-media.types';
import { GROUP_ROSTERS } from './celebrity-affiliations';

export function photoQueries(identity: CelebrityIdentity) {
  return [
    ...new Set(
      [identity.name, ...identity.aliases].filter(
        (name) =>
          name &&
          !identity.contexts.some(
            (context) => normalize(context) === normalize(name),
          ),
      ),
    ),
  ]
    .slice(0, 2)
    .map((name) => `${name} ${identity.contexts[0] || ''}`.trim());
}
export function photoRelevance(
  identity: CelebrityIdentity,
  title: string,
  metadata = '',
) {
  const text = `${title} ${metadata}`;
  if (
    /\b(?:logo|poster|album cover|collage|group photo|porn|nude|naked|explicit)\b/i.test(
      text,
    )
  )
    return 0;
  const named = identity.aliases.find(
    (name) =>
      !identity.contexts.some(
        (context) => normalize(context) === normalize(name),
      ) && mentions(text, name),
  );
  if (!named) return 0;
  const group = GROUP_ROSTERS.find((roster) =>
    identity.contexts.some(
      (context) => normalize(context) === normalize(roster.name),
    ),
  );
  if (
    group &&
    group.members.filter((member) => mentions(text, member)).length > 1
  )
    return 0;
  const contextual = identity.contexts.some((context) =>
    mentions(text, context),
  );
  // A full personal name is stronger evidence than an ambiguous single stage name.
  return contextual ? 0.95 : normalize(named).split(' ').length >= 2 ? 0.88 : 0;
}
export function publicPhotoUrl(value?: string) {
  try {
    const url = new URL(value || '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !url.hostname.includes('.') ||
      url.hostname.includes(':') ||
      url.hostname.includes('[') ||
      /^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)|\.(?:local|internal)$/i.test(
        url.hostname,
      )
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}
export const photoLicense = (license: string, version: string = '') => {
  const names: Record<string, string> = {
    by: 'CC BY',
    'by-sa': 'CC BY-SA',
    cc0: 'CC0',
    pdm: 'Public domain',
  };
  return names[license]
    ? `${names[license]}${version ? ` ${version}` : ''}`
    : null;
};
