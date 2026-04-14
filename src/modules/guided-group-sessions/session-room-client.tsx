'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/src/lib/utils';
import { StarRating } from '@/src/components/ui/star-rating';
import { sanitizeRichTextHtml } from '@/src/security/validation';
import { splitObjectives } from '@/src/modules/materials/utils';
import { useI18n } from '@/src/i18n/i18n-provider';

type MaterialLite = {
  id: string;
  title: string;
  objectives: string | null;
  content: string;
  materialType: 'TEXTUAL' | 'PRACTICE_TEST';
  subjectId: string;
  topicId: string;
  difficulty: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | null;
};

type EnrollmentLite = {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarVariant: string | null;
  };
};

type StrokePoint = { x: number; y: number };
type WhiteboardStroke = {
  id: string;
  color: string;
  width: number;
  points: StrokePoint[];
  createdAt?: number;
  createdBy?: string;
};

function safeExtractStrokes(raw: unknown): WhiteboardStroke[] {
  const obj = raw as { strokes?: unknown } | null;
  const strokesRaw = obj && typeof obj === 'object' ? obj.strokes : null;
  return Array.isArray(strokesRaw) ? (strokesRaw as WhiteboardStroke[]) : [];
}

function mergeStrokeLists(local: WhiteboardStroke[], remote: WhiteboardStroke[]) {
  const map = new Map<string, WhiteboardStroke>();
  for (const stroke of local) map.set(stroke.id, stroke);
  for (const stroke of remote) {
    if (!map.has(stroke.id)) map.set(stroke.id, stroke);
  }
  return Array.from(map.values());
}

function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getPracticePreview(content: string) {
  try {
    const parsed = JSON.parse(content) as { questions?: Array<{ question?: string; options?: Array<{ text?: string }> }> };
    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    return questions.slice(0, 4).map((q) => ({
      questionHtml: sanitizeRichTextHtml(q?.question ?? '<p>—</p>'),
      options: Array.isArray(q?.options)
        ? q.options.slice(0, 6).map((opt) => sanitizeRichTextHtml(opt?.text ?? '<p>—</p>'))
        : [],
    }));
  } catch {
    return [];
  }
}

function safeExtractErrorMessage(raw: unknown): string | null {
  const obj = raw as { error?: unknown } | null;
  const error = obj && typeof obj === 'object' ? obj.error : null;
  return typeof error === 'string' && error.trim() ? error.trim() : null;
}

function WhiteboardCanvas({
  strokes,
  canDraw,
  onAppendStroke,
}: {
  strokes: WhiteboardStroke[];
  canDraw: boolean;
  onAppendStroke: (stroke: WhiteboardStroke) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 1, h: 1 });
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const activeStrokeRef = useRef<WhiteboardStroke | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    for (const stroke of strokes) {
      if (!stroke.points || stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      const [first, ...rest] = stroke.points;
      ctx.moveTo(first.x * w, first.y * h);
      for (const p of rest) {
        ctx.lineTo(p.x * w, p.y * h);
      }
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctxRef.current = ctx;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      sizeRef.current = { w, h };

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    };

    const obs = new ResizeObserver(() => resize());
    obs.observe(container);
    resize();
    return () => obs.disconnect();
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    const y = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };

  const drawSegment = (stroke: WhiteboardStroke) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const pts = stroke.points;
    if (pts.length < 2) return;
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x * w, a.y * h);
    ctx.lineTo(b.x * w, b.y * h);
    ctx.stroke();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    const stroke: WhiteboardStroke = {
      id: uid(),
      color: '#111827',
      width: 2.5,
      points: [getPoint(event)],
      createdAt: Date.now(),
    };
    activeStrokeRef.current = stroke;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    const stroke = activeStrokeRef.current;
    if (!stroke) return;
    stroke.points.push(getPoint(event));
    drawSegment(stroke);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    const stroke = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (!stroke || stroke.points.length < 2) return;
    onAppendStroke(stroke);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={containerRef} className="h-full w-full rounded-lg border border-border bg-background overflow-hidden">
      <canvas
        ref={canvasRef}
        className={cn('h-full w-full', canDraw ? 'cursor-crosshair' : 'cursor-default')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
}

export function GuidedGroupSessionRoomClient({
  session,
  isFacilitator,
  myEnrollmentStatus,
  initialActiveMaterial,
  initialWhiteboardData,
  initialMyFacilitatorFeedback,
  initialLearnerFeedback,
}: {
  session: {
    id: string;
    title: string;
    subjectId: string;
    topicId: string;
    objectives: string | null;
    scheduledAt: string;
    durationMinutes: number;
    learnerCapacity: number;
    status: string;
    ratingAvg: number;
    ratingCount: number;
    facilitator: { id: string; name: string; avatarVariant: string | null };
    learners: EnrollmentLite[];
  };
  isFacilitator: boolean;
  myEnrollmentStatus: string | null;
  initialActiveMaterial: MaterialLite | null;
  initialWhiteboardData: unknown;
  initialMyFacilitatorFeedback: { rating: number; comment: string | null } | null;
  initialLearnerFeedback: Record<string, { sentiment: 'GOOD' | 'BAD'; note: string | null }>;
}) {
  const { messages } = useI18n();
  const toastCopy = messages.app?.guidedGroupSessions?.sessionRoom?.toasts;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeMaterial, setActiveMaterial] = useState<MaterialLite | null>(initialActiveMaterial);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>(() =>
    safeExtractStrokes(initialWhiteboardData),
  );
  const [busy, setBusy] = useState(false);
  const [materials, setMaterials] = useState<Array<{ id: string; title: string; status: string; materialType: string }>>([]);
  const [materialsQuery, setMaterialsQuery] = useState('');

  const [myRating, setMyRating] = useState<number>(initialMyFacilitatorFeedback?.rating ?? 0);
  const [myComment, setMyComment] = useState<string>(initialMyFacilitatorFeedback?.comment ?? '');
  const [savingRating, setSavingRating] = useState(false);

  const [learnerFeedback, setLearnerFeedback] = useState(initialLearnerFeedback);
  const [savingLearnerId, setSavingLearnerId] = useState<string | null>(null);

  const objectiveLines = useMemo(() => splitObjectives(session.objectives), [session.objectives]);
  const canDraw = session.status === 'LIVE' && (isFacilitator || myEnrollmentStatus === 'APPROVED');
  const practicePreview = useMemo(
    () =>
      activeMaterial && activeMaterial.materialType === 'PRACTICE_TEST'
        ? getPracticePreview(activeMaterial.content)
        : [],
    [activeMaterial],
  );

  const refreshState = useCallback(async () => {
    try {
      const res = await fetch(`/api/guided-group-sessions/${encodeURIComponent(session.id)}/state`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const remoteStrokes = safeExtractStrokes(data?.session?.whiteboardData);
      setStrokes((prev) => mergeStrokeLists(prev, remoteStrokes));
      setActiveMaterial(data?.activeMaterial ?? null);
    } catch {
      /* ignore */
    }
  }, [session.id]);

  useEffect(() => {
    void refreshState();
    const id = window.setInterval(() => void refreshState(), 2500);
    return () => window.clearInterval(id);
  }, [refreshState]);

  useEffect(() => {
    if (!isFacilitator) return;
    fetch('/api/materials/my-drafts', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!Array.isArray(data)) return;
        setMaterials(
          data.map((m: any) => ({
            id: String(m.id),
            title: String(m.title ?? 'Untitled'),
            status: String(m.status ?? 'DRAFT'),
            materialType: String(m.materialType ?? 'TEXTUAL'),
          })),
        );
      })
      .catch(() => setMaterials([]));
  }, [isFacilitator]);

  const filteredMaterials = useMemo(() => {
    const q = materialsQuery.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((m) => m.title.toLowerCase().includes(q));
  }, [materials, materialsQuery]);

  const appendStroke = useCallback(
    async (stroke: WhiteboardStroke) => {
      setStrokes((prev) => mergeStrokeLists(prev, [stroke]));
      try {
        await fetch(`/api/guided-group-sessions/${encodeURIComponent(session.id)}/state`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appendStrokes: [{ ...stroke }] }),
        });
      } catch {
        /* ignore */
      }
    },
    [session.id],
  );

  const selectMaterial = async (materialId: string | null) => {
    if (!isFacilitator) return;
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/guided-group-sessions/${encodeURIComponent(session.id)}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeMaterialId: materialId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          safeExtractErrorMessage(data) ??
            toastCopy?.materialUpdateFailed ??
            'Failed to update material.',
        );
        return;
      }
      await refreshState();
      toast.success(toastCopy?.materialUpdated ?? 'Material updated.');
    } catch {
      toast.error(toastCopy?.materialUpdateFailed ?? 'Failed to update material.');
    } finally {
      setBusy(false);
    }
  };

  const submitRating = async () => {
    if (savingRating) return;
    if (myRating < 1 || myRating > 5) {
      toast.error(toastCopy?.starRatingRequired ?? 'Please select a star rating.');
      return;
    }
    setSavingRating(true);
    try {
      const res = await fetch(
        `/api/guided-group-sessions/${encodeURIComponent(session.id)}/facilitator-feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: myRating, comment: myComment.trim() || null }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(safeExtractErrorMessage(data) ?? toastCopy?.ratingSaveFailed ?? 'Failed to save rating.');
        return;
      }
      toast.success(toastCopy?.feedbackThanks ?? 'Thanks for the feedback!');
    } catch {
      toast.error(toastCopy?.ratingSaveFailed ?? 'Failed to save rating.');
    } finally {
      setSavingRating(false);
    }
  };

  const saveLearnerFeedback = async (learnerId: string) => {
    if (!isFacilitator) return;
    if (savingLearnerId) return;
    const entry = learnerFeedback[learnerId];
    if (!entry?.sentiment) return;

    setSavingLearnerId(learnerId);
    try {
      const res = await fetch(
        `/api/guided-group-sessions/${encodeURIComponent(session.id)}/learner-feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            learnerId,
            sentiment: entry.sentiment,
            note: entry.note?.trim() || null,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          safeExtractErrorMessage(data) ??
            toastCopy?.learnerFeedbackSaveFailed ??
            'Failed to save learner feedback.',
        );
        return;
      }
      toast.success(toastCopy?.saved ?? 'Saved.');
    } catch {
      toast.error(toastCopy?.learnerFeedbackSaveFailed ?? 'Failed to save learner feedback.');
    } finally {
      setSavingLearnerId(null);
    }
  };

  const showFeedback = session.status === 'COMPLETED';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {session.facilitator.name} · {session.status}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={refreshState}>
              Refresh
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              {sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            </Button>
          </div>
        </div>

        <WhiteboardCanvas strokes={strokes} canDraw={canDraw} onAppendStroke={appendStroke} />

        {activeMaterial ? (
          <Card className="card-frame bg-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{activeMaterial.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {activeMaterial.materialType === 'PRACTICE_TEST' ? 'Practice test' : 'Textual material'}
                  </p>
                </div>
                {isFacilitator ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void selectMaterial(null)}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>

              {activeMaterial.objectives ? (
                <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {activeMaterial.objectives}
                </div>
              ) : null}

              <div
                className="max-h-[420px] overflow-auto rounded-md border border-border bg-background p-3"
              >
                {activeMaterial.materialType === 'TEXTUAL' ? (
                  <div
                    className="document-editor-content"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(activeMaterial.content) }}
                  />
                ) : practicePreview.length > 0 ? (
                  <div className="space-y-4">
                    {practicePreview.map((q, idx) => (
                      <div key={idx} className="space-y-2">
                        <p className="text-[11px] font-medium uppercase text-muted-foreground">
                          Question {idx + 1}
                        </p>
                        <div
                          className="document-editor-content practice-test-content text-foreground"
                          dangerouslySetInnerHTML={{ __html: q.questionHtml }}
                        />
                        {q.options.length > 0 ? (
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {q.options.map((opt, optIdx) => (
                              <li key={optIdx} className="flex items-start gap-2">
                                <span className="mt-0.5 text-[11px] font-medium text-foreground/80">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                <div
                                  className="document-editor-content practice-test-content text-foreground"
                                  dangerouslySetInnerHTML={{ __html: opt }}
                                />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Preview is not available.</p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {showFeedback && !isFacilitator ? (
          <Card className="card-frame bg-card">
            <CardContent className="p-5 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Rate your facilitator</p>
                <p className="text-xs text-muted-foreground">
                  Please leave a rating for this guided group session.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StarRating value={myRating} onChange={setMyRating} />
                <span className="text-xs text-muted-foreground">{myRating}/5</span>
              </div>
              <textarea
                value={myComment}
                onChange={(e) => setMyComment(e.target.value)}
                rows={3}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'placeholder:text-muted-foreground/80',
                  'transition-colors duration-150',
                  'focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40',
                )}
                placeholder="Optional comment"
              />
              <Button
                size="sm"
                variant="secondary-primary"
                onClick={submitRating}
                disabled={savingRating}
              >
                {savingRating ? 'Saving…' : 'Submit rating'}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {showFeedback && isFacilitator ? (
          <Card className="card-frame bg-card">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Learner feedback</p>
                <p className="text-xs text-muted-foreground">
                  Optionally mark good or bad behavior for learners.
                </p>
              </div>
              <div className="space-y-3">
                {session.learners.map((row) => {
                  const learner = row.user;
                  const name =
                    [learner.firstName, learner.lastName].filter(Boolean).join(' ') ||
                    learner.email.split('@')[0];
                  const value = learnerFeedback[learner.id] ?? { sentiment: 'GOOD' as const, note: null };
                  const isSaving = savingLearnerId === learner.id;
                  return (
                    <div key={learner.id} className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{learner.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={value.sentiment === 'GOOD' ? 'secondary-primary' : 'outline'}
                            onClick={() =>
                              setLearnerFeedback((prev) => ({
                                ...prev,
                                [learner.id]: { ...value, sentiment: 'GOOD' },
                              }))
                            }
                            disabled={isSaving}
                          >
                            Good
                          </Button>
                          <Button
                            size="sm"
                            variant={value.sentiment === 'BAD' ? 'destructive' : 'outline'}
                            onClick={() =>
                              setLearnerFeedback((prev) => ({
                                ...prev,
                                [learner.id]: { ...value, sentiment: 'BAD' },
                              }))
                            }
                            disabled={isSaving}
                          >
                            Bad
                          </Button>
                        </div>
                      </div>

                      <Input
                        value={value.note ?? ''}
                        onChange={(e) =>
                          setLearnerFeedback((prev) => ({
                            ...prev,
                            [learner.id]: { ...value, note: e.target.value },
                          }))
                        }
                        placeholder="Optional note"
                        disabled={isSaving}
                      />

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void saveLearnerFeedback(learner.id)}
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {sidebarOpen ? (
        <div className="space-y-3">
          <Card className="card-frame bg-card">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Objectives</p>
              {objectiveLines.length === 0 ? (
                <p className="text-xs text-muted-foreground">No objectives listed.</p>
              ) : (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {objectiveLines.map((line, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                      <span className="leading-relaxed">{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="card-frame bg-card">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">
                {isFacilitator ? 'Share a material' : 'Shared material'}
              </p>
              {isFacilitator ? (
                <>
                  <Input
                    value={materialsQuery}
                    onChange={(e) => setMaterialsQuery(e.target.value)}
                    placeholder="Search your materials…"
                    disabled={busy}
                  />
                  <div className="max-h-[420px] overflow-auto rounded-lg border border-border">
                    {filteredMaterials.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground">No materials found.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {filteredMaterials.slice(0, 50).map((m) => (
                          <li key={m.id} className="p-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {m.status} · {m.materialType}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void selectMaterial(m.id)}
                            >
                              Show
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : activeMaterial ? (
                <p className="text-xs text-muted-foreground">
                  {activeMaterial.title}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No shared material yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="card-frame bg-card">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Participants</p>
              <p className="text-xs text-muted-foreground">
                {session.learners.length}/{session.learnerCapacity} learners
              </p>
              <ul className="space-y-1">
                {session.learners.map((row) => {
                  const learner = row.user;
                  const name =
                    [learner.firstName, learner.lastName].filter(Boolean).join(' ') ||
                    learner.email.split('@')[0];
                  return (
                    <li key={learner.id} className="text-xs text-muted-foreground truncate">
                      {name}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
