import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from './ui/Theme';
import { Send, Bot, User, AlertCircle, RefreshCw } from 'lucide-react';

// Generate and persist guest ID
function getGuestId() {
  const key = 'liirat_guest_id';
  let guestId = localStorage.getItem(key);
  if (!guestId) {
    guestId = 'guest_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem(key, guestId);
  }
  return guestId;
}

// Chat bubble component
function ChatBubble({ message, isUser }) {
  if (!message) return null;

  const bubbleClass = isUser
    ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow"
    : "neumorphic-pressed text-primary";

  const BotOrUser = ({ className }) =>
    isUser ? <User className={className} /> : <Bot className={className} style={{ color: '#7cb342' }} />;

  const renderToolCalls = (toolCalls) => {
    if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) return null;
    
    return toolCalls.map((toolCall, idx) => (
      <div key={idx} className="mt-2 text-xs">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            {toolCall.function?.name || toolCall.name || 'function'}
          </span>
        </div>
      </div>
    ));
  };

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      {!isUser && (
        <div className="h-8 w-8 neumorphic-raised rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
          <BotOrUser className="w-4 h-4" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser && "flex flex-col items-end"}`}>
        <div className={`${bubbleClass} p-3 rounded-2xl break-words ${message.isError ? 'border-2 border-red-300' : ''}`}>
          <div className="whitespace-pre-wrap">
            {String(message.content || "")}
          </div>
        </div>
        {!isUser && renderToolCalls(message.tool_calls)}
      </div>
      {isUser && (
        <div className="h-8 w-8 neumorphic-raised rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
          <BotOrUser className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}

export default function PublicAgentBubble() {
  const { language, theme } = useTheme() || { language: "ar", theme: "dark" };
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [symbol, setSymbol] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState("15m");
  
  const endRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Initialize conversation and subscription
  useEffect(() => {
    const initializeConversation = async () => {
      try {
        console.log('[PUBLIC_CHAT] 🚀 Initializing conversation...');
        setIsInitializing(true);
        setError(null);

        const guestId = getGuestId();
        console.log('[PUBLIC_CHAT] Guest ID:', guestId);

        // ✅ FIXED: Use correct function path
        const response = await fetch('/functions/publicAgentConversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            guestId,
            locale: language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            metadata: {
              symbol,
              timeframe
            }
          })
        });

        console.log('[PUBLIC_CHAT] Init response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[PUBLIC_CHAT] Init failed:', errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('[PUBLIC_CHAT] Init response data:', data);
        
        if (!data.success || !data.conversation_id) {
          throw new Error('Invalid response: missing conversation_id');
        }

        setConversationId(data.conversation_id);
        console.log('[PUBLIC_CHAT] ✅ Conversation initialized:', data.conversation_id);

        // Start subscription
        startSubscription(data.conversation_id);

      } catch (err) {
        console.error('[PUBLIC_CHAT] ❌ Initialization failed:', err);
        setError(`Failed to initialize chat: ${err.message}`);
      } finally {
        setIsInitializing(false);
      }
    };

    const startSubscription = (convId) => {
      try {
        console.log('[PUBLIC_CHAT] 🔗 Starting subscription for:', convId);
        
        const eventSource = new EventSource(`/functions/publicAgentSubscribe?conversation_id=${convId}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log('[PUBLIC_CHAT] ✅ Subscription connected');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[PUBLIC_CHAT] 📨 Received event:', data);

            if (data.type === 'message_update' && data.messages) {
              setMessages(prevMessages => {
                const welcomeMessage = prevMessages.find(m => m.id === 'welcome');
                const newMessages = data.messages.filter(m => m.id !== 'welcome');
                
                // Parse agent responses
                const parsedMessages = newMessages.map(msg => {
                  if (msg.role === 'assistant') {
                    let primaryText = "";
                    
                    if (msg.response) {
                      primaryText = String(msg.response);
                    } else if (msg.content) {
                      primaryText = typeof msg.content === 'object' ? 
                        (msg.content.response || msg.content.content || JSON.stringify(msg.content)) :
                        String(msg.content);
                    } else if (msg.message) {
                      primaryText = String(msg.message);
                    }
                    
                    return {
                      ...msg,
                      content: primaryText,
                      tool_calls: msg.tool_calls || []
                    };
                  }
                  return msg;
                });
                
                const allMessages = welcomeMessage ? [welcomeMessage, ...parsedMessages] : parsedMessages;
                
                return allMessages.sort((a, b) => 
                  new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
                );
              });
              setTyping(false);
            }
          } catch (e) {
            console.error('[PUBLIC_CHAT] Event parsing error:', e);
          }
        };

        eventSource.onerror = (error) => {
          console.error('[PUBLIC_CHAT] ❌ Subscription error:', error);
          setError('Connection lost. Please refresh the page.');
        };

      } catch (err) {
        console.error('[PUBLIC_CHAT] ❌ Subscription failed:', err);
        setError(`Failed to connect: ${err.message}`);
      }
    };

    // Add welcome message
    const welcomeMessage = {
      id: 'welcome',
      role: 'assistant',
      content: language === "ar"
        ? "مرحباً! أنا مساعد ليرات للتداول. يمكنني مساعدتك في تحليل الأسواق والأسعار."
        : "Hello! I'm Liirat's trading assistant. I can help you analyze markets and prices.",
      timestamp: new Date().toISOString()
    };
    setMessages([welcomeMessage]);

    initializeConversation();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [language, symbol, timeframe]);

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Send message function
  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || typing || !conversationId) return;

    setInput("");
    setTyping(true);

    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      console.log('[PUBLIC_CHAT] 📤 Sending message:', msg);

      const response = await fetch('/functions/publicAgentMessages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          role: "user",
          content: msg
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PUBLIC_CHAT] Send failed:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[PUBLIC_CHAT] ✅ Message sent successfully:', result);

    } catch (err) {
      console.error('[PUBLIC_CHAT] ❌ Send error:', err);
      setTyping(false);
      
      const errorMsg = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `Error sending message: ${err.message}`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Show loading state
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: '#7cb342', borderTopColor: 'transparent' }}></div>
          <p className="text-secondary">{language === "ar" ? "جاري التحميل..." : "Initializing..."}</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="neumorphic p-8 rounded-2xl">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-bold text-primary mb-4">
              {language === "ar" ? "خطأ في الاتصال" : "Connection Error"}
            </h2>
            <p className="text-secondary mb-6">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="neumorphic-button px-6 py-3 font-semibold text-white rounded-xl flex items-center gap-2 mx-auto"
              style={{ backgroundColor: '#7cb342' }}
            >
              <RefreshCw className="w-4 h-4" />
              {language === "ar" ? "إعادة المحاولة" : "Retry"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-screen">
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.map((message, index) => (
          <ChatBubble key={message.id || index} message={message} isUser={message.role === 'user'} />
        ))}
        {typing && (
          <div className="flex gap-3 justify-start mb-4">
            <div className="h-8 w-8 neumorphic-raised rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
              <Bot className="w-4 h-4" style={{ color: '#7cb342' }} />
            </div>
            <div className="neumorphic-pressed p-3 rounded-2xl">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Controls */}
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="neumorphic-pressed p-2 rounded-lg outline-none text-primary bg-transparent text-sm"
          >
            <option value="XAUUSD">Gold</option>
            <option value="EURUSD">EUR/USD</option>
            <option value="GBPUSD">GBP/USD</option>
            <option value="BTCUSD">BTC/USD</option>
          </select>
          
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="neumorphic-pressed p-2 rounded-lg outline-none text-primary bg-transparent text-sm"
          >
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="1d">1d</option>
          </select>
        </div>

        <div className="neumorphic-pressed rounded-2xl p-3 flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={language === "ar" ? "اكتب رسالتك هنا..." : "Type your message here..."}
            className="flex-1 bg-transparent outline-none resize-none text-primary placeholder-secondary"
            rows="2"
            disabled={typing || !conversationId}
            style={{ direction: language === "ar" ? "rtl" : "ltr" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || typing || !conversationId}
            className="neumorphic-button p-3 rounded-xl disabled:opacity-50 flex-shrink-0"
            style={{ backgroundColor: '#7cb342', color: 'white' }}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}