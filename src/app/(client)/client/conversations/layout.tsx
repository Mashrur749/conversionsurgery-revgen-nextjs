/**
 * Override the parent layout padding for the conversations page.
 * The split-pane chat layout needs maximum vertical space.
 * We use -my-6 to cancel the parent py-6, then add minimal padding back.
 */
export default function ConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="-my-6 py-2">{children}</div>;
}
