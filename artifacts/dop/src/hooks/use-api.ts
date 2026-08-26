import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Workspace, Card, ChatMessage } from '../lib/api/types';

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.listWorkspaces(),
  });
}

export function useWorkspace(id?: string) {
  return useQuery({
    queryKey: ['workspace', id],
    queryFn: () => id ? api.getWorkspace(id) : null,
    enabled: !!id,
  });
}

export function useSaveWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ws: Partial<Workspace>) => api.saveWorkspace(ws),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useCards(workspaceId?: string) {
  return useQuery({
    queryKey: ['cards', workspaceId],
    queryFn: () => workspaceId ? api.listCards(workspaceId) : [],
    enabled: !!workspaceId,
  });
}

// Keeping aliased for retrocompatibility
export const useDemands = useCards;

export function useAllCards() {
  return useQuery({
    queryKey: ['cards', 'all'],
    queryFn: () => api.listAllCards(),
  });
}

export const useAllDemands = useAllCards;

export function useCard(workspaceId?: string, cardId?: string) {
  return useQuery({
    queryKey: ['card', workspaceId, cardId],
    queryFn: () => workspaceId && cardId ? api.getCard(workspaceId, cardId) : null,
    enabled: !!workspaceId && !!cardId,
  });
}

export const useDemand = useCard;

export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, text }: { cardId: string; text: string }) => api.sendChatMessage(cardId, text),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['card'] });
      queryClient.invalidateQueries({ queryKey: ['demand'] });
    },
  });
}
