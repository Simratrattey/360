import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Plus, 
  Search, 
  Phone,
  Mail,
  Video,
  MessageSquare,
  MoreVertical,
  Edit,
  Trash2,
  UserPlus,
  Star,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phone: '',
    department: ''
  });

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || 
                         (filter === 'favorites' && contact.favorite) ||
                         (filter === 'online' && contact.status === 'online');
    return matchesSearch && matchesFilter;
  });

  const addContact = () => {
    const contact = {
      id: Date.now(),
      ...newContact,
      avatar: null,
      status: 'offline',
      favorite: false
    };
    setContacts([contact, ...contacts]);
    setShowAddModal(false);
    setNewContact({ name: '', email: '', phone: '', department: '' });
  };

  const toggleFavorite = (id) => {
    setContacts(contacts.map(contact => 
      contact.id === id ? { ...contact, favorite: !contact.favorite } : contact
    ));
  };

  const deleteContact = (id) => {
    setContacts(contacts.filter(contact => contact.id !== id));
  };

  const startVideoCall = (contact) => {
    const roomId = Date.now().toString();
    navigate(`/meeting/${roomId}`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') {
      return 'U';
    }
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="relative space-y-8">
      {/* Hero background illustration */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[80vw] h-[40vh] bg-gradient-to-br from-blue-400/30 via-purple-400/20 to-pink-400/10 rounded-full blur-3xl opacity-60 animate-pulse" />
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-gradient-to-br from-purple-400/30 to-blue-400/10 rounded-full blur-2xl opacity-40" />
      </div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-primary-800 flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-blue-400 animate-bounce" />
            Contacts
          </h1>
          <p className="text-secondary-700 mt-2 text-lg">Manage your contacts and team members</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center space-x-2 px-6 py-3 text-lg rounded-xl shadow-lg"
        >
          <UserPlus className="h-5 w-5" />
          <span>Add Contact</span>
        </motion.button>
      </motion.div>

      {/* Search and Filters */}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="glass-effect card bg-white/70 shadow-xl rounded-2xl p-6 border border-white/30">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-secondary-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg bg-white/60"
            />
          </div>
          <div className="flex gap-2 items-center">
            {['all', 'favorites', 'online'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-5 py-2 rounded-xl text-base font-semibold transition-colors shadow-sm border border-white/20 ${
                  filter === status
                    ? 'bg-gradient-to-r from-blue-400/30 to-purple-400/30 text-primary-700 shadow-lg'
                    : 'bg-secondary-100 text-secondary-600 hover:bg-white/20 hover:text-primary-600'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredContacts.length === 0 ? (
          <div className="col-span-full text-center text-secondary-500 py-16 text-xl">No contacts found.</div>
        ) : filteredContacts.map((contact, idx) => (
          <motion.div
            key={contact.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07, duration: 0.5 }}
            className="glass-effect bg-white/70 shadow-xl rounded-2xl p-6 flex flex-col gap-4 border border-white/30 hover:scale-105 hover:shadow-2xl transition-transform duration-200"
          >
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {contact.avatar ? (
                  <img src={contact.avatar} alt={contact.name} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  getInitials(contact.name)
                )}
                <span className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white ${getStatusColor(contact.status)}`}></span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-primary-800">{contact.name}</h2>
                  <button onClick={() => toggleFavorite(contact.id)} className="ml-1">
                    <Star className={`h-5 w-5 ${contact.favorite ? 'text-yellow-400 fill-yellow-400' : 'text-secondary-400'}`} />
                  </button>
                </div>
                <p className="text-secondary-600 text-sm">{contact.department}</p>
                <p className="text-secondary-500 text-sm">{contact.email}</p>
                <p className="text-secondary-400 text-xs">{contact.phone}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => startVideoCall(contact)} className="bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full p-2 shadow">
                  <Video className="h-5 w-5" />
                </button>
                <button onClick={() => navigate(`/messages?to=${contact.id}`)} className="bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-full p-2 shadow">
                  <MessageSquare className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowAddModal(true)} className="bg-green-100 hover:bg-green-200 text-green-600 rounded-lg px-3 py-1 text-sm font-semibold shadow">Edit</button>
              <button onClick={() => deleteContact(contact.id)} className="bg-red-100 hover:bg-red-200 text-red-600 rounded-lg px-3 py-1 text-sm font-semibold shadow">Delete</button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.3 }} className="glass-effect bg-white/90 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/30">
            <h2 className="text-2xl font-bold text-primary-800 mb-4">Add Contact</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Full Name" value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} className="input-field w-full" />
              <input type="email" placeholder="Email" value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })} className="input-field w-full" />
              <input type="text" placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({ ...newContact, phone: e.target.value })} className="input-field w-full" />
              <input type="text" placeholder="Department" value={newContact.department} onChange={e => setNewContact({ ...newContact, department: e.target.value })} className="input-field w-full" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary px-6 py-2 rounded-xl">Cancel</button>
              <button onClick={addContact} className="btn-primary px-6 py-2 rounded-xl">Add</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
} 