/**
 * OnboardingPage
 *
 * Full-screen overlay shown to new users on first sign-in.
 * App.tsx manages visibility via showOnboarding state and persists
 * the seen flag to localStorage via the ONBOARDING_KEY constant.
 *
 * Adapted from the DevOnboardingScreen reference, using vybecheck's
 * Tailwind design tokens instead of ThemeContext/useColors.
 */
import { useState, useEffect } from 'react';
import {
  DoorOpen, FlaskConical, Zap, Sparkles,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import logo from '../assets/logo.png';
import { analytics } from '../utils/analytics';

export const ONBOARDING_KEY = 'vybecheck_onboarded';

// ── Design tokens (mirroring tailwind.config.js) ──────────────────
const ACCENT = {
  yellow: '#FEC539',
  blue:   '#539DC0',
  red:    '#F14573',
  purple: '#63688C',
};
const TINT = {
  yellow: '#FFF6D8',
  blue:   '#EAF4FB',
  red:    '#FDEAF1',
  purple: '#EEEFF5',
};

type SlideIcon = typeof Zap;

interface Slide {
  id:         string;
  isWelcome?: true;
  isFinal?:   true;
  icon:       SlideIcon | null;
  badge:      string;
  accentColor: string;
  tintColor:  string;
  title:      string;
  body:       string;
  tip?:       string;
}

// Slide order matches the user flow: Enter → Create → Engage → Unlock
const SLIDES: Slide[] = [
  {
    id: 'welcome', isWelcome: true, icon: null,
    badge: 'WELCOME', accentColor: ACCENT.yellow, tintColor: TINT.yellow,
    title: 'Welcome to\nVybeCheck',
    body:  'A live Q&A experience that reveals your vibe compatibility. Here\'s a quick tour of how it works.',
  },
  {
    id: 'lobby', icon: DoorOpen,
    badge: 'LOBBY', accentColor: ACCENT.blue, tintColor: TINT.blue,
    title: 'Enter a\nSession',
    body:  'The Lobby is your starting point. Join a live session with a code someone shares, or create your own session to host.',
    tip:   'Paste a session code in the Lobby and tap Go — you\'ll jump straight into the quiz.',
  },
  {
    id: 'lab', icon: FlaskConical,
    badge: 'LAB', accentColor: ACCENT.purple, tintColor: TINT.purple,
    title: 'Create\n& Host',
    body:  'Build your question set in the Lab. Type questions manually or use AI to generate them from audio. Then publish to go live.',
    tip:   'Draft your questions first, then hit Publish to push them to your audience in real time.',
  },
  {
    id: 'quiz', icon: Zap,
    badge: 'QUIZ', accentColor: ACCENT.red, tintColor: TINT.red,
    title: 'Answer Live\nQuestions',
    body:  'Once you\'re in a session, questions appear in real time. Answer them — your choices shape your vibe score and determine who you match with.',
    tip:   'Use Prev / Next to revisit questions. Next is locked until you\'ve answered the current one.',
  },
  {
    id: 'vybes', isFinal: true, icon: Sparkles,
    badge: 'VYBES', accentColor: ACCENT.yellow, tintColor: TINT.yellow,
    title: 'Earn &\nSpend Vybes',
    body:  'Vybes are your in-app currency. Earn them by participating in sessions, then spend them to unlock your full match results.',
  },
];

const FEATURE_TILES = [
  { icon: DoorOpen,     label: 'Lobby', accent: ACCENT.blue,   tint: TINT.blue   },
  { icon: FlaskConical, label: 'Lab',   accent: ACCENT.purple, tint: TINT.purple },
  { icon: Zap,          label: 'Quiz',  accent: ACCENT.red,    tint: TINT.red    },
  { icon: Sparkles,     label: 'Vybes', accent: ACCENT.yellow, tint: TINT.yellow },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingPage({ onComplete }: Props) {
  const [current, setCurrent] = useState(0);
  const [fading, setFading]   = useState(false);

  useEffect(() => {
    analytics.capture('onboarding_started');
  }, []);

  useEffect(() => {
    analytics.capture('onboarding_step_viewed', { step: current + 1, slide_id: SLIDES[current].id });
  }, [current]);

  const slide  = SLIDES[current];
  const accent = slide.accentColor;
  const total  = SLIDES.length;

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= total || idx === current) return;
    setFading(true);
    setTimeout(() => { setCurrent(idx); setFading(false); }, 160);
  };

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col overflow-hidden font-sans"
      style={{ background: 'linear-gradient(160deg, #1A1A2E 0%, #262646 100%)' }}
    >
      {/* Decorative glow orbs */}
      <div
        className="pointer-events-none absolute -top-[100px] -right-[80px] h-[280px] w-[280px] rounded-full"
        style={{ background: `radial-gradient(circle, ${accent}28 0%, transparent 70%)`, transition: 'background 400ms ease' }}
      />
      <div
        className="pointer-events-none absolute bottom-[80px] -left-[70px] h-[200px] w-[200px] rounded-full"
        style={{ background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`, transition: 'background 400ms ease' }}
      />

      {/* Status bar safe area */}
      <div className="h-12 shrink-0" />

      {/* Skip button */}
      {!slide.isFinal && (
        <button
          onClick={() => { analytics.capture('onboarding_skipped', { at_step: current + 1, slide_id: slide.id }); onComplete(); }}
          className="absolute top-12 right-4 z-10 flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5"
        >
          <span className="text-[12px] font-semibold text-white/55">Skip</span>
          <X size={11} color="rgba(255,255,255,0.4)" />
        </button>
      )}

      {/* ── Slide content ────────────────────────────────────────── */}
      <div
        className={`flex flex-1 flex-col items-center justify-center px-6 pt-2 transition-all duration-[160ms] ease-in-out ${
          fading ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        {/* ════ WELCOME SLIDE ════ */}
        {slide.isWelcome && (
          <div className="flex w-full flex-col items-center text-center">
            {/* Logo */}
            <div className="relative mb-5 flex items-center justify-center">
              <div
                className="absolute h-[110px] w-[110px] rounded-full"
                style={{ background: `radial-gradient(circle, ${ACCENT.yellow}44 0%, transparent 70%)` }}
              />
              <img src={logo} alt="VybeCheck" className="relative h-[68px] w-[68px] rounded-[20px] object-contain shadow-[0_8px_24px_rgba(0,0,0,0.4)]" />
            </div>

            {/* Badge */}
            <div
              className="mb-5 flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ background: `${ACCENT.yellow}22`, border: `1px solid ${ACCENT.yellow}44` }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT.yellow }} />
              <span className="text-[11px] font-extrabold tracking-[1px]" style={{ color: ACCENT.yellow }}>
                WELCOME
              </span>
            </div>

            <h1 className="mb-3 text-[30px] font-black leading-[1.1] text-white">
              Welcome to<br />VybeCheck
            </h1>
            <p className="mb-8 max-w-[270px] text-[13px] leading-[1.65] text-white/60">
              {slide.body}
            </p>

            {/* 4 feature tiles */}
            <div className="grid w-full grid-cols-4 gap-2.5">
              {FEATURE_TILES.map(({ icon: Icon, label, accent: a, tint }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] py-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: tint }}>
                    <Icon size={16} color={a} />
                  </div>
                  <span className="text-[10px] font-bold text-white/65">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ FEATURE SLIDES ════ */}
        {!slide.isWelcome && slide.icon && (() => {
          const Icon = slide.icon!;
          return (
            <div className="flex w-full flex-col items-center text-center">
              {/* Large icon with glow halo */}
              <div className="relative mb-6 flex items-center justify-center">
                <div
                  className="absolute h-[160px] w-[160px] rounded-full"
                  style={{ background: `radial-gradient(circle, ${accent}30 0%, transparent 70%)` }}
                />
                <div
                  className="relative flex h-[84px] w-[84px] items-center justify-center rounded-[28px]"
                  style={{ background: slide.tintColor, boxShadow: `0 16px 48px ${accent}44`, transition: 'box-shadow 400ms ease' }}
                >
                  <Icon size={40} color={accent} strokeWidth={1.8} />
                </div>
              </div>

              {/* Accent badge */}
              <div
                className="mb-4 rounded-full px-3 py-1"
                style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
              >
                <span className="text-[10px] font-extrabold tracking-[1.4px]" style={{ color: accent }}>
                  {slide.badge}
                </span>
              </div>

              <h2 className="mb-4 text-[28px] font-black leading-[1.1] text-white">
                {slide.title.split('\n').map((line, i, arr) => (
                  <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                ))}
              </h2>

              <p className="mb-5 max-w-[285px] text-[13px] leading-[1.65] text-white/60">
                {slide.body}
              </p>

              {/* Tip box */}
              {slide.tip && (
                <div className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3">
                  <span className="mt-0.5 shrink-0 text-[15px]">💡</span>
                  <p className="text-left text-[12px] leading-[1.55] text-white/55">{slide.tip}</p>
                </div>
              )}

              {/* Final slide — Vybes credit callout */}
              {slide.isFinal && (
                <div
                  className="mt-4 flex w-full items-center gap-3 rounded-2xl px-4 py-4"
                  style={{ background: `${ACCENT.yellow}18`, border: `1px solid ${ACCENT.yellow}33` }}
                >
                  <Sparkles size={26} color={ACCENT.yellow} fill={ACCENT.yellow} className="shrink-0" />
                  <div className="text-left">
                    <p className="text-[22px] font-black leading-none" style={{ color: ACCENT.yellow }}>
                      10 free Vybes
                    </p>
                    <p className="mt-1 text-[11px] text-white/45">
                      automatically credited to new accounts
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Bottom: progress pills + navigation ─────────────────── */}
      <div className="shrink-0 px-6 pb-10 pt-4">
        {/* Progress pills */}
        <div className="mb-5 flex items-center justify-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className="h-2 cursor-pointer rounded-full border-none transition-all duration-300"
              style={{
                width: i === current ? '28px' : '8px',
                background: i === current ? accent : 'rgba(255,255,255,0.22)',
              }}
            />
          ))}
        </div>

        {/* Final CTA */}
        {slide.isFinal ? (
          <button
            onClick={() => { analytics.capture('onboarding_completed'); onComplete(); }}
            className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-none py-4 text-[16px] font-extrabold text-[#1A1A2E]"
            style={{
              background: `linear-gradient(135deg, #B8860B 0%, ${ACCENT.yellow} 100%)`,
              boxShadow:  `0 8px 28px ${ACCENT.yellow}55`,
            }}
          >
            <Sparkles size={18} color="#1A1A2E" />
            Let's Check Some Vybes →
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {/* Prev */}
            <button
              onClick={() => goTo(current - 1)}
              className={`flex h-[52px] w-[52px] shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] transition-all duration-200 ${
                current === 0 ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'
              }`}
            >
              <ChevronLeft size={22} color="rgba(255,255,255,0.6)" />
            </button>
            {/* Next */}
            <button
              onClick={() => goTo(current + 1)}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border-none py-3.5 text-[15px] font-extrabold text-white"
              style={{
                background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)`,
                boxShadow:  `0 6px 22px ${accent}44`,
                transition: 'background 400ms ease, box-shadow 400ms ease',
              }}
            >
              {current === 0 ? "Let's Explore" : 'Next'}
              <ChevronRight size={17} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
