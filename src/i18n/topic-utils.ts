import { CURRICULUM_TOPICS, type CurriculumTopic } from '@/src/config/curriculum';
import type { Messages } from '@/src/i18n';

export interface LocalizedTopic extends CurriculumTopic {
  name: string;
}

type TopicMessages = Record<string, Record<string, string> | undefined>;

export function getLocalizedTopics(messages: Messages, subjectId: string): LocalizedTopic[] {
  const topics =
    (CURRICULUM_TOPICS as Record<string, CurriculumTopic[]>)[subjectId] ?? [];
  const localized = (messages.topics as TopicMessages)[subjectId] ?? {};
  return topics.map((topic) => ({
    ...topic,
    name: localized[topic.id] ?? topic.name,
  }));
}

export function getLocalizedTopicName(
  messages: Messages,
  subjectId: string,
  topicId: string,
): string | null {
  const localized = (messages.topics as TopicMessages)[subjectId] ?? {};
  if (localized[topicId]) return localized[topicId] ?? null;
  const topics =
    (CURRICULUM_TOPICS as Record<string, CurriculumTopic[]>)[subjectId] ?? [];
  return topics.find((topic) => topic.id === topicId)?.name ?? null;
}

export function getLocalizedTopicNameMap(messages: Messages) {
  const map = new Map<string, string>();
  const topicMessages = messages.topics as TopicMessages;
  Object.entries(CURRICULUM_TOPICS).forEach(([subjectId, topics]) => {
    const localized = topicMessages[subjectId] ?? {};
    topics.forEach((topic) => {
      map.set(`${subjectId}:${topic.id}`, localized[topic.id] ?? topic.name);
    });
  });
  return map;
}
