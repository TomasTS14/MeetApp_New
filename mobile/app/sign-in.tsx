import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/Themed';
import { Button, Muted, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { pendingLink } from '@/lib/pendingLink';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Email sign-in with a one-time code. Google and Apple sign-in follow once their
// developer accounts are set up.
export default function SignInScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (otpError) {
      setError(t('common.error'));
      return;
    }
    setEmail(address);
    setCodeSent(true);
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    // On success the auth listener swaps this screen for onboarding or the app.
    if (verifyError) {
      setError(t('auth.invalidCode'));
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t('auth.title')}</Text>
          <Muted style={styles.subtitle}>{pendingLink() ? t('auth.subtitleEvent') : t('auth.subtitle')}</Muted>

          {!codeSent ? (
            <>
              <TextField
                label={t('auth.email')}
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                inputMode="email"
                onSubmitEditing={sendCode}
                error={error}
              />
              <Button label={t('auth.sendCode')} onPress={sendCode} loading={busy} />
            </>
          ) : (
            <>
              <Muted>{t('auth.codeSentTo', { email })}</Muted>
              <TextField
                label={t('auth.code')}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                onSubmitEditing={verify}
                error={error}
              />
              <Button label={t('auth.verify')} onPress={verify} loading={busy} disabled={code.trim().length < 6} />
              <Button
                label={t('auth.changeEmail')}
                variant="secondary"
                onPress={() => {
                  setCodeSent(false);
                  setCode('');
                  setError(null);
                }}
              />
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginBottom: 8 },
});
