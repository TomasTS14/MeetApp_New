import { Link } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/Themed';
import { Button, Centered, Loading, Muted, useColors } from '@/components/ui';
import { formatRelative } from '@/lib/dates';
import {
  parseReason,
  useActOnReport,
  useAdminReports,
  useIsAdmin,
  type QueuedReport,
  type ReportAction,
} from '@/lib/moderation';

// The report queue for MeetApp admins: one card per reported thing, most reported first.
export default function AdminScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const isAdmin = useIsAdmin();
  const reports = useAdminReports();

  if (isAdmin.isPending) return <Loading />;
  if (!isAdmin.data) {
    return (
      <Centered>
        <Muted>{t('admin.notAdmin')}</Muted>
      </Centered>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={reports.data ?? []}
      keyExtractor={(r) => `${r.target_type}:${r.target_id}`}
      refreshControl={<RefreshControl refreshing={reports.isRefetching} onRefresh={() => void reports.refetch()} />}
      renderItem={({ item }) => <ReportCard report={item} />}
      ListEmptyComponent={
        reports.isPending ? (
          <Loading />
        ) : reports.isError ? (
          <Muted>{t('common.error')}</Muted>
        ) : (
          <Muted>{t('admin.empty')}</Muted>
        )
      }
    />
  );
}

function ReportCard({ report }: { report: QueuedReport }) {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const act = useActOnReport();
  // Banning asks for a second tap.
  const [confirming, setConfirming] = useState<ReportAction | null>(null);

  const run = (action: ReportAction) => {
    if ((action === 'ban' || action === 'remove_and_ban') && confirming !== action) {
      setConfirming(action);
      return;
    }
    act.mutate({ report, action });
  };
  const isUser = report.target_type === 'user';

  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={styles.type}>{t(`admin.types.${report.target_type}`)}</Text>
        <Text style={[styles.count, { color: colors.danger }]}>{t('admin.reports', { count: report.report_count })}</Text>
      </View>
      <Muted style={styles.small}>{formatRelative(report.first_reported_at, i18n.language)}</Muted>

      {report.event_id && (
        <Link href={{ pathname: '/event/[id]', params: { id: report.event_id } }} asChild>
          <Pressable accessibilityRole="link">
            <Text style={{ color: colors.accent }}>{report.event_title ?? t('admin.gone')}</Text>
          </Pressable>
        </Link>
      )}
      {report.preview ? (
        <Text style={[styles.preview, { borderColor: colors.border }]}>{report.preview}</Text>
      ) : (
        !isUser && <Muted>{t('admin.gone')}</Muted>
      )}
      {report.author_username && (
        <Link href={{ pathname: '/user/[username]', params: { username: report.author_username } }} asChild>
          <Pressable accessibilityRole="link">
            <Text>
              {t('admin.by')} <Text style={styles.author}>@{report.author_username}</Text>
              {report.author_is_banned ? ` · ${t('admin.banned')}` : ''}
            </Text>
          </Pressable>
        </Link>
      )}

      <View style={styles.reasons}>
        {report.reasons.map((stored, i) => {
          const { reason, details } = parseReason(stored);
          return (
            <Text key={i} style={styles.small}>
              <Text style={styles.reason}>{reason ? t(`report.reasons.${reason}`) : t('report.reasons.other')}</Text>
              {details ? `: ${details}` : ''}
            </Text>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button label={t('admin.dismiss')} variant="secondary" onPress={() => run('dismiss')} disabled={act.isPending} style={styles.action} />
        {!isUser && (
          <Button label={t('admin.remove')} variant="secondary" onPress={() => run('remove')} disabled={act.isPending} style={styles.action} />
        )}
        {!report.author_is_banned && report.author_username && (
          <Button
            label={
              confirming === (isUser ? 'ban' : 'remove_and_ban')
                ? t('admin.confirmBan', { username: report.author_username })
                : isUser
                  ? t('admin.ban')
                  : t('admin.removeAndBan')
            }
            variant="danger"
            onPress={() => run(isUser ? 'ban' : 'remove_and_ban')}
            loading={act.isPending}
            style={styles.action}
          />
        )}
      </View>
      {act.isError && <Text style={{ color: colors.danger }}>{t('common.error')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  type: { fontSize: 17, fontWeight: '700' },
  count: { fontWeight: '700' },
  small: { fontSize: 13 },
  preview: { fontSize: 15, lineHeight: 21, borderLeftWidth: 3, paddingLeft: 10 },
  author: { fontWeight: '700' },
  reasons: { gap: 2 },
  reason: { fontWeight: '600', fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  action: { flexGrow: 1 },
});
