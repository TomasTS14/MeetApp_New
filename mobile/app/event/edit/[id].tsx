import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EventForm } from '@/components/EventForm';
import { Centered, Loading, Muted } from '@/components/ui';
import { useEvent, useUpdateEvent } from '@/lib/queries';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const event = useEvent(id);
  const updateEvent = useUpdateEvent(id);

  if (event.isPending) return <Loading />;
  const e = event.data;
  // Only the organizer gets the exact address back, so it doubles as the permission check.
  if (!e || !e.is_organizer || !e.address) {
    return (
      <Centered>
        <Muted>{t('event.notFound')}</Muted>
      </Centered>
    );
  }

  return (
    <EventForm
      initial={{
        title: e.title,
        description: e.description,
        category: e.category,
        startsAt: new Date(e.starts_at),
        endsAt: e.ends_at ? new Date(e.ends_at) : null,
        maxParticipants: e.max_participants,
        latitude: e.latitude,
        longitude: e.longitude,
        address: e.address,
        areaLabel: e.area_label,
        photoPaths: e.photo_paths ?? [],
      }}
      submitLabel={t('edit.submit')}
      busy={updateEvent.isPending}
      error={updateEvent.error}
      onSubmit={(values) => updateEvent.mutate(values, { onSuccess: () => router.back() })}
    />
  );
}
