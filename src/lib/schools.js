import cfbSchools from '../../data/cfb_schools.json';

export const SCHOOLS_BY_CONFERENCE = (() => {
  const groups = new Map();
  [...cfbSchools]
    .sort((a, b) => a.school.localeCompare(b.school))
    .forEach((s) => {
      if (!groups.has(s.conference)) groups.set(s.conference, []);
      groups.get(s.conference).push(s);
    });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
})();

export const ALL_CONFERENCES = SCHOOLS_BY_CONFERENCE.map(([conference]) => conference);

export const SCHOOL_LOOKUP = new Map(cfbSchools.map((s) => [s.school, s]));
