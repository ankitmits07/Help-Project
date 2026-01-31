import { useState, useEffect, useContext } from 'react';
import socket from '../socket';
import { AuthContext } from '../context/AuthContext';
import API from '../api/api';

export default function NotificationSystem() {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);

  // Play notification sound
  const playNotificationSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Audio play failed:', e));
  };

  useEffect(() => {
    if (!user) return;

    // Listen for new requests (exclude own requests)
    socket.on("newRequestCreated", (data) => {
      if (data.userId !== user._id) {
        console.log('New request notification:', data);
        playNotificationSound();
        
        const notification = {
          id: Date.now(),
          type: 'request',
          title: 'New Help Request Nearby',
          message: `${data.userName} needs help with ${data.category}`,
          icon: '🆘',
          actions: [
            {
              label: 'Accept',
              type: 'accept',
              handler: () => acceptRequest(data.requestId, notification.id)
            },
            {
              label: 'Deny',
              type: 'deny', 
              handler: () => removeNotification(notification.id)
            }
          ]
        };
        
        addNotification(notification);
      }
    });

    // Listen for request accepted notifications
    socket.on('requestAccepted', (data) => {
      if (data.requesterId === user._id) {
        playNotificationSound();
        addNotification({
          id: Date.now(),
          type: 'accepted',
          title: 'Your Request Accepted!',
          message: `${data.helperName} accepted your help request`,
          icon: '✅'
        });
      }
    });

    // Listen for message notifications
    socket.on('receiveMessage', (data) => {
      if (data.userId !== user._id) {
        playNotificationSound();
        // Only show count, not full notification
        window.dispatchEvent(new CustomEvent('messageNotification', {
          detail: {
            type: 'message',
            count: 1
          }
        }));
      }
    });

    // Listen for chat request notifications
    socket.on('notification', (notification) => {
      if (notification.type === 'chat_request') {
        playNotificationSound();
        addNotification({
          id: Date.now(),
          type: 'chat_request',
          title: notification.title,
          message: notification.message,
          icon: '💬',
          actions: [
            {
              label: 'Accept',
              type: 'accept',
              handler: () => {
                // Allow chat and remove notification
                removeNotification(notification.id);
                window.location.href = `/dashboard?requestId=${notification.requestId}`;
              }
            },
            {
              label: 'Deny',
              type: 'deny',
              handler: () => removeNotification(notification.id)
            }
          ]
        });
      }
    });

    // Listen for custom notification events
    const handleCustomNotification = (event) => {
      playNotificationSound();
      addNotification(event.detail);
    };

    const handleClearAll = () => {
      setNotifications([]);
      window.dispatchEvent(new CustomEvent('notificationUpdate', { 
        detail: { notifications: [] } 
      }));
    };

    window.addEventListener('newNotification', handleCustomNotification);
    window.addEventListener('clearAllNotifications', handleClearAll);

    return () => {
      socket.off('newRequestCreated');
      socket.off('requestAccepted');
      socket.off('receiveMessage');
      window.removeEventListener('newNotification', handleCustomNotification);
      window.removeEventListener('clearAllNotifications', handleClearAll);
    };
  }, [user]);

  const addNotification = (notification) => {
    setNotifications(prev => {
      const updated = [...prev, notification];
      // Update navbar notification count
      window.dispatchEvent(new CustomEvent('notificationUpdate', { 
        detail: { notifications: updated } 
      }));
      return updated;
    });
    
    // Auto remove after 10 seconds if no actions
    if (!notification.actions) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, 10000);
    }
  };

  const removeNotification = (id) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      window.dispatchEvent(new CustomEvent('notificationUpdate', { 
        detail: { notifications: updated } 
      }));
      return updated;
    });
  };

  const acceptRequest = async (requestId, notificationId) => {
    try {
      await API.post(`/requests/${requestId}/accept`);
      
      socket.emit('acceptRequest', {
        requestId,
        helperId: user._id,
        helperName: user.name
      });
      
      removeNotification(notificationId);
      
      // Refresh page to show accepted request
      window.location.reload();
    } catch (err) {
      alert('Failed to accept request: ' + (err.response?.data?.message || err.message));
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="notification-container">
      {notifications.map(notification => (
        <div 
          key={notification.id} 
          className={`notification notification-${notification.type}`}
          onClick={() => !notification.actions && removeNotification(notification.id)}
        >
          <div className="notification-icon">
            {notification.icon}
          </div>
          <div className="notification-content">
            <div className="notification-title">
              {notification.title}
            </div>
            <div className="notification-message">
              {notification.message}
            </div>
            {notification.actions && (
              <div className="notification-actions">
                {notification.actions.map((action, index) => (
                  <button
                    key={index}
                    className={`notification-btn ${action.type}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.handler();
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button 
            className="notification-close"
            onClick={(e) => {
              e.stopPropagation();
              removeNotification(notification.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}