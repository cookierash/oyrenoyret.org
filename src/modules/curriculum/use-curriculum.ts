'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/src/i18n/i18n-provider';

type ApiTopic = {
  slug: string;
  slugAz?: string;
  nameEn: string;
  nameAz: string;
};

type ApiSubject = {
  slug: string;
  slugAz?: string;
  nameEn: string;
  nameAz: string;
  descriptionEn: string | null;
  descriptionAz: string | null;
  topics: ApiTopic[];
};

export type CurriculumSubject = {
  id: string;
  name: string;
  description: string;
  tag: string;
  aliases: readonly string[];
  topics: { id: string; name: string; tag: string; aliases: readonly string[] }[];
};

export function useCurriculum() {
  const { locale } = useI18n();
  const [subjectsRaw, setSubjectsRaw] = useState<ApiSubject[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/curriculum', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const subjects = Array.isArray(data?.subjects) ? (data.subjects as ApiSubject[]) : [];
        setSubjectsRaw(subjects);
      })
      .catch(() => {
        if (!active) return;
        setSubjectsRaw([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const subjects: CurriculumSubject[] = useMemo(() => {
    const list = subjectsRaw ?? [];
    const isAz = locale === 'az';
    return list.map((subject) => ({
      id: subject.slug,
      name: isAz ? subject.nameAz : subject.nameEn,
      description: (isAz ? subject.descriptionAz : subject.descriptionEn) ?? '',
      tag: isAz ? (subject.slugAz ?? subject.slug) : subject.slug,
      aliases: Array.from(
        new Set([subject.slug, subject.slugAz].filter((v): v is string => Boolean(v && typeof v === 'string'))),
      ),
      topics: (subject.topics ?? []).map((topic) => ({
        id: topic.slug,
        name: isAz ? topic.nameAz : topic.nameEn,
        tag: isAz ? (topic.slugAz ?? topic.slug) : topic.slug,
        aliases: Array.from(
          new Set([topic.slug, topic.slugAz].filter((v): v is string => Boolean(v && typeof v === 'string'))),
        ),
      })),
    }));
  }, [locale, subjectsRaw]);

  const subjectNameMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s.name])),
    [subjects],
  );

  const topicNameMap = useMemo(() => {
    const map = new Map<string, string>();
    subjects.forEach((subject) => {
      subject.topics.forEach((topic) => {
        map.set(`${subject.id}:${topic.id}`, topic.name);
      });
    });
    return map;
  }, [subjects]);

  const subjectHrefMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s.tag])),
    [subjects],
  );

  const topicHrefMap = useMemo(() => {
    const map = new Map<string, string>();
    subjects.forEach((subject) => {
      subject.topics.forEach((topic) => {
        map.set(`${subject.id}:${topic.id}`, topic.tag);
      });
    });
    return map;
  }, [subjects]);

  return {
    loading,
    subjects,
    subjectNameMap,
    topicNameMap,
    subjectHrefMap,
    topicHrefMap,
  };
}
