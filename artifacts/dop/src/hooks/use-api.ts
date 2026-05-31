import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Workspace, Demand, ChatMessage } from '../lib/api/types';

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

export function useDemands(workspaceId?: string) {
  return useQuery({
    queryKey: ['demands', workspaceId],
    queryFn: () => workspaceId ? api.listDemands(workspaceId) : [],
    enabled: !!workspaceId,
  });
}

export function useAllDemands() {
  return useQuery({
    queryKey: ['demands', 'all'],
    queryFn: () => api.listAllDemands(),
  });
}

export function useDemand(workspaceId?: string, demandId?: string) {
  return useQuery({
    queryKey: ['demand', workspaceId, demandId],
    queryFn: () => workspaceId && demandId ? api.getDemand(workspaceId, demandId) : null,
    enabled: !!workspaceId && !!demandId,
  });
}

export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ demandId, text }: { demandId: string; text: string }) => api.sendChatMessage(demandId, text),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['demand'] });
    },
  });
}
