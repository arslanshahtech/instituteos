import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { useToast } from '../components/ui/ToastProvider.js';

export interface OrganizationSettings {
  organizationId: string;
  branding: {
    logoUrl?: string;
    primaryColor: string;
    tagLine?: string;
  };
  contact: {
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
  };
  localization: {
    timezone: string;
    currency: string;
    dateFormat: string;
  };
  notifications: {
    emailAlerts: boolean;
    smsAlerts: boolean;
    autoAttendanceAlerts: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export type OrganizationSettingsInput = Partial<
  Pick<
    OrganizationSettings,
    'branding' | 'contact' | 'localization' | 'notifications'
  >
>;

const settingsQueryKey = (organizationId: string) =>
  ['organization-settings', organizationId] as const;

const settingsPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/settings`;

export function getOrganizationSettings(organizationId: string) {
  return apiRequest<{ settings: OrganizationSettings }>(
    settingsPath(organizationId),
  );
}

export function updateOrganizationSettings(
  organizationId: string,
  input: OrganizationSettingsInput,
) {
  return apiRequest<{ settings: OrganizationSettings }>(
    settingsPath(organizationId),
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function useOrganizationSettings(
  organizationId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: settingsQueryKey(organizationId),
    queryFn: () => getOrganizationSettings(organizationId),
    enabled: Boolean(organizationId) && enabled,
    retry: false,
  });
}

export function useUpdateOrganizationSettings(organizationId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: (input: OrganizationSettingsInput) =>
      updateOrganizationSettings(organizationId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: settingsQueryKey(organizationId),
      });
      showToast('Organization settings saved.');
    },
  });
}
