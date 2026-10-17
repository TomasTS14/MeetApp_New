import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EventForm } from '@/components/EventForm';
import { useCreateEvent } from '@/lib/queries';

export default function NewEventScreen() {
  const { t } = useTranslation();
  const createEvent = useCreateEvent();

  return (
    <EventForm
      submitLabel={t('create.submit')}
      busy={createEvent.isPending}
      error={createEvent.error}
      onSubmit={(values) =>
        createEvent.mutate(
          { ...values, photos: values.newPhotos },
          { onSuccess: (id) => router.replace({ pathname: '/event/[id]', params: { id } }) }
        )
      }
    />
  );
}
