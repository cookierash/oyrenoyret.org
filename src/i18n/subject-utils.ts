import { SUBJECTS } from '@/src/config/constants';
import type { Messages } from '@/src/i18n';

type SubjectMessages = Messages['subjects'][keyof Messages['subjects']];

export interface LocalizedSubject {
  id: string;
  name: string;
  description: string;
  tag: string;
  aliases: readonly string[];
}

export function getLocalizedSubject(messages: Messages, id: string): LocalizedSubject | null {
  const base = SUBJECTS.find((subject) => subject.id === id);
  const subjectMessages = messages.subjects as Record<string, SubjectMessages | undefined>;
  const copy = subjectMessages[id];
  if (!base && !copy) return null;
  return {
    id,
    name: copy?.name ?? base?.name ?? id,
    description: copy?.description ?? base?.description ?? '',
    tag: copy?.tag ?? base?.id ?? id,
    aliases: copy?.aliases ?? [],
  };
}

export function getLocalizedSubjects(messages: Messages): LocalizedSubject[] {
  return SUBJECTS.map((subject) => getLocalizedSubject(messages, subject.id)).filter(
    (subject): subject is LocalizedSubject => Boolean(subject),
  );
}
