import { mentions, normalize } from './celebrity-media.types';

// Names are search hints, never trusted TMDB IDs. Every candidate is verified
// against its own profile before it can be recommended.
// Roster reference: https://www.melon.com/artist/timeline.htm?artistId=3709231
export const GROUP_ROSTERS = [
  {
    name: 'RESCENE',
    aliases: ['RESCENE', '리센느', 'リセンヌ'],
    members: ['Woni', 'Liv', 'Minami', 'May', 'Zena'],
  },
];

export function affiliations(person: { biography?: string }): string[] {
  const biography = person.biography || '';
  const groups = GROUP_ROSTERS.filter(
    (group) =>
      group.aliases.some((alias) => mentions(biography, alias)) &&
      /\b(member|leader|singer|vocalist|rapper|dancer)\b|멤버|成员|メンバー/i.test(
        biography,
      ),
  ).map((group) => group.name);
  const named = biography.match(
    /(?:member|leader|vocalist|rapper|dancer)\s+(?:of|in)\s+(?:the\s+)?(?:(?:South Korean|Korean|Japanese|American)\s+)?(?:(?:girl|boy|pop|K-pop|musical|music)\s+)?(?:group|band)\s+([\p{L}\p{N}&-]+(?:\s+[\p{L}\p{N}&-]+){0,2})(?=[.,;\n]|$)/iu,
  )?.[1];
  if (named && !groups.some((group) => normalize(group) === normalize(named)))
    groups.push(named);
  return groups;
}

export function isAdultProfile(person: {
  adult?: boolean;
  biography?: string;
  known_for?: Array<{ adult?: boolean }>;
  combined_credits?: { cast?: Array<{ adult?: boolean }> };
}) {
  return (
    person.adult === true ||
    /\b(?:porn(?:ographic)?(?:\s+film)?|adult(?:\s+(?:film|video))?|AV)\s+(?:actress|actor|performer|star)|\bpornstar\b|色情演员|AV女優/i.test(
      person.biography || '',
    ) ||
    [
      ...(person.known_for || []),
      ...(person.combined_credits?.cast || []),
    ].some((credit) => credit.adult === true)
  );
}
