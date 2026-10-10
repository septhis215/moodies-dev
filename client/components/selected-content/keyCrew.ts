type CrewPerson = {
  id: number;
  name: string;
  profile_path?: string | null;
  job?: string;
  jobs?: Array<{ job: string }>;
};

type Creator = Pick<CrewPerson, "id" | "name" | "profile_path">;

export type KeyCreative = Creator & { roles: string[] };

const PEOPLE_PER_ROLE = 2;
const WRITING_ROLES = ["Screenplay", "Writer", "Story"];
const PRODUCING_ROLES = ["Executive Producer", "Producer"];

/** A bounded label/value summary rather than the full crew directory. */
export function selectKeyCrewGroups(
  crew: CrewPerson[],
  contentType: "movie" | "tv",
  creators: Creator[] = [],
): Array<{ label: string; people: KeyCreative[] }> {
  const roleGroups = contentType === "tv"
    ? [["Creator"], WRITING_ROLES, PRODUCING_ROLES, ["Director"], ["Original Music Composer"], ["Director of Photography"]]
    : [["Director"], WRITING_ROLES, PRODUCING_ROLES, ["Original Music Composer"], ["Director of Photography"], ["Creator"]];
  const importantRoles = roleGroups.flat();
  const people = new Map<number, KeyCreative>();

  for (const creator of creators) {
    people.set(creator.id, { ...creator, roles: ["Creator"] });
  }
  for (const person of crew) {
    const roles = [person.job, ...(person.jobs?.map((item) => item.job) ?? [])]
      .filter((role): role is string => Boolean(role && importantRoles.includes(role)));
    if (!roles.length) continue;
    const previous = people.get(person.id);
    people.set(person.id, {
      id: person.id,
      name: previous?.name || person.name,
      profile_path: previous?.profile_path || person.profile_path,
      roles: [...new Set([...(previous?.roles ?? []), ...roles])],
    });
  }

  const candidates = [...people.values()].map((person) => ({
    ...person,
    roles: [...person.roles].sort((a, b) => importantRoles.indexOf(a) - importantRoles.indexOf(b)),
  }));
  return roleGroups.map((roles) => ({
    label: roles === WRITING_ROLES ? "Writing"
      : roles === PRODUCING_ROLES ? "Producing"
      : roles[0] === "Creator" ? "Creators"
      : roles[0] === "Director" ? "Directors"
      : roles[0] === "Original Music Composer" ? "Music"
      : "Cinematography",
    people: candidates.filter((person) => person.roles.some((role) => roles.includes(role)))
      .slice(0, PEOPLE_PER_ROLE),
  })).filter((group) => group.people.length > 0);
}
