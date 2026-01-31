// SOCKET CONNECTION TEST - Add this temporarily to test socket connection
// File: src/components/SocketTest.js

import { useEffect, useState } from 'react';
import socket from '../socket';

export default function SocketTest() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Test connection
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setConnected(true);
      addEvent('Connected to server');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
      addEvent('Disconnected from server');
    });

    // Test events
    socket.on('newRequestCreated', (data) => {
      console.log('Test: New request received', data);
      addEvent(`New request: ${data.userName} - ${data.category}`);
    });

    socket.on('requestAccepted', (data) => {
      console.log('Test: Request accepted', data);
      addEvent(`Request accepted by ${data.helperName}`);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('newRequestCreated');
      socket.off('requestAccepted');
    };
  }, []);

  const addEvent = (message) => {
    setEvents(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testEmit = () => {
    socket.emit('createRequest', {
      requestId: 'test-123',
      userId: 'test-user',
      userName: 'Test User',
      category: 'Test Category',
      description: 'Test Description'
    });
    addEvent('Test request emitted');
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      left: '10px', 
      background: 'white', 
      border: '1px solid #ccc', 
      padding: '10px',
      maxWidth: '300px',
      maxHeight: '200px',
      overflow: 'auto',
      zIndex: 9999,
      fontSize: '12px'
    }}>
      <h6>Socket Test</h6>
      <p>Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      <button onClick={testEmit} style={{ fontSize: '12px', padding: '2px 6px' }}>
        Test Emit
      </button>
      <div style={{ marginTop: '10px' }}>
        <strong>Events:</strong>
        {events.slice(-5).map((event, i) => (
          <div key={i} style={{ fontSize: '10px' }}>{event}</div>
        ))}
      </div>
    </div>
  );
}

// To use this test component, temporarily add it to your App.js:
// import SocketTest from './components/SocketTest';
// 
// And add <SocketTest /> in your App component