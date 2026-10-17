import { createElement } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/Themed';
import { FieldLabel, useColors } from '@/components/ui';
import type { DateTimeFieldProps } from './DateTimeField';

// "YYYY-MM-DDTHH:mm" in local time, the format <input type="datetime-local"> uses.
function toInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// In browsers the native date and time input is the most usable picker.
export function DateTimeField({ label, value, onChange, minimumDate, clearable, error }: DateTimeFieldProps) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.row}>
        {createElement('input', {
          type: 'datetime-local',
          'aria-label': label,
          value: value ? toInputValue(value) : '',
          min: minimumDate ? toInputValue(minimumDate) : undefined,
          onChange: (event: { target: { value: string } }) =>
            onChange(event.target.value ? new Date(event.target.value) : null),
          style: {
            font: 'inherit',
            fontSize: 16,
            color: colors.text,
            background: 'transparent',
            colorScheme: 'light dark',
            border: `1px solid ${error ? colors.danger : colors.border}`,
            borderRadius: 10,
            padding: '10px 12px',
          },
        })}
        {clearable && value && (
          <Pressable accessibilityRole="button" onPress={() => onChange(null)}>
            <Text style={{ color: colors.accent }}>{t('create.clear')}</Text>
          </Pressable>
        )}
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  error: { fontSize: 13 },
});
