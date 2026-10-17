import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DateTimeField } from '@/components/DateTimeField';
import { Text, View } from '@/components/Themed';
import { Button, Chip, FieldLabel, Muted, TextField, useColors } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { useCurrentPosition } from '@/lib/location';
import { placeSearchAvailable, searchPlaces, type Place } from '@/lib/places';
import type { NewPhoto } from '@/lib/queries';
import { eventPhotoUrl } from '@/lib/supabase';
import { eventCategories, type EventCategory } from '@/lib/types';

const MAX_PHOTOS = 6;

export type EventFormValues = {
  title: string;
  description: string;
  category: EventCategory;
  startsAt: Date;
  endsAt: Date | null;
  maxParticipants: number | null;
  latitude: number;
  longitude: number;
  address: string;
  areaLabel: string;
  isPrivate: boolean;
  newPhotos: NewPhoto[];
  removedPhotoPaths: string[];
};

export type EventFormInitial = Omit<EventFormValues, 'newPhotos' | 'removedPhotoPaths'> & { photoPaths: string[] };

type Errors = Partial<Record<'title' | 'place' | 'starts' | 'ends' | 'max', string>>;

type Props = {
  // Missing for a new event.
  initial?: EventFormInitial;
  submitLabel: string;
  busy: boolean;
  // The error from the last save, if it failed.
  error: unknown;
  onSubmit: (values: EventFormValues) => void;
};

// Tomorrow at 20:00, a sensible first suggestion for the start.
function defaultStart() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(20, 0, 0, 0);
  return date;
}

export function EventForm({ initial, submitLabel, busy, error, onSubmit }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const position = useCurrentPosition();

  const initialPlace: Place | null = initial
    ? {
        id: 'current',
        name: initial.address,
        address: initial.address,
        areaLabel: initial.areaLabel,
        latitude: initial.latitude,
        longitude: initial.longitude,
      }
    : null;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<EventCategory>(initial?.category ?? 'social');
  const [startsAt, setStartsAt] = useState<Date | null>(initial?.startsAt ?? defaultStart());
  const [endsAt, setEndsAt] = useState<Date | null>(initial?.endsAt ?? null);
  const [maxParticipants, setMaxParticipants] = useState(initial?.maxParticipants?.toString() ?? '');
  const [query, setQuery] = useState(initialPlace?.name ?? '');
  const [results, setResults] = useState<Place[]>([]);
  const [place, setPlace] = useState<Place | null>(initialPlace);
  const [address, setAddress] = useState(initial?.address ?? '');
  const [areaLabel, setAreaLabel] = useState(initial?.areaLabel ?? '');
  const [keptPhotos, setKeptPhotos] = useState<string[]>(initial?.photoPaths ?? []);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate ?? false);
  const [errors, setErrors] = useState<Errors>({});

  const near = position.status === 'loading' ? null : position.coords;
  const photoCount = keptPhotos.length + newPhotos.length;

  // Search as the person types, a moment after they stop.
  useEffect(() => {
    if (!placeSearchAvailable || !near || query.trim().length < 3 || query === place?.name) return;
    const timer = setTimeout(() => {
      searchPlaces(query, near, i18n.language)
        .then(setResults)
        .catch(() => setResults([]));
    }, 350);
    return () => clearTimeout(timer);
  }, [query, near, i18n.language, place?.name]);

  const choosePlace = (chosen: Place) => {
    setPlace(chosen);
    setQuery(chosen.name);
    setResults([]);
    setAddress(chosen.address);
    setAreaLabel(chosen.areaLabel);
  };

  const pickPhotos = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photoCount,
      quality: 0.8,
    });
    if (picked.canceled) return;
    const added = picked.assets.map((asset) => ({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' }));
    setNewPhotos((current) => [...current, ...added].slice(0, MAX_PHOTOS - keptPhotos.length));
  };

  const submit = () => {
    const next: Errors = {};
    if (title.trim().length < 3) next.title = t('create.titleShort');
    if (placeSearchAvailable && !place) next.place = t('create.pickPlace');
    else if (!address.trim() || !areaLabel.trim()) next.place = t('create.addressRequired');
    if (!startsAt || startsAt <= new Date()) next.starts = t('create.startInPast');
    if (startsAt && endsAt && endsAt <= startsAt) next.ends = t('create.endBeforeStart');
    const max = maxParticipants.trim() === '' ? null : Number(maxParticipants);
    if (max !== null && (!Number.isInteger(max) || max < 1)) next.max = t('create.maxInvalid');
    setErrors(next);
    if (Object.keys(next).length > 0 || !startsAt) return;

    // Without place search a new event sits at the organizer's current position, and an
    // edited one stays where it was.
    const point = place ?? near;
    if (!point) return;

    onSubmit({
      title,
      description,
      category,
      startsAt,
      endsAt,
      maxParticipants: max,
      latitude: point.latitude,
      longitude: point.longitude,
      address,
      areaLabel,
      isPrivate,
      newPhotos,
      removedPhotoPaths: (initial?.photoPaths ?? []).filter((path) => !keptPhotos.includes(path)),
    });
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled">
        <TextField label={t('create.name')} value={title} onChangeText={setTitle} maxLength={120} error={errors.title} />
        <TextField
          label={t('create.description')}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={4000}
          style={styles.multiline}
        />

        <View style={styles.group}>
          <FieldLabel>{t('create.category')}</FieldLabel>
          <View style={styles.chips}>
            {eventCategories.map((c) => (
              <Chip key={c} label={t(`categories.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
        </View>

        <DateTimeField
          label={t('create.starts')}
          value={startsAt}
          onChange={setStartsAt}
          initialValue={defaultStart()}
          minimumDate={new Date()}
          error={errors.starts}
        />
        <DateTimeField
          label={t('create.ends')}
          value={endsAt}
          onChange={setEndsAt}
          initialValue={startsAt ? new Date(startsAt.getTime() + 2 * 60 * 60 * 1000) : defaultStart()}
          minimumDate={startsAt ?? new Date()}
          clearable
          error={errors.ends}
        />
        <TextField
          label={t('create.maxParticipants')}
          hint={t('create.maxParticipantsHint')}
          value={maxParticipants}
          onChangeText={setMaxParticipants}
          keyboardType="number-pad"
          inputMode="numeric"
          error={errors.max}
        />

        <View style={styles.group}>
          <FieldLabel>{t('create.place')}</FieldLabel>
          {placeSearchAvailable ? (
            <>
              <TextField
                label={t('create.placeSearch')}
                value={query}
                onChangeText={(value) => {
                  setQuery(value);
                  setPlace(null);
                }}
                error={!place ? errors.place : null}
              />
              {results.map((result) => (
                <Pressable
                  key={result.id}
                  accessibilityRole="button"
                  onPress={() => choosePlace(result)}
                  style={[styles.result, { borderColor: colors.border }]}>
                  <Text style={styles.resultName}>{result.name}</Text>
                  <Muted>{result.address}</Muted>
                </Pressable>
              ))}
            </>
          ) : (
            !initial && <Muted>{t('create.noPlaceSearch')}</Muted>
          )}
          {(!placeSearchAvailable || place) && (
            <>
              <TextField label={t('create.address')} value={address} onChangeText={setAddress} maxLength={300} />
              <TextField
                label={t('create.area')}
                hint={t('create.areaHint')}
                value={areaLabel}
                onChangeText={setAreaLabel}
                maxLength={120}
                error={errors.place && (place || !placeSearchAvailable) ? errors.place : null}
              />
            </>
          )}
        </View>

        <View style={styles.group}>
          <FieldLabel>{t('create.photos')}</FieldLabel>
          <View style={styles.photos}>
            {keptPhotos.map((path) => (
              <View key={path} style={styles.photo}>
                <Image source={{ uri: eventPhotoUrl(path) }} style={styles.photoImage} contentFit="cover" />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setKeptPhotos((current) => current.filter((p) => p !== path))}>
                  <Text style={{ color: colors.danger }}>{t('create.removePhoto')}</Text>
                </Pressable>
              </View>
            ))}
            {newPhotos.map((photo, index) => (
              <View key={photo.uri} style={styles.photo}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setNewPhotos((current) => current.filter((_, i) => i !== index))}>
                  <Text style={{ color: colors.danger }}>{t('create.removePhoto')}</Text>
                </Pressable>
              </View>
            ))}
          </View>
          {photoCount < MAX_PHOTOS && <Button label={t('create.addPhoto')} variant="secondary" onPress={pickPhotos} />}
        </View>

        <View style={styles.privateRow}>
          <View style={styles.privateText}>
            <Text style={styles.privateLabel}>{t('create.private')}</Text>
            <Muted>{t('create.privateHint')}</Muted>
          </View>
          <Switch
            accessibilityLabel={t('create.private')}
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>

        {!!error && <Text style={{ color: colors.danger }}>{errorText(t, error)}</Text>}
        <Button label={submitLabel} onPress={submit} loading={busy} disabled={!near && !place} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  privateText: { flex: 1, gap: 2 },
  privateLabel: { fontSize: 16, fontWeight: '600' },
  form: {
    padding: 16,
    gap: 20,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingBottom: 48,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  group: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  result: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 2 },
  resultName: { fontWeight: '600' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photo: { gap: 4, alignItems: 'center' },
  photoImage: { width: 96, height: 96, borderRadius: 10 },
});
