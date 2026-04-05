'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectItem } from '@/components/ui/select';
import { PiBookOpen as BookOpen, PiMagnifyingGlass as Search } from 'react-icons/pi';
import { useI18n } from '@/src/i18n/i18n-provider';
import { getLocaleCode } from '@/src/i18n';
import { getLocalizedSubjects } from '@/src/i18n/subject-utils';

interface PurchasedMaterial {
    purchasedAt: string;
    material: {
        id: string;
        title: string;
        subjectId: string;
        topicId: string;
        materialType: 'TEXTUAL' | 'PRACTICE_TEST';
        difficulty: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | null;
    };
}

type SortOption = 'newest' | 'oldest' | 'az' | 'za';

const DIFFICULTY_COLORS: Record<string, string> = {
    BASIC: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400',
    INTERMEDIATE: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-500/10 dark:text-yellow-400',
    ADVANCED: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400',
};

export default function MyMaterialsPage() {
    const [materials, setMaterials] = useState<PurchasedMaterial[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortOption>('newest');
    const { locale, t, messages } = useI18n();
    const copy = messages.app.library;
    const subjectNameMap = useMemo(
        () => new Map(getLocalizedSubjects(messages).map((subject) => [subject.id, subject.name])),
        [messages],
    );
    const countLabel = (count: number) =>
        count === 1
            ? t('app.library.countSingle', { count })
            : t('app.library.countPlural', { count });
    const SORT_LABELS: Record<SortOption, string> = copy.sortOptions;

    useEffect(() => {
        fetch('/api/materials/my-purchases')
            .then((r) => r.json())
            .then((data) => {
                setMaterials(data || []);
            })
            .catch(() => setMaterials([]))
            .finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        let list = [...materials];

        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (m) =>
                    m.material.title.toLowerCase().includes(q) ||
                    m.material.subjectId.toLowerCase().includes(q) ||
                    (subjectNameMap.get(m.material.subjectId) ?? '').toLowerCase().includes(q),
            );
        }

        // Sort
        list.sort((a, b) => {
            if (sort === 'newest') return new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime();
            if (sort === 'oldest') return new Date(a.purchasedAt).getTime() - new Date(b.purchasedAt).getTime();
            if (sort === 'az') return a.material.title.localeCompare(b.material.title);
            if (sort === 'za') return b.material.title.localeCompare(a.material.title);
            return 0;
        });

        return list;
    }, [materials, search, sort, subjectNameMap]);

    return (
        <DashboardShell>
        <PageHeader
            title={copy.title}
            description={copy.description}
        />

        <main className="space-y-4 pt-2">
            {loading ? (
                <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                            <Skeleton className="h-9 w-full" />
                        </div>
                        <Skeleton className="h-9 w-48" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="card-frame bg-card p-4 space-y-3">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                                <Skeleton className="h-3 w-2/3" />
                                <Skeleton className="h-3 w-1/3" />
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    {/* Search & Sort */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                type="search"
                                placeholder={copy.searchPlaceholder}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9"
                                aria-label={copy.searchLabel}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="library-sort" className="text-sm text-muted-foreground whitespace-nowrap">
                                {copy.sortBy}
                            </label>
                            <Select
                                id="library-sort"
                                value={sort}
                                onChange={(e) => setSort(e.target.value as SortOption)}
                                className="w-[180px]"
                                aria-label={copy.sortLabel}
                            >
                                {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                                    <SelectItem key={key} value={key}>
                                        {SORT_LABELS[key]}
                                    </SelectItem>
                                ))}
                            </Select>
                        </div>
                    </div>

                    {/* Results */}
                    {filtered.length === 0 ? (
                        <div className="card-frame border-dashed bg-muted/20 px-5 py-12 text-center">
                            <BookOpen className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
                            {search ? (
                                <>
                                    <p className="text-sm text-muted-foreground font-medium">
                                        {t('app.library.emptyResults', { query: search })}
                                    </p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">{copy.emptyHint}</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-muted-foreground font-medium">{copy.emptyMaterials}</p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">
                                        {copy.browseStart}
                                        <Link href="/catalog" className="text-primary underline underline-offset-2">
                                            {copy.browseLink}
                                        </Link>{' '}
                                        {copy.browseEnd}
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                                {countLabel(filtered.length)}
                                {search ? t('app.library.matching', { query: search }) : null}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {filtered.map(({ material, purchasedAt }) => (
                                    <Link
                                        key={material.id}
                                        href={`/catalog/${material.subjectId}/${material.topicId}/${material.id}`}
                                        className="group card-frame bg-card p-3 transition-all duration-200 flex flex-col gap-2"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                                {material.title}
                                            </h3>
                                            <div className="shrink-0 flex items-center gap-1">
                                                <span
                                                    className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full ${material.materialType === 'PRACTICE_TEST'
                                                        ? 'text-purple-600 bg-purple-50 dark:bg-purple-500/10 dark:text-purple-400'
                                                        : 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400'
                                                        }`}
                                                >
                                                    {material.materialType === 'PRACTICE_TEST'
                                                        ? copy.testLabel
                                                        : copy.textualLabel}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <span className="capitalize">
                                                {subjectNameMap.get(material.subjectId) ?? material.subjectId}
                                            </span>
                                            {material.difficulty && (
                                                <span
                                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DIFFICULTY_COLORS[material.difficulty]}`}
                                                >
                                                    {copy.difficulty[material.difficulty]}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-[11px] text-muted-foreground/60 mt-auto">
                                            {copy.purchased}{' '}
                                            {new Date(purchasedAt).toLocaleDateString(getLocaleCode(locale), {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </main>
    </DashboardShell>
);
}
