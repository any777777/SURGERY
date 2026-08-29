"use client";

import Image from "next/image";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flag,
  ListChecks,
  RotateCcw,
  Search,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { demoQbank } from "@/data/demo-qbank";
import type { StudyChapter, StudyQbank, StudyQuestion } from "@/lib/types";

type Mode = "practice" | "topics" | "review" | "progress";

type AnswerRecord = {
  selected: string[];
  correct: boolean;
};

const STORAGE_KEY = "surgery-qbank-progress-v1";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function publicPath(path: string) {
  return `${BASE_PATH}${path}`;
}

function sameAnswers(left: string[], right: string[]) {
  const a = [...left].sort().join(",");
  const b = [...right].sort().join(",");
  return a === b;
}

function questionLabel(question: StudyQuestion) {
  return `Chapter ${question.chapterNumber}, Question ${question.number}`;
}

function optionTone({
  option,
  selected,
  submitted,
  question,
}: {
  option: string;
  selected: boolean;
  submitted: boolean;
  question: StudyQuestion;
}) {
  if (!submitted) {
    return selected
      ? "border-[var(--primary)] bg-[oklch(0.96_0.025_160)] text-[var(--ink)]"
      : "border-[var(--border)] bg-white text-[var(--ink)] hover:border-[var(--primary)]";
  }

  const isCorrect = question.answers.includes(option);
  if (isCorrect) {
    return "border-[var(--success)] bg-[oklch(0.95_0.035_150)] text-[var(--ink)]";
  }

  if (selected) {
    return "border-[var(--danger)] bg-[oklch(0.96_0.035_25)] text-[var(--ink)]";
  }

  return "border-[var(--border)] bg-white text-[var(--muted)]";
}

export function StudyAppLoader() {
  const [qbank, setQbank] = useState<StudyQbank | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(publicPath("/qbank.json"), { cache: "force-cache" });
        if (!response.ok) {
          throw new Error(`Unable to load qbank: ${response.status}`);
        }

        const nextQbank = (await response.json()) as StudyQbank;
        if (!cancelled) {
          setQbank(nextQbank);
        }
      } catch {
        if (!cancelled) {
          setQbank(demoQbank);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (qbank) {
    return <StudyApp qbank={qbank} />;
  }

  return (
    <main
      data-testid="study-shell"
      data-study-ready="false"
      className="grid min-h-dvh place-items-center bg-[var(--bg)] px-5 text-center text-[var(--ink)]"
    >
      <div className="max-w-sm">
        <BookOpen className="mx-auto h-8 w-8 text-[var(--primary)]" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">Surgery Qbank</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Loading study questions...</p>
      </div>
    </main>
  );
}

function ChapterButton({
  chapter,
  active,
  answered,
  total,
  onClick,
}: {
  chapter: StudyChapter;
  active: boolean;
  answered: number;
  total: number;
  onClick: () => void;
}) {
  const progress = total ? Math.round((answered / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition ${
        active
          ? "border-[var(--primary)] bg-[oklch(0.96_0.023_160)]"
          : "border-[var(--border)] bg-white hover:border-[var(--primary)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">
            {chapter.number}. {chapter.title}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {answered} of {total} complete
          </p>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[var(--primary-strong)]">
          {progress}%
        </span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-[var(--surface-strong)]">
        <div
          className="h-full rounded-full bg-[var(--primary)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </button>
  );
}

export function StudyApp({ qbank }: { qbank: StudyQbank }) {
  const allQuestions = useMemo(
    () => qbank.chapters.flatMap((chapter) => chapter.questions),
    [qbank.chapters],
  );
  const firstQuestion = allQuestions[0];

  const [mode, setMode] = useState<Mode>("practice");
  const [activeChapterId, setActiveChapterId] = useState(qbank.chapters[0]?.id ?? "");
  const [currentId, setCurrentId] = useState(firstQuestion?.id ?? "");
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [draftSelections, setDraftSelections] = useState<Record<string, string[]>>({});
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          mode?: Mode;
          activeChapterId?: string;
          currentId?: string;
          answers?: Record<string, AnswerRecord>;
          flagged?: Record<string, boolean>;
        };
        if (saved.mode) setMode(saved.mode);
        if (saved.activeChapterId) setActiveChapterId(saved.activeChapterId);
        if (saved.currentId) setCurrentId(saved.currentId);
        if (saved.answers) setAnswers(saved.answers);
        if (saved.flagged) setFlagged(saved.flagged);
      }
    } finally {
      setMounted(true);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mode, activeChapterId, currentId, answers, flagged }),
    );
  }, [activeChapterId, answers, currentId, flagged, mode, mounted]);

  const chapterStats = useMemo(() => {
    return qbank.chapters.map((chapter) => {
      const answered = chapter.questions.filter((question) => answers[question.id]).length;
      const correct = chapter.questions.filter((question) => answers[question.id]?.correct).length;
      return { chapter, answered, correct, total: chapter.questions.length };
    });
  }, [answers, qbank.chapters]);

  const activeChapter = qbank.chapters.find((chapter) => chapter.id === activeChapterId) ?? qbank.chapters[0];
  const normalizedQuery = query.trim().toLowerCase();

  const practicePool = useMemo(() => {
    const base = activeChapter ? activeChapter.questions : allQuestions;
    if (!normalizedQuery) return base;
    return base.filter((question) => {
      const haystack = `${question.chapterTitle} ${question.number} ${question.stem} ${question.groupContext}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activeChapter, allQuestions, normalizedQuery]);

  const reviewPool = useMemo(
    () => allQuestions.filter((question) => flagged[question.id] || answers[question.id]?.correct === false),
    [allQuestions, answers, flagged],
  );

  const questionPool = mode === "review" ? reviewPool : practicePool;
  const activeQuestion = questionPool.find((question) => question.id === currentId) ?? questionPool[0] ?? firstQuestion;
  const answerRecord = activeQuestion ? answers[activeQuestion.id] : undefined;
  const submitted = Boolean(answerRecord);
  const draftSelected = activeQuestion ? draftSelections[activeQuestion.id] ?? [] : [];
  const selectedKeys = submitted ? answerRecord?.selected ?? [] : draftSelected;
  const isMulti = activeQuestion ? activeQuestion.answers.length > 1 : false;
  const currentIndex = activeQuestion ? questionPool.findIndex((question) => question.id === activeQuestion.id) : -1;
  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((answer) => answer.correct).length;
  const accuracy = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0;

  function chooseChapter(chapter: StudyChapter) {
    setActiveChapterId(chapter.id);
    setMode("practice");
    setQuery("");
    setCurrentId(chapter.questions[0]?.id ?? "");
  }

  function chooseQuestion(question: StudyQuestion) {
    setActiveChapterId(`chapter-${question.chapterNumber}`);
    setCurrentId(question.id);
    setMode("practice");
  }

  function toggleOption(key: string) {
    if (!activeQuestion || submitted) return;
    if (isMulti) {
      setDraftSelections((current) => {
        const selectedForQuestion = current[activeQuestion.id] ?? [];
        const nextSelected = selectedForQuestion.includes(key)
          ? selectedForQuestion.filter((item) => item !== key)
          : [...selectedForQuestion, key];
        return { ...current, [activeQuestion.id]: nextSelected };
      });
      return;
    }
    setDraftSelections((current) => ({ ...current, [activeQuestion.id]: [key] }));
  }

  function submitAnswer() {
    if (!activeQuestion || draftSelected.length === 0) return;
    const correct = sameAnswers(draftSelected, activeQuestion.answers);
    setAnswers((current) => ({
      ...current,
      [activeQuestion.id]: { selected: [...draftSelected], correct },
    }));
  }

  function clearAnswer() {
    if (!activeQuestion) return;
    setAnswers((current) => {
      const next = { ...current };
      delete next[activeQuestion.id];
      return next;
    });
    setDraftSelections((current) => {
      const next = { ...current };
      delete next[activeQuestion.id];
      return next;
    });
  }

  function goToOffset(offset: number) {
    if (!questionPool.length) return;
    const nextIndex = Math.min(Math.max(currentIndex + offset, 0), questionPool.length - 1);
    setCurrentId(questionPool[nextIndex].id);
  }

  function toggleFlag() {
    if (!activeQuestion) return;
    setFlagged((current) => ({ ...current, [activeQuestion.id]: !current[activeQuestion.id] }));
  }

  function resetProgress() {
    setAnswers({});
    setFlagged({});
    setDraftSelections({});
    setCurrentId(firstQuestion?.id ?? "");
    setMode("practice");
  }

  if (!activeQuestion) {
    return (
      <main
        data-testid="study-shell"
        data-study-ready={mounted ? "true" : "false"}
        className="grid min-h-dvh place-items-center bg-[var(--bg)] px-5 text-center text-[var(--ink)]"
      >
        <div className="max-w-sm">
          <BookOpen className="mx-auto h-8 w-8 text-[var(--primary)]" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold">Your study set is ready for new questions.</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Add a chapter and begin a focused practice session.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      data-testid="study-shell"
      data-study-ready={mounted ? "true" : "false"}
      className="min-h-dvh bg-[var(--bg)] pb-24 text-[var(--ink)] md:pb-0"
    >
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
              <h1 className="truncate text-base font-semibold md:text-lg">Surgery Qbank</h1>
            </div>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {answeredCount} of {allQuestions.length} answered
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-lg border border-[var(--border)] px-3 py-2 text-sm md:block">
              <span className="font-semibold">{accuracy}%</span> accuracy
            </div>
            <button
              type="button"
              onClick={resetProgress}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
              title="Reset progress"
              aria-label="Reset progress"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-4 md:grid-cols-[280px_minmax(0,1fr)] md:px-6 md:py-6">
        <aside className="hidden md:block">
          <div className="sticky top-20 space-y-3">
            <div className="rounded-lg border border-[var(--border)] bg-white p-3">
              <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                <Search className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search questions"
                  className="min-w-0 flex-1 bg-transparent text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                />
              </label>
            </div>
            <div className="space-y-2">
              {chapterStats.map(({ chapter, answered, total }) => (
                <ChapterButton
                  key={chapter.id}
                  chapter={chapter}
                  active={chapter.id === activeChapterId}
                  answered={answered}
                  total={total}
                  onClick={() => chooseChapter(chapter)}
                />
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 hidden gap-2 md:flex">
            <ModeButton icon={BookOpen} label="Practice" active={mode === "practice"} onClick={() => setMode("practice")} />
            <ModeButton icon={ListChecks} label="Topics" active={mode === "topics"} onClick={() => setMode("topics")} />
            <ModeButton icon={Flag} label="Review" active={mode === "review"} onClick={() => setMode("review")} />
            <ModeButton icon={BarChart3} label="Progress" active={mode === "progress"} onClick={() => setMode("progress")} />
          </div>

          {mode === "topics" ? (
            <TopicsView
              chapterStats={chapterStats}
              query={query}
              setQuery={setQuery}
              onChapter={chooseChapter}
              onQuestion={chooseQuestion}
            />
          ) : mode === "progress" ? (
            <ProgressView
              answeredCount={answeredCount}
              correctCount={correctCount}
              total={allQuestions.length}
              chapterStats={chapterStats}
            />
          ) : mode === "review" && reviewPool.length === 0 ? (
            <EmptyReview />
          ) : (
            <QuestionView
              question={activeQuestion}
              currentIndex={Math.max(currentIndex, 0)}
              total={questionPool.length}
              submitted={submitted}
              selectedKeys={selectedKeys}
              isMulti={isMulti}
              flagged={Boolean(flagged[activeQuestion.id])}
              answerRecord={answerRecord}
              onSelect={toggleOption}
              onSubmit={submitAnswer}
              onClear={clearAnswer}
              onFlag={toggleFlag}
              onPrev={() => goToOffset(-1)}
              onNext={() => goToOffset(1)}
            />
          )}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-white px-3 py-2 md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          <MobileNavButton icon={BookOpen} label="Practice" active={mode === "practice"} onClick={() => setMode("practice")} />
          <MobileNavButton icon={ListChecks} label="Topics" active={mode === "topics"} onClick={() => setMode("topics")} />
          <MobileNavButton icon={Flag} label="Review" active={mode === "review"} onClick={() => setMode("review")} />
          <MobileNavButton icon={BarChart3} label="Progress" active={mode === "progress"} onClick={() => setMode("progress")} />
        </div>
      </nav>
    </main>
  );
}

function QuestionView({
  question,
  currentIndex,
  total,
  submitted,
  selectedKeys,
  isMulti,
  flagged,
  answerRecord,
  onSelect,
  onSubmit,
  onClear,
  onFlag,
  onPrev,
  onNext,
}: {
  question: StudyQuestion;
  currentIndex: number;
  total: number;
  submitted: boolean;
  selectedKeys: string[];
  isMulti: boolean;
  flagged: boolean;
  answerRecord?: AnswerRecord;
  onSelect: (key: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onFlag: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const visibleGroupContext = question.groupContext
    .replace(/^Questions?\s+\d+\s*(?:[-]|through|to|and)\s*\d+\b/i, "")
    .trim();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[var(--primary-strong)]">{questionLabel(question)}</p>
              <h2 className="mt-1 text-lg font-semibold leading-7 text-[var(--ink)]">{question.chapterTitle}</h2>
            </div>
            <button
              type="button"
              onClick={onFlag}
              className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
                flagged
                  ? "border-[var(--accent)] bg-[oklch(0.96_0.035_35)] text-[var(--ink)]"
                  : "border-[var(--border)] bg-white text-[var(--muted)]"
              }`}
              aria-pressed={flagged}
            >
              <Flag className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Flag</span>
            </button>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-[var(--surface-strong)]">
            <div
              className="h-full rounded-full bg-[var(--primary)]"
              style={{ width: `${total ? ((currentIndex + 1) / total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="space-y-5 px-4 py-4">
          {visibleGroupContext ? (
            <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm leading-6 text-[var(--ink)]">
              {visibleGroupContext}
            </p>
          ) : null}

          <p className="text-base leading-7 text-[var(--ink)] md:text-lg md:leading-8">{question.stem}</p>

          {question.figures.length ? (
            <div className="grid gap-3">
              {question.figures.map((figure, index) => (
                <figure key={figure.id} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                  <Image
                    src={publicPath(figure.path)}
                    alt="Clinical figure"
                    width={Math.max(320, Math.round((figure.width ?? 320) * 2))}
                    height={Math.max(220, Math.round((figure.height ?? 220) * 2))}
                    className="h-auto w-full object-contain"
                    priority={currentIndex === 0 && index === 0}
                    unoptimized
                  />
                </figure>
              ))}
            </div>
          ) : null}

          <div className="space-y-2" role="group" aria-label="Answer choices">
            {isMulti ? <p className="text-sm font-medium text-[var(--muted)]">Select all that apply.</p> : null}
            {question.options.map((option) => {
              const selected = selectedKeys.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  data-testid={`option-${option.key}`}
                  onClick={() => onSelect(option.key)}
                  disabled={submitted}
                  className={`flex min-h-12 w-full items-start gap-3 rounded-lg border px-3 py-3 text-left text-sm leading-6 transition ${optionTone({
                    option: option.key,
                    selected,
                    submitted,
                    question,
                  })}`}
                  aria-pressed={selected}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
                    {option.key}
                  </span>
                  <span>{option.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[var(--border)] px-4 py-3">
          {!submitted ? (
            <button
              type="button"
              data-testid="submit-answer"
              onClick={onSubmit}
              disabled={selectedKeys.length === 0}
              className="h-12 w-full rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:bg-[var(--surface-strong)] disabled:text-[var(--muted)]"
            >
              Submit answer
            </button>
          ) : (
            <div className="space-y-3">
              <div
                className={`rounded-lg border p-3 ${
                  answerRecord?.correct
                    ? "border-[var(--success)] bg-[oklch(0.95_0.035_150)]"
                    : "border-[var(--danger)] bg-[oklch(0.96_0.035_25)]"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {answerRecord?.correct ? (
                    <CheckCircle2 className="h-5 w-5 text-[var(--success)]" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-5 w-5 text-[var(--danger)]" aria-hidden="true" />
                  )}
                  {answerRecord?.correct ? "Correct" : "Review this one"}
                </div>
                <p className="mt-2 text-sm leading-6">
                  <span className="font-semibold">Best answer: </span>
                  {question.answerText}
                </p>
              </div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <h3 className="text-sm font-semibold">Clinical note</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ink)]">{question.explanation}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={onPrev}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white text-sm font-medium"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white text-sm font-medium"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Retry
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] text-sm font-semibold text-white sm:col-span-2"
                >
                  Next question
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopicsView({
  chapterStats,
  query,
  setQuery,
  onChapter,
  onQuestion,
}: {
  chapterStats: Array<{ chapter: StudyChapter; answered: number; correct: number; total: number }>;
  query: string;
  setQuery: (value: string) => void;
  onChapter: (chapter: StudyChapter) => void;
  onQuestion: (question: StudyQuestion) => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-sm">
        <Search className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search topics or questions"
          className="min-w-0 flex-1 bg-transparent text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
        />
      </label>

      {chapterStats.map(({ chapter, answered, total }) => {
        const matchingQuestions = normalizedQuery
          ? chapter.questions.filter((question) =>
              `${question.chapterTitle} ${question.number} ${question.stem}`.toLowerCase().includes(normalizedQuery),
            )
          : chapter.questions;

        if (normalizedQuery && matchingQuestions.length === 0) return null;

        return (
          <section key={chapter.id} className="rounded-lg border border-[var(--border)] bg-white">
            <button type="button" onClick={() => onChapter(chapter)} className="w-full p-4 text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">
                    {chapter.number}. {chapter.title}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {answered} of {total} complete
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-[var(--muted)]" aria-hidden="true" />
              </div>
            </button>
            <div className="border-t border-[var(--border)] px-2 py-2">
              {matchingQuestions.map((question) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => onQuestion(question)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm leading-6 hover:bg-[var(--surface)]"
                >
                  <span className="font-semibold">Q{question.number}.</span> {question.stem}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ProgressView({
  answeredCount,
  correctCount,
  total,
  chapterStats,
}: {
  answeredCount: number;
  correctCount: number;
  total: number;
  chapterStats: Array<{ chapter: StudyChapter; answered: number; correct: number; total: number }>;
}) {
  const accuracy = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0;
  const completion = total ? Math.round((answeredCount / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Complete" value={`${completion}%`} detail={`${answeredCount} of ${total}`} />
        <Metric label="Accuracy" value={`${accuracy}%`} detail={`${correctCount} correct`} />
        <Metric label="Remaining" value={`${Math.max(total - answeredCount, 0)}`} detail="questions" />
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-4">
          <h2 className="text-base font-semibold">Chapter performance</h2>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {chapterStats.map(({ chapter, answered, correct, total: chapterTotal }) => {
            const chapterAccuracy = answered ? Math.round((correct / answered) * 100) : 0;
            return (
              <div key={chapter.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {chapter.number}. {chapter.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {answered} of {chapterTotal} answered
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{chapterAccuracy}%</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-[var(--surface-strong)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${chapterTotal ? (answered / chapterTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function EmptyReview() {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-white p-6 text-center">
      <Flag className="mx-auto h-8 w-8 text-[var(--primary)]" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-semibold">No review items yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
        Missed and flagged questions will appear here for focused revision.
      </p>
    </section>
  );
}

function MobileNavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof BookOpen;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`mode-${label.toLowerCase()}`}
      onClick={onClick}
      className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium ${
        active ? "bg-[oklch(0.95_0.025_160)] text-[var(--primary-strong)]" : "text-[var(--muted)]"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function ModeButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof BookOpen;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`mode-${label.toLowerCase()}`}
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
        active
          ? "border-[var(--primary)] bg-[oklch(0.95_0.025_160)] text-[var(--primary-strong)]"
          : "border-[var(--border)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
