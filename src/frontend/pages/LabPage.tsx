import { useState, useEffect, useRef } from 'react';
import { useDraftStore } from '../store/draftStore';
import { useWebSocketStore } from '../store/websocketStore';
import { useUIStore } from '../store/uiStore';
import { useQuizStore } from '../store/quizStore';
import { useAuthStore } from '../store/authStore';
import { DraftQuestionCard } from '../components/DraftQuestionCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { GeneratedQuestion } from '../../server/services/QuestionGeneratorService';

// TODO: Move this to config or constants file
const QUESTION_LIMIT_UPGRADE_COST = 3;
const DEFAULT_QUESTION_LIMIT = 3;

export function LabPage() {
  const { draftQuestions, addDraft, removeDraft, clearDrafts, setOwnerResponse } = useDraftStore();
  const { send } = useWebSocketStore();
  const { showNotification, showError, setActivePage } = useUIStore();
  const { sessionId, quizState, questionLimitState, isOwner } = useQuizStore();
  const { getQuestionLimit, vybesBalance, hasUpgradedQuestionLimit } = useAuthStore();
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

  // Fetch test audio files when AI section opens
  useEffect(() => {
    if (showAISection && testFiles.length === 0) {
      fetch('/api/ai/test-files')
        .then(res => res.json())
        .then((data: { files: string[] }) => setTestFiles(data.files))
        .catch(() => showError('Failed to load test audio files'));
    }
  }, [showAISection]);

  // Check if session is active (has sessionId and quizState)
  const hasActiveSession = Boolean(sessionId && quizState);

  // Watch for session creation to auto-publish drafts
  useEffect(() => {
    if (pendingPublish && sessionId && sessionId !== prevSessionIdRef.current) {
      // Session was just created, publish the drafts
      const questionsToPublish = [...draftQuestions];

      // Auto-upgrade if needed (unlock is processed before adds on server)
      if (pendingNeedsUpgrade) {
        send({ type: 'question:unlock-limit' });
        setPendingNeedsUpgrade(false);
      }

      questionsToPublish.forEach(draft => {
        send({
          type: 'question:add',
          data: {
            prompt: draft.prompt,
            options: draft.options,
            ownerResponse: draft.ownerResponse
          }
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

  const needsUpgradeForPublish = () => {
    const availableSlots = questionLimit - publishedQuestionsCount;
    return draftQuestions.length > availableSlots && !hasUpgraded;
  };

  const publishDraftQuestions = () => {
    // Check if all drafts have owner responses
    const unansweredDrafts = draftQuestions.filter(q => !q.ownerResponse);
    if (unansweredDrafts.length > 0) {
      showError(`Please answer all questions before publishing (${unansweredDrafts.length} unanswered)`);
      return;
    }

    // Check if upgrade is needed
    const needsUpgrade = draftQuestions.length > DEFAULT_QUESTION_LIMIT - publishedQuestionsCount && !hasUpgraded;

    // If no active session, show create session dialog (upgrade handled in create flow)
    if (!hasActiveSession) {
      if (needsUpgrade) {
        setShowUpgradeDialog(true);
      } else {
        setShowCreateSessionDialog(true);
      }
      return;
    }

    // In active session, check if upgrade needed
    if (needsUpgrade) {
      setShowUpgradeDialog(true);
      return;
    }

    setShowPublishDialog(true);
  };

  const confirmPublish = () => {
    // Store draft questions with responses before clearing
    const questionsToPublish = [...draftQuestions];

    // Clear drafts and close dialog immediately for better UX
    clearDrafts();
    setShowPublishDialog(false);
    showNotification(`Publishing ${questionsToPublish.length} question${questionsToPublish.length !== 1 ? 's' : ''}...`);

    // Send all draft questions to server
    questionsToPublish.forEach(draft => {
      send({
        type: 'question:add',
        data: {
          prompt: draft.prompt,
          options: draft.options,
          ownerResponse: draft.ownerResponse
        }
      });
    });
  };

  const confirmUpgradeAndPublish = () => {
    // If user can't afford, redirect to Vybes page to purchase
    if (!canAffordUpgrade) {
      setShowUpgradeDialog(false);
      setActivePage('vybes');
      return;
    }

    setShowUpgradeDialog(false);
    const questionsToPublish = [...draftQuestions];

    if (!hasActiveSession) {
      // Need to create session first, then upgrade, then publish
      setPendingNeedsUpgrade(true);
      setPendingPublish(true);
      send({ type: 'session:create', data: {} });
    } else {
      // Already in session — upgrade then publish immediately
      send({ type: 'question:unlock-limit' });

      clearDrafts();
      showNotification(`Upgrading limit and publishing ${questionsToPublish.length} question(s)...`);

      questionsToPublish.forEach(draft => {
        send({
          type: 'question:add',
          data: {
            prompt: draft.prompt,
            options: draft.options,
            ownerResponse: draft.ownerResponse
          }
        });
      });
    }
  };

  const confirmCreateSession = () => {
    setShowCreateSessionDialog(false);
    setPendingPublish(true);
    send({ type: 'session:create', data: {} });
  };

  // Question limit: use server-authoritative value when in a session, fallback to client
  const questionLimit = quizState?.questionLimit ?? getQuestionLimit();
  const publishedQuestionsCount = hasActiveSession ? (quizState?.questions.length ?? 0) : 0;
  const totalQuestionsCount = publishedQuestionsCount + draftQuestions.length;
  const hasReachedLimit = totalQuestionsCount >= questionLimit;
  const canAffordUpgrade = vybesBalance >= QUESTION_LIMIT_UPGRADE_COST;
  const hasUpgraded = hasUpgradedQuestionLimit();

  const handleUnlockQuestionLimit = () => {
    if (!canAffordUpgrade) {
      showError(`Not enough Vybes! Need ${QUESTION_LIMIT_UPGRADE_COST}, have ${vybesBalance}`);
      return;
    }
    setIsUnlocking(true);
    send({ type: 'question:unlock-limit' });
    // isUnlocking will be reset when we receive question:limit-unlocked or error
    setTimeout(() => setIsUnlocking(false), 3000); // Fallback reset
  };

  const AI_CACHE_PREFIX = 'vybecheck_ai_cache_';

  const handleAIGenerate = async () => {
    if (!selectedFile) {
      showError('Please select a test audio file');
      return;
    }

    setIsGenerating(true);

    try {
      // Check localStorage cache first
      const cacheKey = `${AI_CACHE_PREFIX}${selectedFile}`;
      const cached = localStorage.getItem(cacheKey);

      let data: { questions: GeneratedQuestion[]; transcript: string };

      if (cached) {
        setGenerationStatus('Using cached questions...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
        data = JSON.parse(cached);
      } else {
        setGenerationStatus('Transcribing audio (this may take a moment)...');

        const res = await fetch('/api/ai/generate-from-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: selectedFile, count: 5 }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Generation failed');
        }

        setGenerationStatus('Generating questions...');
        data = await res.json();

        // Cache the result
        localStorage.setItem(cacheKey, JSON.stringify(data));
      }

      // Add generated questions to drafts
      for (const q of data.questions) {
        addDraft(q.prompt, q.options, undefined, true);
      }

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

  return (
    <div className="w-full min-h-full">
      {/* Session Status Banner */}
      {hasActiveSession ? (
        <div className="py-3 px-4 mb-4 bg-emerald-50 rounded-lg border border-emerald-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-base">🟢</span>
            <span className="text-sm font-semibold text-emerald-800">Live Session</span>
          </div>
          <span className="text-xs text-emerald-700 font-mono">
            {sessionId}
          </span>
        </div>
      ) : (
        <div className="py-3 px-4 mb-4 bg-amber-100 rounded-lg border border-amber-300 flex items-center gap-2">
          <span className="text-base">✏️</span>
          <span className="text-sm font-medium text-amber-800">
            Draft Mode — Create questions offline, publish when ready
          </span>
        </div>
      )}

      {/* AI Generate from Audio */}
      <div className="mb-4">
        <button
          onClick={() => setShowAISection(!showAISection)}
          className="w-full py-3 px-4 bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer text-left flex justify-between items-center"
        >
          <span className="text-sm font-semibold text-gray-800">🤖 Generate Questions from Audio</span>
          <span className="text-gray-400">{showAISection ? '▲' : '▼'}</span>
        </button>
        {showAISection && (
          <div className="mt-2 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 mb-3">
              Select a test audio file to generate quiz questions using AI.
            </p>
            <select
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              disabled={isGenerating}
              className="w-full mb-3 text-sm py-2.5 px-3 rounded-lg border border-gray-200 bg-white"
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
              <p className="text-xs text-indigo-600 mb-3 animate-pulse">
                {generationStatus}
              </p>
            )}
            <button
              onClick={handleAIGenerate}
              disabled={!selectedFile || isGenerating}
              className={`w-full py-3 px-4 border-none rounded-xl cursor-pointer text-sm font-semibold transition-all ${
                !selectedFile || isGenerating
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-linear-to-br from-vybe-blue to-vybe-purple text-white'
              }`}
            >
              {isGenerating ? 'Generating...' : '🎙️ Generate Questions'}
            </button>
          </div>
        )}
      </div>

      {/* Session Question Stats - only show when in a session */}
      {hasActiveSession && (
        <div className="py-4 px-5 mb-4 rounded-lg border bg-indigo-50 border-indigo-200">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-indigo-700">
              📊 Questions in Session
            </span>
            <span className="text-lg font-bold text-indigo-700">
              {publishedQuestionsCount} / {questionLimit}
            </span>
          </div>
        </div>
      )}

      <div className="bg-white p-5 rounded-[20px] mb-5 shadow-card">
        <h2 className="mt-0 mb-4 text-gray-800 text-xl font-bold">Add Question</h2>
        <input
          type="text"
          placeholder="Question prompt"
          value={questionPrompt}
          onChange={(e) => setQuestionPrompt(e.target.value)}
          className="w-full mb-3"
        />
        <input
          type="text"
          placeholder="Option 1"
          value={option1}
          onChange={(e) => setOption1(e.target.value)}
          className="w-full mb-3"
        />
        <input
          type="text"
          placeholder="Option 2"
          value={option2}
          onChange={(e) => setOption2(e.target.value)}
          className="w-full mb-3"
        />

        {/* Owner Response Selection */}
        {option1 && option2 && (
          <div className="mt-4 mb-3">
            <label className="block mb-2 text-sm font-semibold text-gray-800">
              Your Answer:
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setOwnerResponseState(option1)}
                className={`flex-1 py-4 px-6 border-2 rounded-xl cursor-pointer text-[17px] font-medium transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation active:scale-[0.97] ${
                  ownerResponse === option1
                    ? 'bg-linear-to-br from-emerald-500 to-emerald-600 text-white border-emerald-500 shadow-emerald'
                    : 'bg-white text-gray-800 border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                }`}
              >
                {option1}
                {ownerResponse === option1 && ' ✓'}
              </button>
              <button
                onClick={() => setOwnerResponseState(option2)}
                className={`flex-1 py-4 px-6 border-2 rounded-xl cursor-pointer text-[17px] font-medium transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation active:scale-[0.97] ${
                  ownerResponse === option2
                    ? 'bg-linear-to-br from-emerald-500 to-emerald-600 text-white border-emerald-500 shadow-emerald'
                    : 'bg-white text-gray-800 border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                }`}
              >
                {option2}
                {ownerResponse === option2 && ' ✓'}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={addQuestionToDraft}
          className="w-full py-4 px-6 border-2 border-gray-200 rounded-xl cursor-pointer text-[17px] font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-white text-vybe-blue shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:bg-gray-50 active:scale-[0.97]"
        >
          + Add to Drafts
        </button>
      </div>

      {draftQuestions.length > 0 && (
        <div className="mb-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-gray-800 text-xl font-bold m-0">Draft Questions ({draftQuestions.length})</h2>
            <button
              onClick={publishDraftQuestions}
              className="py-2.5 px-5 text-[15px] border-none rounded-xl cursor-pointer font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-linear-to-br from-vybe-blue to-vybe-purple text-white shadow-primary active:scale-[0.97]"
            >
              Publish All
            </button>
          </div>
          {draftQuestions.map((draft, index) => (
            <DraftQuestionCard
              key={draft.id}
              draft={draft}
              index={index}
              onRemove={removeDraft}
              onSetOwnerResponse={setOwnerResponse}
            />
          ))}
        </div>
      )}

      {draftQuestions.length === 0 && (
        <p className="text-center text-gray-500 py-10 px-5">
          ✏️ Create questions above to add to your drafts
        </p>
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
