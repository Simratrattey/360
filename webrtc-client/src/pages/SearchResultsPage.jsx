import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import * as conversationAPI from '../api/conversationService';

// Define any “app feature” targets here
const FEATURES = [
  { name: 'Dashboard', path: '/' },
  { name: 'Meetings',   path: '/meetings' },
  { name: 'Messages',   path: '/messages' },
  { name: 'Contacts',   path: '/contacts' },
  { name: 'Settings',   path: '/settings' },
];

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('query') || '').toLowerCase();
  const navigate = useNavigate();

  // All fetched conversations (to treat as “contacts”)
  const [conversations, setConversations] = useState([]);
  useEffect(() => {
    conversationAPI
      .getConversations()
      .then(res => {
        const convos = res.data.conversations || res.data || [];
        setConversations(convos);
      })
      .catch(() => setConversations([]));
  }, []);

  // Filter helpers
  const contactResults = conversations.filter(c => {
    const name = (c.name ||
      c.members.map(m => m.fullName || m.username).join(' ')
    ).toLowerCase();
    return name.includes(query);
  });

  // Placeholder—if you implement a messages-search API, hook it here
  const messageResults = []; 

  // Feature matches
  const featureResults = FEATURES.filter(f =>
    f.name.toLowerCase().includes(query)
  );

  // Dropdown categories
  const CATEGORIES = ['All', 'Contacts', 'Messages', 'Features'];
  const [category, setCategory] = useState('All');

  // Decide what to show based on category
  const showAll = category === 'All';
  const showContacts = showAll || category === 'Contacts';
  const showMessages = showAll || category === 'Messages';
  const showFeatures = showAll || category === 'Features';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Search results for “{query}”
      </h1>

      <div className="flex items-center space-x-3">
        <label className="font-semibold">Category:</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="border rounded px-2 py-1"
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {showContacts && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Contacts</h2>
          {contactResults.length > 0 ? (
            contactResults.map(c => (
              <div
                key={c._id}
                className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/messages?conversation=${c._id}`)}
              >
                {c.name ||
                  c.members.map(m => m.fullName || m.username).join(', ')
                }
              </div>
            ))
          ) : (
            <p className="text-gray-500">No contacts found.</p>
          )}
        </section>
      )}

      {showMessages && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Messages</h2>
          {messageResults.length > 0 ? (
            messageResults.map(msg => (
              <div
                key={msg._id}
                className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/messages?conversation=${msg.conversation}`)}
              >
                <strong>{msg.sender.fullName}:</strong> {msg.text}
              </div>
            ))
          ) : (
            <p className="text-gray-500">No messages found.</p>
          )}
        </section>
      )}

      {showFeatures && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">App Features</h2>
          {featureResults.length > 0 ? (
            featureResults.map(f => (
              <Link
                key={f.path}
                to={f.path}
                className="block p-3 border rounded hover:bg-gray-50"
              >
                {f.name}
              </Link>
            ))
          ) : (
            <p className="text-gray-500">No features match.</p>
          )}
        </section>
      )}
    </div>
  );
}