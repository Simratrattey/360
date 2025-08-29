import React, { createContext, useContext, useState, useCallback } from 'react';

const CurrentConversationContext = createContext();

export const useCurrentConversation = () => {
  const context = useContext(CurrentConversationContext);
  if (!context) {
    throw new Error('useCurrentConversation must be used within a CurrentConversationProvider');
  }
  return context;
};

export const CurrentConversationProvider = ({ children }) => {
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [isOnMessagesPage, setIsOnMessagesPage] = useState(false);

  const updateCurrentConversation = useCallback((conversationId) => {
    setCurrentConversationId(conversationId);
  }, []);

  const updateMessagesPageStatus = useCallback((isOnMessages) => {
    setIsOnMessagesPage(isOnMessages);
  }, []);

  const clearCurrentConversation = useCallback(() => {
    setCurrentConversationId(null);
  }, []);

  const value = {
    currentConversationId,
    isOnMessagesPage,
    updateCurrentConversation,
    updateMessagesPageStatus,
    clearCurrentConversation
  };

  return (
    <CurrentConversationContext.Provider value={value}>
      {children}
    </CurrentConversationContext.Provider>
  );
};