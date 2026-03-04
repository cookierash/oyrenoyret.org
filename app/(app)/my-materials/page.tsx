'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { Input } from '@/components/ui/input';
import { BookOpen, ChevronLeft, Search, SlidersHorizontal } from 'lucide-react';

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

const SORT_LABELS: Record<SortOption, string> = {
    newest: 'Newest first',
    oldest: 'Oldest first',
    az: 'A → Z',
    za: 'Z → A',
};

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
                    m.material.subjectId.toLowerCase().includes(q),
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
    }, [materials, search, sort]);

    return (
        <DashboardShell>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link
                    href="/dashboard"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        My Materials
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        All materials you have purchased.
                    </p>
                </div>
            </div>

            {/* Search & Sort */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Search by title or subject…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="relative">
                    <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value as SortOption)}
                        className="h-10 rounded-md border border-input bg-background pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer text-foreground"
                    >
                        {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                            <option key={key} value={key}>
                                {SORT_LABELS[key]}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Results */}
            {loading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-28 rounded-xl bg-muted/40 animate-pulse border border-border"
                        />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-12 text-center">
                    <BookOpen className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
                    {search ? (
                        <>
                            <p className="text-sm text-muted-foreground font-medium">No results for &quot;{search}&quot;</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term.</p>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-muted-foreground font-medium">No materials purchased yet.</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                Browse the{' '}
                                <Link href="/catalog" className="text-primary underline underline-offset-2">
                                    catalog
                                </Link>{' '}
                                to find materials.
                            </p>
                        </>
                    )}
                </div>
            ) : (
                <>
                    <p className="text-xs text-muted-foreground mb-3">
                        {filtered.length} material{filtered.length !== 1 ? 's' : ''}
                        {search && ` matching "${search}"`}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map(({ material, purchasedAt }) => (
                            <Link
                                key={material.id}
                                href={`/catalog/${material.subjectId}/${material.topicId}/${material.id}`}
                                className="group rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 flex flex-col gap-2.5"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                        {material.title}
                                    </h3>
                                    <span
                                        className={`shrink-0 inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full ${material.materialType === 'PRACTICE_TEST'
                                            ? 'text-purple-600 bg-purple-50 dark:bg-purple-500/10 dark:text-purple-400'
                                            : 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400'
                                            }`}
                                    >
                                        {material.materialType === 'PRACTICE_TEST' ? 'Test' : 'Textual'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-muted-foreground capitalize">
                                        {material.subjectId.replace(/-/g, ' ')}
                                    </span>
                                    {material.difficulty && (
                                        <>
                                            <span className="text-muted-foreground/30 text-xs">·</span>
                                            <span
                                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DIFFICULTY_COLORS[material.difficulty]}`}
                                            >
                                                {material.difficulty.charAt(0) + material.difficulty.slice(1).toLowerCase()}
                                            </span>
                                        </>
                                    )}
                                </div>

                                <p className="text-[11px] text-muted-foreground/60 mt-auto">
                                    Purchased{' '}
                                    {new Date(purchasedAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                </p>
                            </Link>
                        ))}
                    </div>
                </>
            )}
        </DashboardShell>
    );
}
