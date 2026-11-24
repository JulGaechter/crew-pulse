import { StyleSheet } from 'react-native';

import { C, F, R } from '@/constants/crew-theme';

/** Gemeinsamer Look für einfache Formular-Screens (Name, Crew erstellen/beitreten) */
export const formStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { color: C.text, fontSize: 28, fontFamily: F.displayBold, letterSpacing: -0.4 },
  subtitle: { color: C.textMuted, fontSize: 15, lineHeight: 21, marginBottom: 12, fontFamily: F.regular },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    borderRadius: R.lg,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 17,
    fontFamily: F.regular,
  },
  codeInput: { fontSize: 30, letterSpacing: 8, textAlign: 'center', fontFamily: F.displayBold },
  error: { color: C.danger, fontSize: 14, fontFamily: F.medium },
  button: {
    backgroundColor: C.accent,
    borderRadius: R.lg,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  buttonText: { color: C.onAccent, fontFamily: F.bold, fontSize: 16 },
  cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  cancelText: { color: C.textMuted, fontFamily: F.medium, fontSize: 15 },
});

export const placeholderColor = C.textMuted;
export const spinnerOnAccent = C.onAccent;
