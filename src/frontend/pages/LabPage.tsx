import { useState, useEffect, useRef } from 'react';
import { Mic, ChevronDown, X, Send, Trash2, FlaskConical, Radio } from 'lucide-react';
import { useDraftStore } from '../store/draftStore';
import { useWebSocketStore } from '../store/websocketStore';
import { useUIStore } from '../store/uiStore';
import { useQuizStore } from '../store/quizStore';
import { useAuthStore } from '../store/authStore';
import { Header } from '../components/Header';
import { DraftQuestionCard } from '../components/DraftQuestionCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { GeneratedQuestion } from '../../server/services/QuestionGeneratorService';

const QUESTION_LIMIT_UPGRADE_COST = 3;
const DEFAULT_QUESTION_LIMIT = 3;

export function LabPage() {
  const { draftQuestions, addDraft, removeDraft, clearDrafts, setOwnerResponse } = useDraftStore();
  const { send } = useWebSocketStore();
  const { showNotification, showError, setActivePage } = useUIStore();
  const { sessionId, quizState, questionLimitState, isOwner } = useQuizStore();
  const { getQuestionLimit, vybesBalance, hasUpgradedQuestionLimit, twitterUsername } = useAuthStore();
  const [isUnlocking, setIsUnlocking] = useState(false);

  const [questionPrompt, setQuestionPrompt] = useState('');
  const [option1, setOption1] = useState('');
  const [option2, setOption2] = useState('');
  const [ownerResponse, setOwnerResponseState] = useState<string>('');
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showCreateSessionDialog, setShowCreateSessionDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [pendingPublish, setPendingPublish] = useState(false);
  const [pendingNeedsUpgrade, setPendingNeedsUpgrade] = useState(false);
  const prevSessionIdRef = useRef<string | null>(null);

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

  const hasActiveSession = Boolean(sessionId && quizState);

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

  const addQuestionToDraft = () => {
    if (!questionPrompt.trim() || !option1.trim() || !option2.trim()) {
      showError('Please fill in all fields');
      return;
    }
    if (!ownerResponse) {
      showError('Please select your answer to this question');
      return;
    }
    addDraft(questionPrompt, [option1, option2], ownerResponse);
    setQuestionPrompt('');
    setOption1('');
    setOption2('');
    setOwnerResponseState('');
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
    showNotification(`Publishing ${questionsToPublish.length} question${questionsToPublish.length !== 1 ? 's' : ''}...`);
    questionsToPublish.forEach(draft => {
      send({ type: 'question:add', data: { prompt: draft.prompt, options: draft.options, ownerResponse: draft.ownerResponse } });
    });
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
        setGenerationStatus('Transcribing audio (this may take a moment)...');
        const res = await fetch('/api/ai/generate-from-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: selectedFile, count: 5 }),
        });
        if (!res.ok) { const errData = await res.json(); throw new Error(errData.error || 'Generation failed'); }
        setGenerationStatus('Generating questions...');
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
      {hasActiveSession && (
        <div className="ml-auto flex items-center gap-1 rounded-full bg-white/7 px-2.5 py-1">
          <Radio size={10} className="text-white/40" />
          <span className="font-mono text-[10px] text-white/40">{sessionId?.slice(0, 8)}…</span>
        </div>
      )}
    </>
  );

  return (
    <div className="relative flex h-full flex-col bg-surface-page font-sans">
      <Header
        title="Lab"
        subtitle="Host your session ✨"
        actionIcon={<FlaskConical size={13} />}
        actionColor="muted"
        pills={headerPills}
      />

      <div className={`flex-1 overflow-y-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        draftQuestions.length > 0 && hasActiveSession ? 'pb-[100px]' : 'pb-6'
      }`}>
        {/* AI Generate from Audio */}
        <button
          onClick={() => setShowAISection(!showAISection)}
          className="mt-4 mb-3 flex w-full cursor-pointer items-center justify-between rounded-2xl border border-border-light bg-white px-4 py-3 shadow-[0_2px_8px_rgba(99,104,140,0.05)]"
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
              <p className="text-[11px] text-vybe-blue mb-3 animate-pulse font-bold">{generationStatus}</p>
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

        {/* Add Question section label */}
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-ink-muted" />
          <p className="text-[11px] font-extrabold tracking-[0.8px] text-ink-muted">ADD QUESTION</p>
        </div>

        <div className="mb-5 rounded-3xl border-[1.5px] border-border-light bg-white p-5 shadow-card-muted">
          <textarea
            value={questionPrompt}
            onChange={(e) => setQuestionPrompt(e.target.value)}
            placeholder="Ask something worth answering…"
            rows={3}
            className="mb-2 box-border w-full resize-none rounded-xl border border-border-light bg-surface-page px-[14px] py-[10px] text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink-muted"
          />

          <div className="mb-3 grid grid-cols-2 gap-2">
            <input
              value={option1}
              onChange={(e) => setOption1(e.target.value)}
              placeholder="Option A"
              className="box-border rounded-xl border border-border-light bg-surface-page px-3 py-[9px] text-[13px] text-ink outline-none placeholder:text-ink-muted"
            />
            <input
              value={option2}
              onChange={(e) => setOption2(e.target.value)}
              placeholder="Option B"
              className="box-border rounded-xl border border-border-light bg-surface-page px-3 py-[9px] text-[13px] text-ink outline-none placeholder:text-ink-muted"
            />
          </div>

          {/* Owner Response Selection */}
          {option1 && option2 && (
            <div className="mb-3">
              <label className="block mb-2 text-[12px] font-bold text-ink-muted">Your Answer:</label>
              <div className="grid grid-cols-2 gap-2">
                {[option1, option2].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setOwnerResponseState(opt)}
                    className={`rounded-xl py-3 px-3 text-center text-[13px] font-semibold transition-all cursor-pointer ${
                      ownerResponse === opt
                        ? 'border-2 border-status-success bg-tint-green text-status-success-dark'
                        : 'border border-border-light bg-surface-page text-ink'
                    }`}
                  >
                    {opt}{ownerResponse === opt && ' ✓'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={addQuestionToDraft}
            className={`w-full rounded-2xl border-0 py-3 text-[14px] font-bold transition-all ${
              questionPrompt.trim()
                ? 'cursor-pointer bg-gradient-muted text-white shadow-glow-muted'
                : 'cursor-not-allowed bg-tint-muted text-ink-muted'
            }`}
          >
            + Add to Drafts
          </button>
        </div>

        {/* Draft Questions */}
        {draftQuestions.length === 0 ? (
          <div className="flex flex-col items-center py-10 opacity-40">
            <FlaskConical size={32} strokeWidth={1.5} className="text-ink-muted" />
            <p className="mt-2.5 text-[13px] font-semibold text-ink-muted">
              Create questions above to add to your drafts
            </p>
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
                  onClick={publishDraftQuestions}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-vybe-red/20 bg-tint-pink px-3 py-1.5 text-[12px] font-bold text-vybe-red"
                >
                  <Send size={12} />
                  Publish All
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {draftQuestions.map((draft, index) => (
                <DraftQuestionCard
                  key={draft.id}
                  draft={draft}
                  index={index}
                  onRemove={removeDraft}
                  onSetOwnerResponse={setOwnerResponse}
                />
              ))}

              <button
                onClick={() => clearDrafts()}
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

      {/* Floating publish button */}
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
    </div>
  );
}
