import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../../api/notificationApi';

function relativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationApi.list({ limit: 12 });
      setNotifications(res.data.data);
      setUnread(res.data.meta.unread);
    } catch {
      // A notification failure should never interrupt a user's main workflow.
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30_000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  const openPanel = () => {
    setIsOpen((open) => !open);
    if (!isOpen) loadNotifications();
  };

  const openNotification = async (notification) => {
    if (!notification.readAt) {
      setNotifications((items) => items.map((item) => (item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item)));
      setUnread((count) => Math.max(0, count - 1));
      notificationApi.markRead(notification._id).catch(() => loadNotifications());
    }
    setIsOpen(false);
    if (notification.link) navigate(notification.link);
  };

  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setUnread(0);
    } catch {
      loadNotifications();
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPanel}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={isOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-navy transition-colors hover:bg-off-white focus-visible:outline-indigo"
      >
        <span aria-hidden="true" className="text-lg">&#128276;</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-indigo px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <section className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate/15 bg-white shadow-xl" aria-label="Notifications">
          <header className="flex items-center justify-between border-b border-slate/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-navy">Notifications</h2>
              <p className="text-xs text-slate">Updates assigned to your role</p>
            </div>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs font-medium text-indigo hover:underline">
                Mark all read
              </button>
            )}
          </header>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate">You are all caught up.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  type="button"
                  key={notification._id}
                  onClick={() => openNotification(notification)}
                  className={`w-full border-b border-slate/10 px-4 py-3 text-left transition-colors last:border-0 hover:bg-off-white ${
                    notification.readAt ? 'bg-white' : 'bg-indigo/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-navy">{notification.title}</p>
                    <span className="shrink-0 text-[11px] text-slate">{relativeTime(notification.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate">{notification.message}</p>
                </button>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
