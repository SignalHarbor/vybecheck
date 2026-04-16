import { useState, useEffect, useRef } from 'react';
import { Mic, ChevronDown, X, Send, Trash2, FlaskConical, Radio } from 'lucide-react';
import { useDraftStore, type DraftQuestion } from '../store/draftStore';
import { useWebSocketStore } from '../store/websocketStore';
import { useUIStore } from '../store/uiStore';
import { useQuizStore } from '../store/quizStore';
import { useAuthStore } from '../store/authStore';
import { Header } from '../components/Header';
import { DraftQuestionCard } from '../components/DraftQuestionCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useFeatures } from '../utils/features';
import { haptic } from '../utils/haptic';
import type { GeneratedQuestion } from '../../server/services/QuestionGeneratorService';

const QUESTION_LIMIT_UPGRADE_COST = 3;
const DEFAULT_QUESTION_LIMIT = 3;

export function LabPage() {
  const { enableAIGeneration } = useFeatures();
  const { draftQuestions, addDraft, removeDraft, clearDrafts, setOwnerResponse, reorderDrafts } = useDraftStore();
  const { send } = useWebSocketStore();
  const { showNotification, showError, setActivePage } = useUIStore();
  const { sessionId, quizState, questionLimitState, isOwner } = useQuizStore();
  const { getQuestionLimit, vybesBalance, hasUpgradedQuestionLimit, twitterUsername } = useAuthStore();
  const [isUnlocking, setIsUnlocking] = useState(false);

  const [draggedDraftIndex, setDraggedDraftIndex] = useState<number | null>(null);

  const questionInputRef = useRef<HTMLTextAreaElement>(null);

  const [questionPrompt, setQuestionPrompt] = useState('');
  const [option1, setOption1] = useState('');
  const [option2, setOption2] = useState('');
  const [ownerResponse, setOwnerResponseState] = useState<string>('');
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showCreateSessionDialog, setShowCreateSessionDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingPublish, setPendingPublish] = useState(false);
  const [pendingNeedsUpgrade, setPendingNeedsUpgrade] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [removingDraftIds, setRemovingDraftIds] = useState<Set<string>>(new Set());
  const prevSessionIdRef = useRef<string | null>(null);
  const [showFloatingPublish, setShowFloatingPublish] = useState(false);
  const publishButtonRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // AI Generation state
  const [showAISection, setShowAISection] = useState(false);
  const [testFiles, setTestFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');

  useEffect(() => {
    if (showAISection && testFiles.length === 0) {
      fetch('/api/ai/test-files')
        .then(res => res.json())
        .then((data: { files: string[] }) => setTestFiles(data.files))
        .catch(() => showError('Failed to load test audio files'));
    }
  }, [showAISection]);

  const hasActiveSession = Boolean(sessionId && quizState && quizState.status !== 'expired');

  useEffect(() => {
    if (pendingPublish && sessionId && sessionId !== prevSessionIdRef.current) {
      const questionsToPublish = [...draftQuestions];
      if (pendingNeedsUpgrade) {
        send({ type: 'question:unlock-limit' });
        setPendingNeedsUpgrade(false);
      }
      questionsToPublish.forEach(draft => {
        send({
          type: 'question:add',
          data: { prompt: draft.prompt, options: draft.options, ownerResponse: draft.ownerResponse }
        });
      });
      clearDrafts();
      setPendingPublish(false);
      showNotification(`Session created with ${questionsToPublish.length} question(s)`);
    }
    prevSessionIdRef.current = sessionId;
  }, [sessionId, pendingPublish, pendingNeedsUpgrade, draftQuestions, send, clearDrafts, showNotification]);

  // Show floating publish FAB when top publish button scrolls out of view
  useEffect(() => {
    const btn = publishButtonRef.current;
    const container = scrollContainerRef.current;
    if (!btn || !container) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowFloatingPublish(!entry.isIntersecting),
      { root: container, threshold: 0 }
    );
    observer.observe(btn);
    return () => observer.disconnect();
  }, [draftQuestions.length, hasActiveSession]);

  const addQuestionToDraft = () => {
    if (!questionPrompt.trim() || !option1.trim() || !option2.trim()) {
      showError('Please fill in all fields');
      return;
    }
    if (!ownerResponse) {
      showError('Tap your answer below — which one would you pick?');
      return;
    }
    addDraft(questionPrompt, [option1, option2], ownerResponse);
    setQuestionPrompt('');
    setOption1('');
    setOption2('');
    setOwnerResponseState('');
    setIsEditingDraft(false);
    haptic();
    showNotification('Question added to drafts');
  };

  const questionLimit = quizState?.questionLimit ?? getQuestionLimit();
  const publishedQuestionsCount = hasActiveSession ? (quizState?.questions.length ?? 0) : 0;
  const totalQuestionsCount = publishedQuestionsCount + draftQuestions.length;
  const hasReachedLimit = totalQuestionsCount >= questionLimit;
  const canAffordUpgrade = vybesBalance >= QUESTION_LIMIT_UPGRADE_COST;
  const hasUpgraded = hasUpgradedQuestionLimit();

  const needsUpgradeForPublish = () => {
    const availableSlots = questionLimit - publishedQuestionsCount;
    return draftQuestions.length > availableSlots && !hasUpgraded;
  };

  const hasUnsavedInput = Boolean(
    questionPrompt.trim() !== '' || option1.trim() !== '' || option2.trim() !== ''
  );

  const [isEditingDraft, setIsEditingDraft] = useState(false);

  const handleEditDraft = (draft: DraftQuestion) => {
    setQuestionPrompt(draft.prompt);
    setOption1(draft.options[0]);
    setOption2(draft.options[1]);
    setOwnerResponseState(draft.ownerResponse || '');
    setIsEditingDraft(true);
    removeDraft(draft.id);
    setTimeout(() => { questionInputRef.current?.focus(); }, 0);
  };

  const handleCancelEdit = () => {
    setQuestionPrompt('');
    setOption1('');
    setOption2('');
    setOwnerResponseState('');
    setIsEditingDraft(false);
  };

  const handleDragStart = (index: number) => {
    setDraggedDraftIndex(index);
  };

  const handleDragEnter = (index: number) => {
    if (draggedDraftIndex === null || draggedDraftIndex === index) return;
    reorderDrafts(draggedDraftIndex, index);
    setDraggedDraftIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedDraftIndex(null);
  };

  const handleRemoveDraft = (id: string) => {
    setRemovingDraftIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      removeDraft(id);
      setRemovingDraftIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }, 200);
  };

  const publishDraftQuestions = () => {
    const unansweredDrafts = draftQuestions.filter(q => !q.ownerResponse);
    if (unansweredDrafts.length > 0) {
      showError(`Please answer all questions before publishing (${unansweredDrafts.length} unanswered)`);
      return;
    }
    const needsUpgrade = draftQuestions.length > DEFAULT_QUESTION_LIMIT - publishedQuestionsCount && !hasUpgraded;
    if (!hasActiveSession) {
      if (needsUpgrade) { setShowUpgradeDialog(true); } else { setShowCreateSessionDialog(true); }
      return;
    }
    if (needsUpgrade) { setShowUpgradeDialog(true); return; }
    setShowPublishDialog(true);
  };

  const confirmPublish = () => {
    const questionsToPublish = [...draftQuestions];
    clearDrafts();
    setShowPublishDialog(false);
    setIsPublishing(true);
    haptic(20);
    showNotification(`Publishing ${questionsToPublish.length} question${questionsToPublish.length !== 1 ? 's' : ''}...`);
    questionsToPublish.forEach(draft => {
      send({ type: 'question:add', data: { prompt: draft.prompt, options: draft.options, ownerResponse: draft.ownerResponse } });
    });
    setTimeout(() => setIsPublishing(false), 2000);
  };

  const confirmUpgradeAndPublish = () => {
    if (!canAffordUpgrade) { setShowUpgradeDialog(false); setActivePage('vybes'); return; }
    setShowUpgradeDialog(false);
    const questionsToPublish = [...draftQuestions];
    if (!hasActiveSession) {
      setPendingNeedsUpgrade(true);
      setPendingPublish(true);
      send({ type: 'session:create', data: { username: twitterUsername || undefined } });
    } else {
      send({ type: 'question:unlock-limit' });
      clearDrafts();
      showNotification(`Upgrading limit and publishing ${questionsToPublish.length} question(s)...`);
      questionsToPublish.forEach(draft => {
        send({ type: 'question:add', data: { prompt: draft.prompt, options: draft.options, ownerResponse: draft.ownerResponse } });
      });
    }
  };

  const confirmCreateSession = () => {
    setShowCreateSessionDialog(false);
    setPendingPublish(true);
    send({ type: 'session:create', data: { username: twitterUsername || undefined } });
  };

  const handleUnlockQuestionLimit = () => {
    if (!canAffordUpgrade) {
      showError(`Not enough Vybes! Need ${QUESTION_LIMIT_UPGRADE_COST}, have ${vybesBalance}`);
      return;
    }
    setIsUnlocking(true);
    send({ type: 'question:unlock-limit' });
    setTimeout(() => setIsUnlocking(false), 3000);
  };

  const AI_CACHE_PREFIX = 'vybecheck_ai_cache_';

  const handleAIGenerate = async () => {
    if (!selectedFile) { showError('Please select a test audio file'); return; }
    setIsGenerating(true);
    try {
      const cacheKey = `${AI_CACHE_PREFIX}${selectedFile}`;
      const cached = localStorage.getItem(cacheKey);
      let data: { questions: GeneratedQuestion[]; transcript: string };
      if (cached) {
        setGenerationStatus('Using cached questions...');
        await new Promise(resolve => setTimeout(resolve, 500));
        data = JSON.parse(cached);
      } else {
        setGenerationStatus('Step 1/3: Uploading audio…');
        const res = await fetch('/api/ai/generate-from-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: selectedFile, count: 5 }),
        });
        setGenerationStatus('Step 2/3: Transcribing audio…');
        if (!res.ok) { const errData = await res.json(); throw new Error(errData.error || 'Generation failed'); }
        setGenerationStatus('Step 3/3: Generating questions…');
        data = await res.json();
        localStorage.setItem(cacheKey, JSON.stringify(data));
      }
      for (const q of data.questions) { addDraft(q.prompt, q.options, undefined, true); }
      const source = cached ? '(cached)' : '(new)';
      showNotification(`Generated ${data.questions.length} questions ${source}`);
      setShowAISection(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      showError(`AI generation failed: ${message}`);
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  // Header pills
  const headerPills = (
    <>
      {hasActiveSession ? (
        <div className="flex items-center gap-1.5 rounded-full border border-status-success/30 bg-status-success/15 px-2.5 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-success" />
          <span className="text-[11px] font-bold text-status-success">Live</span>
          <span className="mx-0.5 text-status-success/30">|</span>
          <Radio size={10} className="text-status-success/60" />
          <span className="font-mono text-[10px] text-status-success/70">{sessionId}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 rounded-full border border-vybe-yellow/25 bg-vybe-yellow/15 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-vybe-yellow" />
          <span className="text-[11px] font-bold text-vybe-yellow">Draft Mode</span>
        </div>
      )}
      {draftQuestions.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1">
          <span className="text-[11px] text-white/55">{draftQuestions.length} draft{draftQuestions.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </>
  );

  return (
    <div className="relative flex flex-1 min-h-0 flex-col bg-surface-page font-sans">
      <Header
        title="Lab"
        subtitle="Host your session ✨"
        pills={headerPills}
      />

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ paddingBottom: '140px' }}>
        {/* AI Generate from Audio */}
        {enableAIGeneration && (
          <>
            <button
              onClick={() => setShowAISection(!showAISection)}
              className="mb-3 flex w-full cursor-pointer items-center justify-between rounded-2xl border border-border-light bg-white px-4 py-3 shadow-[0_2px_8px_rgba(99,104,140,0.05)]"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-xl bg-tint-blue">
                  <Mic size={14} className="text-vybe-blue" />
                </div>
                <span className="text-[13px] font-semibold text-ink">Generate Questions from Audio</span>
              </div>
              <ChevronDown size={16} className={`text-ink-muted transition-transform ${showAISection ? 'rotate-180' : ''}`} />
            </button>

            {showAISection && (
              <div className="mb-3 rounded-2xl border-[1.5px] border-vybe-blue/20 bg-white p-4 shadow-[0_4px_16px_rgba(83,157,192,0.07)]">
                <p className="mb-3 text-[12px] leading-[1.6] text-ink-muted">
                  Select a test audio file to generate quiz questions using AI.
                </p>
                <select
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  disabled={isGenerating}
                  className="w-full mb-3 text-[12px] py-2.5 px-3 rounded-xl border border-border-light bg-surface-page"
                >
                  <option value="">Select audio file...</option>
                  {testFiles.map(f => {
                    const isCached = Boolean(localStorage.getItem(`${AI_CACHE_PREFIX}${f}`));
                    return (
                      <option key={f} value={f}>
                        {f}{isCached ? ' ✓ cached' : ''}
                      </option>
                    );
                  })}
                </select>
                {generationStatus && (
                  <div className="mb-3">
                    <p className="text-[11px] text-vybe-blue animate-pulse font-bold mb-1.5">{generationStatus}</p>
                    {/* 3-step progress dots */}
                    {(() => {
                      const step = generationStatus.startsWith('Step 1') ? 1 : generationStatus.startsWith('Step 2') ? 2 : generationStatus.startsWith('Step 3') ? 3 : 0;
                      return step > 0 ? (
                        <div className="flex gap-1.5">
                          {[1,2,3].map(s => (
                            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${s <= step ? 'bg-vybe-blue' : 'bg-tint-muted'}`} />
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
                <button
                  onClick={handleAIGenerate}
                  disabled={!selectedFile || isGenerating}
                  className={`mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 py-2.5 text-[13px] font-bold transition-all ${
                    !selectedFile || isGenerating
                      ? 'bg-tint-muted text-ink-muted cursor-not-allowed'
                      : 'bg-gradient-blue text-white shadow-glow-blue'
                  }`}
                >
                  <Mic size={13} />
                  {isGenerating ? 'Generating...' : 'Generate Questions'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Add Question section label */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-ink-muted" />
            <p className="text-[11px] font-extrabold tracking-[0.8px] text-ink-muted">
              {isEditingDraft ? 'EDIT QUESTION' : 'ADD QUESTION'}
            </p>
          </div>
          {isEditingDraft && (
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-1 rounded-xl border border-border-light bg-surface-page px-2.5 py-1 text-[11px] font-bold text-ink-muted cursor-pointer"
            >
              ← Cancel edit
            </button>
          )}
        </div>

        <div className="mb-5 rounded-3xl border-[1.5px] border-border-light bg-white p-5 shadow-card-muted">
          <textarea
            ref={questionInputRef}
            value={questionPrompt}
            onChange={(e) => setQuestionPrompt(e.target.value)}
            placeholder="Ask something worth answering…"
            rows={3}
            maxLength={200}
            className="mb-1 box-border w-full resize-none rounded-xl border border-border-light bg-surface-page px-[14px] py-[10px] text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink-muted"
          />
          <p className={`mb-2 text-right text-[11px] font-semibold ${questionPrompt.length >= 180 ? 'text-vybe-red' : 'text-ink-muted'}`}>
            {questionPrompt.length} / 200
          </p>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border-light bg-surface-page">
              <input
                value={option1}
                onChange={(e) => {
                  setOption1(e.target.value);
                  if (ownerResponse && ownerResponse === option1) setOwnerResponseState(e.target.value);
                }}
                placeholder="Option A"
                maxLength={60}
                className="box-border w-full rounded-xl border-0 bg-transparent inline-input px-3 py-[9px] text-[13px] text-ink outline-none placeholder:text-ink-muted"
              />
            </div>
            <div className="rounded-xl border border-border-light bg-surface-page">
              <input
                value={option2}
                onChange={(e) => {
                  setOption2(e.target.value);
                  if (ownerResponse && ownerResponse === option2) setOwnerResponseState(e.target.value);
                }}
                placeholder="Option B"
                maxLength={60}
                className="box-border w-full rounded-xl border-0 bg-transparent inline-input px-3 py-[9px] text-[13px] text-ink outline-none placeholder:text-ink-muted"
              />
            </div>
          </div>

          {/* Answer picker — only shown when both options have text */}
          {option1.trim() && option2.trim() && (
            <div className="mb-3 rounded-2xl border border-border-light bg-surface-page p-3">
              <p className="mb-2 text-[11px] font-extrabold tracking-[0.6px] text-ink-muted">
                🎯 WHICH ONE IS YOUR ANSWER?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setOwnerResponseState(option1); haptic(); }}
                  className={`cursor-pointer rounded-xl border-0 px-3 py-3 text-[13px] font-bold transition-all text-left ${
                    ownerResponse === option1
                      ? 'bg-status-success text-white shadow-[0_2px_10px_rgba(34,197,94,0.35)]'
                      : 'bg-tint-muted text-ink'
                  }`}
                >
                  <span className={`mr-1.5 text-[11px] font-extrabold ${ownerResponse === option1 ? 'text-white/70' : 'text-ink-muted'}`}>A</span>
                  {option1}
                </button>
                <button
                  type="button"
                  onClick={() => { setOwnerResponseState(option2); haptic(); }}
                  className={`cursor-pointer rounded-xl border-0 px-3 py-3 text-[13px] font-bold transition-all text-left ${
                    ownerResponse === option2
                      ? 'bg-status-success text-white shadow-[0_2px_10px_rgba(34,197,94,0.35)]'
                      : 'bg-tint-muted text-ink'
                  }`}
                >
                  <span className={`mr-1.5 text-[11px] font-extrabold ${ownerResponse === option2 ? 'text-white/70' : 'text-ink-muted'}`}>B</span>
                  {option2}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={addQuestionToDraft}
            className="w-full rounded-2xl border-0 py-3 text-[14px] font-bold transition-all cursor-pointer bg-gradient-muted text-white shadow-glow-muted"
          >
            + Add to Drafts
          </button>
        </div>

        {/* Draft Questions */}
        {/* Question limit progress bar */}
        {(() => {
          const pct = Math.min((draftQuestions.length / questionLimit) * 100, 100);
          const barColor = pct >= 100 ? 'bg-vybe-red' : pct >= 67 ? 'bg-vybe-yellow' : 'bg-status-success';
          return (
            <div className="mb-4 rounded-2xl border border-border-light bg-white p-3.5 shadow-card-muted">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-extrabold tracking-[0.6px] text-ink-muted">DRAFT QUESTIONS</span>
                <span className={`text-[11px] font-extrabold ${pct >= 100 ? 'text-vybe-red' : pct >= 67 ? 'text-vybe-gold' : 'text-status-success-dark'}`}>
                  {draftQuestions.length} / {questionLimit}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-tint-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {pct >= 100 && (
                <p className="mt-1.5 text-[11px] text-vybe-red font-semibold">Limit reached — publish to add more</p>
              )}
            </div>
          );
        })()}

        {draftQuestions.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border-[1.5px] border-dashed border-border-light bg-white/60 px-6 py-10 text-center shadow-card-muted">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-tint-muted">
              <FlaskConical size={26} strokeWidth={1.5} className="text-ink-muted" />
            </div>
            <h3 className="mb-1.5 text-[15px] font-extrabold text-ink">No drafts yet</h3>
            <p className="mb-4 max-w-[220px] text-[12px] leading-[1.6] text-ink-muted">
              Type a question and two options above, then tap <strong>+ Add to Drafts</strong> to build your set.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[240px]">
              <div className="flex items-center gap-2.5 rounded-xl bg-tint-muted px-3 py-2">
                <span className="text-[13px]">1️⃣</span>
                <span className="text-[11px] font-semibold text-ink-muted">Write a question + 2 options</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-tint-muted px-3 py-2">
                <span className="text-[13px]">2️⃣</span>
                <span className="text-[11px] font-semibold text-ink-muted">Pick your own answer</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-tint-muted px-3 py-2">
                <span className="text-[13px]">3️⃣</span>
                <span className="text-[11px] font-semibold text-ink-muted">Tap + Add to Drafts</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-vybe-red" />
                <p className="text-[11px] font-extrabold tracking-[0.8px] text-vybe-red">
                  DRAFT QUESTIONS ({draftQuestions.length})
                </p>
              </div>
              {hasActiveSession && (
                <button
                  ref={publishButtonRef}
                  onClick={publishDraftQuestions}
                  disabled={isPublishing}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-vybe-red/20 bg-tint-pink px-3 py-1.5 text-[12px] font-bold text-vybe-red disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={12} />
                  {isPublishing ? 'Publishing…' : 'Publish All'}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {draftQuestions.map((draft, index) => (
                <DraftQuestionCard
                  key={draft.id}
                  draft={draft}
                  index={index}
                  onRemove={handleRemoveDraft}
                  onSetOwnerResponse={setOwnerResponse}
                  onEdit={handleEditDraft}
                  isEditDisabled={hasUnsavedInput}
                  editDisabledReason="Clear the form to edit this draft"
                  onDragStart={handleDragStart}
                  onDragEnter={handleDragEnter}
                  onDragEnd={handleDragEnd}
                  isRemoving={removingDraftIds.has(draft.id)}
                />
              ))}

              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-tint-pink bg-white py-2.5 text-[13px] font-semibold text-vybe-red"
              >
                <Trash2 size={14} />
                Clear all drafts
              </button>
            </div>
          </>
        )}

        <div className="h-2" />
      </div>

      {/* Floating publish button — sticky FAB that shows "Publish N Questions" above the bottom nav.
         Commented out to reduce visual noise; the inline "Publish All" button in the draft header
         already provides the same functionality.
      {hasActiveSession && draftQuestions.length > 0 && (
        <div className="absolute right-4 bottom-[80px] z-20">
          <button
            onClick={publishDraftQuestions}
            className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border-0 bg-gradient-red px-5 py-[13px] text-[13px] font-extrabold text-white shadow-glow-red-lg"
          >
            <Send size={15} />
            Publish {draftQuestions.length} Question{draftQuestions.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
      */}

      <ConfirmDialog
        isOpen={showPublishDialog}
        title="Publish Questions?"
        message={`Are you sure you want to publish ${draftQuestions.length} question${draftQuestions.length !== 1 ? 's' : ''}? Participants will be able to see and answer them immediately.`}
        onConfirm={confirmPublish}
        onCancel={() => setShowPublishDialog(false)}
        confirmText="Publish"
      />
      <ConfirmDialog
        isOpen={showCreateSessionDialog}
        title="Create New Session?"
        message={`This will create a new quiz session and publish your ${draftQuestions.length} draft question${draftQuestions.length !== 1 ? 's' : ''}. Others can join using the session ID.`}
        onConfirm={confirmCreateSession}
        onCancel={() => setShowCreateSessionDialog(false)}
        confirmText="Create & Publish"
      />
      <ConfirmDialog
        isOpen={showUpgradeDialog}
        title="Upgrade Required"
        message={`You have ${draftQuestions.length} questions but the free limit is ${DEFAULT_QUESTION_LIMIT}. Upgrade to ${questionLimit > DEFAULT_QUESTION_LIMIT ? questionLimit : 10} questions for ${QUESTION_LIMIT_UPGRADE_COST} Vybes?${vybesBalance < QUESTION_LIMIT_UPGRADE_COST ? ` (You only have ${vybesBalance} Vybes — not enough!)` : ` (You have ${vybesBalance} Vybes)`}`}
        onConfirm={confirmUpgradeAndPublish}
        onCancel={() => setShowUpgradeDialog(false)}
        confirmText={vybesBalance >= QUESTION_LIMIT_UPGRADE_COST ? `Upgrade & Publish (${QUESTION_LIMIT_UPGRADE_COST} ✨)` : 'Get Vybes →'}
      />
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear all drafts?"
        message="This will permanently delete all your draft questions. This cannot be undone."
        onConfirm={() => { clearDrafts(); setShowClearConfirm(false); }}
        onCancel={() => setShowClearConfirm(false)}
        confirmText="Clear all"
      />

      {/* Floating publish FAB — appears when top publish button scrolls out of view */}
      {hasActiveSession && draftQuestions.length > 0 && showFloatingPublish && (
        <button
          onClick={publishDraftQuestions}
          disabled={isPublishing}
          className="absolute bottom-4 right-4 z-30 flex cursor-pointer items-center gap-2.5 rounded-full border-0 bg-gradient-red px-5 py-[13px] text-[13px] font-extrabold text-white shadow-glow-red-lg transition-all animate-slide-up disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Send size={15} />
          {isPublishing ? 'Publishing…' : `Publish ${draftQuestions.length} Question${draftQuestions.length !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}
