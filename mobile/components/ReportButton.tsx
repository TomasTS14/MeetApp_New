import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/Themed';
import { Button, Chip, Muted, TextField, useColors } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { reportReasons, useReport, type ReportReason, type ReportTarget } from '@/lib/moderation';

type Props = {
  targetType: ReportTarget;
  targetId: string;
  // 'link' fits inside a row of small actions; 'button' stands on its own.
  look?: 'link' | 'button';
  textStyle?: object;
};

// "Report" opens a short form: a reason, optional details, Send. Reports go to the
// MeetApp team, never to the person reported.
export function ReportButton({ targetType, targetId, look = 'link', textStyle }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const report = useReport();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');

  const close = () => {
    setOpen(false);
    setReason(null);
    setDetails('');
    report.reset();
  };
  const label = t(`report.${targetType}`);

  return (
    <>
      {look === 'link' ? (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)}>
          <Text style={[textStyle, { color: colors.muted }]}>{t('report.action')}</Text>
        </Pressable>
      ) : (
        <Button label={label} variant="secondary" onPress={() => setOpen(true)} />
      )}
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <ScrollView contentContainerStyle={styles.content}>
              {report.isSuccess ? (
                <>
                  <Text style={styles.title}>{t('report.thanks')}</Text>
                  <Muted>{t('report.thanksHint')}</Muted>
                  <Button label={t('report.done')} onPress={close} />
                </>
              ) : (
                <>
                  <Text style={styles.title}>{label}</Text>
                  <Muted>{t('report.hint')}</Muted>
                  <View style={styles.reasons}>
                    {reportReasons.map((r) => (
                      <Chip key={r} label={t(`report.reasons.${r}`)} selected={reason === r} onPress={() => setReason(r)} />
                    ))}
                  </View>
                  <TextField
                    label={t('report.details')}
                    value={details}
                    onChangeText={setDetails}
                    multiline
                    maxLength={900}
                    style={styles.details}
                  />
                  {report.isError && <Text style={{ color: colors.danger }}>{errorText(t, report.error)}</Text>}
                  <View style={styles.actions}>
                    <Button label={t('common.back')} variant="secondary" onPress={close} style={styles.grow} />
                    <Button
                      label={t('report.send')}
                      variant="danger"
                      disabled={!reason}
                      loading={report.isPending}
                      onPress={() => reason && report.mutate({ targetType, targetId, reason, details })}
                      style={styles.grow}
                    />
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 480, maxHeight: '90%', alignSelf: 'center', borderRadius: 16, borderWidth: 1 },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 20, fontWeight: '700' },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  details: { minHeight: 70, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 8 },
  grow: { flexGrow: 1 },
});
