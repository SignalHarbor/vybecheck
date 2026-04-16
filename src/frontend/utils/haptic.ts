/** Trigger a short haptic pulse on supported devices (no-op elsewhere). */
export const haptic = (duration = 10) => {
  navigator.vibrate?.(duration);
};
