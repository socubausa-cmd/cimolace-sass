import { supabase } from './supabase';

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4002').replace(/\/+$/, '');
const TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'isna';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? process.env.EXPO_PUBLIC_DEV_TOKEN;
  if (!token) throw new Error('Session expirée. Reconnecte-toi.');

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Slug': TENANT_SLUG,
      ...init?.headers,
    },
  });
  const json = await response.json().catch(() => null) as { data?: T; message?: string } | T | null;
  if (!response.ok) {
    const message = json && !Array.isArray(json) && typeof json === 'object' && 'message' in json
      ? String(json.message)
      : `Erreur ${response.status}`;
    throw new Error(message);
  }
  return ((json as { data?: T } | null)?.data ?? json) as T;
}

export interface ForumTopicDetail {
  id: string;
  title: string;
  content?: string;
  category?: string;
  author_id?: string;
  created_at?: string;
  is_locked?: boolean;
}

export interface ForumPost {
  id: string;
  content: string;
  author_id?: string;
  created_at?: string;
}

export interface CommunityMember {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string;
  status?: string;
}

export const getForumTopic = (id: string) =>
  request<ForumTopicDetail>(`/forum/topics/${encodeURIComponent(id)}`);

export const getForumPosts = (id: string) =>
  request<ForumPost[]>(`/forum/topics/${encodeURIComponent(id)}/posts`);

export const replyToForumTopic = (id: string, content: string) =>
  request<ForumPost>(`/forum/topics/${encodeURIComponent(id)}/posts`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

export async function getCommunityMembers(): Promise<CommunityMember[]> {
  const members = await request<CommunityMember[]>('/tenant-portal/members');
  const { data } = await supabase.auth.getUser();
  return (members ?? []).filter((member) =>
    member.user_id !== data.user?.id && (!member.status || member.status === 'active'),
  );
}

export const sendDirectMessage = (recipientId: string, content: string) =>
  request(`/messaging/send`, {
    method: 'POST',
    body: JSON.stringify({ recipientId, content }),
  });
