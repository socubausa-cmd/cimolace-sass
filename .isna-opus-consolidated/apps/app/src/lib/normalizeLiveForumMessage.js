/**
 * Forme canonique pour LiveMessageDrawer (forum public).
 */
export function normalizeLiveForumMessage(m) {
  if (!m) return null;
  const id = m.id ?? m.message_id;
  const sender_id = m.sender_id ?? m.user_id ?? m.userId;
  const content = m.content ?? m.text ?? m.message ?? '';
  const sender_name = m.sender_name ?? m.name ?? null;
  return {
    id,
    sender_id,
    content: String(content),
    sender_name,
    created_at: m.created_at ?? m.time ?? null,
  };
}
