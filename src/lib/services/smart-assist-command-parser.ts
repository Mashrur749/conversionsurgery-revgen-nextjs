export type SmartAssistCommand =
  | { matched: false }
  | { matched: true; action: 'approve'; referenceCode: string }
  | { matched: true; action: 'cancel'; referenceCode: string }
  | {
      matched: true;
      action: 'edit';
      referenceCode: string;
      editedContent: string;
    };

const APPROVE_PATTERN = /^(?:SEND|APPROVE)\s+([A-Z0-9]{4,12})$/i;
const CANCEL_PATTERN = /^CANCEL\s+([A-Z0-9]{4,12})$/i;
const EDIT_PATTERN = /^EDIT\s+([A-Z0-9]{4,12})\s*[:\-]\s*(.+)$/is;

export function parseSmartAssistCommand(messageBody: string): SmartAssistCommand {
  const body = messageBody.trim();
  if (!body) {
    return { matched: false };
  }

  const approveMatch = body.match(APPROVE_PATTERN);
  if (approveMatch) {
    return {
      matched: true,
      action: 'approve',
      referenceCode: approveMatch[1].toUpperCase(),
    };
  }

  const cancelMatch = body.match(CANCEL_PATTERN);
  if (cancelMatch) {
    return {
      matched: true,
      action: 'cancel',
      referenceCode: cancelMatch[1].toUpperCase(),
    };
  }

  const editMatch = body.match(EDIT_PATTERN);
  if (editMatch) {
    const editedContent = editMatch[2].trim();
    if (!editedContent) {
      return { matched: false };
    }
    return {
      matched: true,
      action: 'edit',
      referenceCode: editMatch[1].toUpperCase(),
      editedContent,
    };
  }

  return { matched: false };
}
