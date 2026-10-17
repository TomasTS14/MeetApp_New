import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DateTimeField } from '@/components/DateTimeField';
import { Text, View } from '@/components/Themed';
import { Button, Chip, FieldLabel, Muted, TextField, useColors } from '@/components/ui';
import { useCurrentPosition } from '@/lib/location';
import { placeSearchAvailable, searchPlaces, type Place } from '@/lib/places';
import { useCreateEvent } from '@/lib/queries';
import { eventCategories, type EventCategory } from '@/lib/types';

const MAX_PHOTOS = 6;

type Photo = { uri: string; mimeType: string };
type Errors = Partial<Record<'title' | 'place' | 'starts' | 'ends' | 'max', string>>;

// Tomorrow at 20:00, a sensible first suggestion for the start.
function defaultStart() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(20, 0, 0, 0);
  return date;
}

export default function NewEventScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const position = useCurrentPosition();
  const createEvent = useCreateEvent();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('social');
  const [startsAt, setStartsAt] = useState<Date | null>(defaultStart);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const [address, setAddress] = useState('');
  const [areaLabel, setAreaLabel] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [errors, setErrors] = useState<Errors>({});

  const near = position.status === 'loading' ? null : position.coords;

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
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.8,
    });
    if (picked.canceled) return;
    const added = picked.assets.map((asset) => ({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' }));
    setPhotos((current) => [...current, ...added].slice(0, MAX_PHOTOS));
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

    // Without place search the event sits at the organizer's current position.
    const point = place ?? near;
    if (!point) return;

    createEvent.mutate(
      {
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
        photos,
      },
      { onSuccess: (id) => router.replace({ pathname: '/event/[id]', params: { id } }) }
    );
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
            <Muted>{t('create.noPlaceSearch')}</Muted>
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
            {photos.map((photo, index) => (
              <View key={photo.uri} style={styles.photo}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPhotos((current) => current.filter((_, i) => i !== index))}>
                  <Text style={{ color: colors.danger }}>{t('create.removePhoto')}</Text>
                </Pressable>
              </View>
            ))}
          </View>
          {photos.length < MAX_PHOTOS && (
            <Button label={t('create.addPhoto')} variant="secondary" onPress={pickPhotos} />
          )}
        </View>

        {createEvent.isError && <Text style={{ color: colors.danger }}>{t('common.error')}</Text>}
        <Button label={t('create.submit')} onPress={submit} loading={createEvent.isPending} disabled={!near} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
