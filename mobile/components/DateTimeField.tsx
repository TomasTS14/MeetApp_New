import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/Themed';
import { FieldLabel, useColors } from '@/components/ui';
import { formatEventDate } from '@/lib/dates';

export type DateTimeFieldProps = {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  // Fallback when the field is empty and the person opens it.
  initialValue: Date;
  minimumDate?: Date;
  clearable?: boolean;
  error?: string | null;
};

export function DateTimeField({ label, value, onChange, initialValue, minimumDate, clearable, error }: DateTimeFieldProps) {
  const { t, i18n } = useTranslation();
  const colors = useColors();

  // Android has no combined picker, so the date dialog is followed by the time dialog.
  const openAndroid = () => {
    const start = value ?? initialValue;
    DateTimePickerAndroid.open({
      value: start,
      mode: 'date',
      minimumDate,
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onChange: (timeEvent, time) => {
            if (timeEvent.type === 'set' && time) onChange(time);
          },
        });
      },
    });
  };

  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.row}>
        {Platform.OS === 'ios' && value ? (
          <DateTimePicker
            value={value}
            mode="datetime"
            display="compact"
            minimumDate={minimumDate}
            locale={i18n.language}
            onChange={(_event, date) => date && onChange(date)}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => (Platform.OS === 'android' ? openAndroid() : onChange(initialValue))}
            style={[styles.value, { borderColor: error ? colors.danger : colors.border }]}>
            <Text>{value ? formatEventDate(value.toISOString(), i18n.language) : t('create.pickDate')}</Text>
          </Pressable>
        )}
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
  value: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: { fontSize: 13 },
});
