export interface TagOption {
  id: string;
  name: string;
  tag: string;
  aliases?: readonly string[];
}

export interface TagIndexEntry {
  id: string;
  name: string;
  tag: string;
  tokens: string[];
}

export const TAG_REGEX = /#[\p{L}0-9-]+/giu;
export const TAG_MATCH_REGEX = /(?:^|\s)#([\p{L}0-9-]*)/giu;

function foldTagCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u0131/g, 'i')
    .replace(/\u0307/g, '');
}

export function normalizeTagToken(value: string) {
  return foldTagCase(value);
}

export function slugifyTag(value: string) {
  return foldTagCase(value)
    .replace(/[^\p{L}0-9]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildTagIndex(options: TagOption[]): TagIndexEntry[] {
  return options.map((option) => {
    const tokens = new Set<string>();
    const maybeAdd = (value?: string) => {
      if (!value) return;
      const normalized = normalizeTagToken(value);
      if (normalized) tokens.add(normalized);
    };
    maybeAdd(option.id);
    maybeAdd(option.tag);
    maybeAdd(slugifyTag(option.name));
    (option.aliases ?? []).forEach((alias) => maybeAdd(alias));
    return {
      id: option.id,
      name: option.name,
      tag: option.tag,
      tokens: Array.from(tokens),
    };
  });
}

export function createTagMap(index: TagIndexEntry[]) {
  const map = new Map<string, string>();
  index.forEach((entry) => {
    entry.tokens.forEach((token) => {
      if (!map.has(token)) {
        map.set(token, entry.id);
      }
    });
  });
  return map;
}

export function parseTaggedQuery(raw: string, tagMap: Map<string, string>) {
  const tags = raw.match(TAG_REGEX) ?? [];
  const normalizedTags = tags.map((tag) => normalizeTagToken(tag.slice(1)));
  const tagIds = normalizedTags
    .map((token) => tagMap.get(token) ?? null)
    .filter((id): id is string => Boolean(id));
  const textQuery = raw.replace(TAG_REGEX, '').trim();
  return { tagIds, textQuery };
}
