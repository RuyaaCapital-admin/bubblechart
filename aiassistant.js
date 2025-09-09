
import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/ui/Theme";
import { useAuth } from "@/components/useAuth";
import { Send, Bot, User, TrendingUp, Newspaper, Calculator, RefreshCw, X, DollarSign } from "lucide-react";
import LightweightPriceChart from "./LightweightPriceChart";
import { ChartProvider, useChart, mergeActions } from "./ChartContext";
import { agentSDK } from "@/agents";

const SYMBOL_TO_TV_SYMBOL = {
  XAUUSD: "OANDA:XAUUSD", XAGUSD: "OANDA:XAGUSD", EURUSD: "OANDA:EURUSD",
  GBPUSD: "OANDA:GBPUSD", USDJPY: "OANDA:USDJPY", BTCUSD: "COINBASE:BTCUSD",
  ETHUSD: "COINBASE:ETHUSD", US30: "FOREXCOM:US30", NAS100: "FOREXCOM:NAS100",
  SPX500: "FOREXCOM:SPXUSD", DXY: "FX:USDOLLAR", DAX: "FOREXCOM:GER40",
  GER40: "FOREXCOM:GER40", DE40: "FOREXCOM:GER40", UK100: "FOREXCOM:UK100",
  FTSE: "FOREXCOM:UK100", JP225: "FOREXCOM:JPN225", NIKKEI: "FOREXCOM:JPN225",
  USOIL: "OANDA:WTICOUSD", UKOIL: "OANDA:BCOUSD", COFFEE: "ICEUS:KC1!"
};

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

const CLIENT_SYMBOLS = Object.keys(SYMBOL_TO_TV_SYMBOL);

// Advanced Risk Calculator Modal Component
function AdvancedRiskCalculator({ language, onCalculate, isOpen, onClose }) {
  const [accountBalance, setAccountBalance] = useState("");
  const [riskPercentage, setRiskPercentage] = useState("2");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [result, setResult] = useState(null);

  const calculateAdvancedRisk = () => {
    if (!accountBalance || !entryPrice || !stopLoss) return;

    const balance = parseFloat(accountBalance);
    const risk = parseFloat(riskPercentage);
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const tp = takeProfit ? parseFloat(takeProfit) : null;

    const riskAmount = balance * risk / 100;
    const pipDifference = Math.abs(entry - sl);
    const positionSize = riskAmount / pipDifference;

    let riskRewardRatio = null;
    let potentialProfit = null;

    if (tp) {
      const profitPips = Math.abs(tp - entry);
      riskRewardRatio = profitPips / pipDifference;
      potentialProfit = positionSize * profitPips;
    }

    const calculationResult = {
      riskAmount: riskAmount.toFixed(2),
      positionSize: positionSize.toFixed(2),
      pipDifference: pipDifference.toFixed(5),
      riskRewardRatio: riskRewardRatio ? riskRewardRatio.toFixed(2) : null,
      potentialProfit: potentialProfit ? potentialProfit.toFixed(2) : null
    };

    setResult(calculationResult);
    onCalculate(calculationResult);
  };

  const resetCalculator = () => {
    setAccountBalance("");
    setRiskPercentage("2");
    setEntryPrice("");
    setStopLoss("");
    setTakeProfit("");
    setResult(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl border bg-[var(--surface)] text-[var(--fg)] border-[var(--border)] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-[var(--fg)] flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-600" />
            {language === "ar" ? "حاسبة المخاطر المتقدمة" : "Advanced Risk Calculator"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-xl border bg-[var(--surfaceAlt)] p-2 text-[var(--muted)] hover:text-[var(--fg)]">

            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-purple-600 dark:text-purple-400 mb-2">
              {language === "ar" ? "رصيد الحساب" : "Account Balance"}
            </label>
            <input
              type="number"
              value={accountBalance}
              onChange={(e) => setAccountBalance(e.target.value)}
              className="w-full p-3 rounded-xl border bg-[var(--surfaceAlt)] text-[var(--fg)] border-[var(--border)] focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="10000" />

          </div>

          <div>
            <label className="block text-sm font-medium text-purple-600 dark:text-purple-400 mb-2">
              {language === "ar" ? "نسبة المخاطرة %" : "Risk Percentage %"}
            </label>
            <input
              type="number"
              value={riskPercentage}
              onChange={(e) => setRiskPercentage(e.target.value)}
              className="w-full p-3 rounded-xl border bg-[var(--surfaceAlt)] text-[var(--fg)] border-[var(--border)] focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="2"
              min="0.1"
              max="10"
              step="0.1" />

          </div>

          <div>
            <label className="block text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
              {language === "ar" ? "سعر الدخول" : "Entry Price"}
            </label>
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="w-full p-3 rounded-xl border bg-[var(--surfaceAlt)] text-[var(--fg)] border-[var(--border)] focus:ring-2 focus:// ... keep existing code (rest of file) ...blue-500 outline-none"
              placeholder="2000.50"
              step="0.01" />

          </div>

          <div>
            <label className="block text-sm font-medium text-red-600 dark:text-red-400 mb-2">
              {language === "ar" ? "وقف الخسارة" : "Stop Loss"}
            </label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full p-3 rounded-xl border bg-[var(--surfaceAlt)] text-[var(--fg)] border-[var(--border)] focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="1995.00"
              step="0.01" />

          </div>

          <div>
            <label className="block text-sm font-medium text-green-600 dark:text-green-400 mb-2">
              {language === "ar" ? "جني الأرباح (اختياري)" : "Take Profit (Optional)"}
            </label>
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              className="w-full p-3 rounded-xl border bg-[var(--surfaceAlt)] text-[var(--fg)] border-[var(--border)] focus:ring-2 focus:ring-green-500 outline-none"
              placeholder="2010.00"
              step="0.01" />

          </div>

          <div className="flex gap-3">
            <button
              onClick={calculateAdvancedRisk}
              className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:brightness-110">

              {language === "ar" ? "احسب" : "Calculate"}
            </button>
            <button
              onClick={resetCalculator}
              className="rounded-xl border border-[var(--border)] bg-[var(--surfaceAlt)] px-4 py-3 text-sm font-medium text-[var(--muted)]">

              {language === "ar" ? "إعادة تعيين" : "Reset"}
            </button>
          </div>

          {result &&
          <div className="mt-6 p-4 rounded-xl border bg-[var(--surfaceAlt)] border-[var(--border)]">
              <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-3">
                {language === "ar" ? "نتائج الحساب:" : "Calculation Results:"}
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-purple-600 dark:text-purple-400">
                    {language === "ar" ? "مبلغ المخاطرة:" : "Risk Amount:"}
                  </span>
                  <span className="font-medium text-[var(--fg)]">${result.riskAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600 dark:text-blue-400">
                    {language === "ar" ? "حجم الصفقة:" : "Position Size:"}
                  </span>
                  <span className="font-medium text-[var(--fg)]">{result.positionSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-600 dark:text-red-400">
                    {language === "ar" ? "فرق النقاط:" : "Pip Difference:"}
                  </span>
                  <span className="font-medium text-[var(--fg)]">{result.pipDifference}</span>
                </div>
                {result.riskRewardRatio &&
              <div className="flex justify-between">
                    <span className="text-green-600 dark:text-green-400">
                      {language === "ar" ? "نسبة المخاطرة/المكافأة:" : "Risk/Reward Ratio:"}
                    </span>
                    <span className="font-medium text-[var(--fg)]">1:{result.riskRewardRatio}</span>
                  </div>
              }
                {result.potentialProfit &&
              <div className="flex justify-between">
                    <span className="text-green-600 dark:text-green-400">
                      {language === "ar" ? "الربح المحتمل:" : "Potential Profit:"}
                    </span>
                    <span className="font-medium text-[var(--fg)]">${result.potentialProfit}</span>
                  </div>
              }
              </div>
            </div>
          }
        </div>
      </div>
    </div>);

}

function ChatBubble({ message, isUser }) {
  const { setActions } = useChart();
  useEffect(() => {
    if (!isUser) {
      const acts = message?.chart_actions || message?.actions;
      if (Array.isArray(acts) && acts.length) {
        setActions((prev) => mergeActions(prev, acts));
      }
    }
  }, [message, isUser, setActions]);

  if (!message) return null;

  const bubbleClass = isUser ?
  "border-[var(--accent)]/30 bg-[var(--accentSoft)] text-[var(--fg)]" :
  "border-[var(--border)] bg-[var(--surfaceAlt)] text-[var(--fg)]";

  const BotOrUser = ({ className }) =>
  isUser ? <User className={className} /> : <Bot className={className} style={{ color: '#7cb342' }} />;

  try {
    return (
      <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} mb-4`}>
        {!isUser &&
        <div className="h-8 w-8 rounded-full border bg-[var(--surface)] border-[var(--border)] flex items-center justify-center mt-0.5 flex-shrink-0">
            <BotOrUser className="w-4 h-4" />
          </div>
        }
        <div className={`${isUser ? "flex flex-col items-end" : ""} max-w-[90%] sm:max-w-[85%]`}>
          <div className={`${bubbleClass} border rounded-2xl p-3 break-words ${message.isError ? 'border-red-300' : ''}`}>
            <div className="text-[16px] leading-7 whitespace-pre-wrap">
              {String(message.content || message.text || "")}
            </div>
            {message.tool_calls && message.tool_calls.length > 0 &&
            <div className="mt-2 text-xs opacity-75">
                {message.tool_calls.map((tool, idx) =>
              <div key={idx} className="bg-black/10 rounded px-2 py-1 mt-1">
                    🛠️ {tool.name || 'Tool call'} {tool.status && `- ${tool.status}`}
                  </div>
              )}
              </div>
            }
          </div>
        </div>
        {isUser &&
        <div className="h-8 w-8 rounded-full border bg-[var(--surface)] border-[var(--border)] flex items-center justify-center mt-0.5 flex-shrink-0">
            <BotOrUser className="w-4 h-4" />
          </div>
        }
      </div>);

  } catch (e) {
    console.error('[AI_ASSISTANT] ChatBubble error:', e);
    return (
      <div className="flex gap-3 justify-start mb-4">
        <div className="rounded-2xl border bg-[var(--surfaceAlt)] border-[var(--border)] p-3 text-red-500">
          Error rendering message
        </div>
      </div>);

  }
}

function Content() {
  const { language: langFromTheme, theme } = useTheme() || { language: "en", theme: "dark" };
  const language = langFromTheme || "ar";
  const { user, authMethod } = useAuth();

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [connectionMethod, setConnectionMethod] = useState(null);
  const [showRiskCalculator, setShowRiskCalculator] = useState(false);

  const [symbol, setSymbol] = useState("XAUUSD");
  const [tf, setTf] = useState("15m");
  const endRef = useRef(null);
  const { actions, setActions } = useChart();

  // Auto-scroll to bottom
  useEffect(() => {
    try {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      console.error('Scroll error:', e);
    }
  }, [messages, typing]);

  // Load saved preferences
  useEffect(() => {
    try {
      const ls = localStorage.getItem("liirat:lastSymbol");
      const lt = localStorage.getItem("liirat:lastTf");
      if (ls && CLIENT_SYMBOLS.includes(ls)) setSymbol(ls);
      if (lt && TIMEFRAMES.includes(lt)) setTf(lt);
    } catch (e) {
      console.error('LocalStorage error:', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("liirat:lastSymbol", symbol);
    } catch (e) {
      console.error('LocalStorage error:', e);
    }
  }, [symbol]);

  useEffect(() => {
    try {
      localStorage.setItem("liirat:lastTf", tf);
    } catch (e) {
      console.error('LocalStorage error:', e);
    }
  }, [tf]);

  // Risk calculator handler
  const handleRiskCalculation = (result) => {
    let riskMessage = language === "ar" ?
    `نتائج حاسبة المخاطر المتقدمة:\n\n` +
    `مبلغ المخاطرة: $${result.riskAmount}\n` +
    `حجم الصفقة: ${result.positionSize}\n` +
    `فرق النقاط: ${result.pipDifference}` :
    `Advanced Risk Calculator Results:\n\n` +
    `Risk Amount: $${result.riskAmount}\n` +
    `Position Size: ${result.positionSize}\n` +
    `Pip Difference: ${result.pipDifference}`;

    if (result.riskRewardRatio) {
      riskMessage += language === "ar" ?
      `\nنسبة المخاطرة/المكافأة: 1:${result.riskRewardRatio}` :
      `\nRisk/Reward Ratio: 1:${result.riskRewardRatio}`;
    }

    if (result.potentialProfit) {
      riskMessage += language === "ar" ?
      `\nالربح المحتمل: $${result.potentialProfit}` :
      `\nPotential Profit: $${result.potentialProfit}`;
    }

    setInput(riskMessage);
    setShowRiskCalculator(false);
    setTimeout(send, 100);
  };

  const collectActions = (msgs = []) => {
    const res = [];
    (msgs || []).forEach((m) => {
      const acts = m?.chart_actions || m?.actions;
      if (Array.isArray(acts)) res.push(...acts);
    });
    return res;
  };

  // ✅ ENHANCED: Agent conversation initialization with better error handling
  const initializeAgentConversation = React.useCallback(async () => {
    if (!user?.email) {
      console.log('[AI_ASSISTANT] ⏳ Waiting for user authentication...');
      setConnectionStatus('waiting_auth');
      return;
    }

    try {
      console.log('[AI_ASSISTANT] 🚀 Creating agent conversation for user:', {
        email: user.email,
        authMethod: authMethod,
        hasId: !!user.id
      });
      setConnectionStatus('connecting');

      // ✅ METHOD 1: Try standard agentSDK first
      try {
        console.log('[AI_ASSISTANT] 📝 Trying standard agent SDK...');
        const conv = await agentSDK.createConversation({
          agent_name: "liirat_trade_assistant",
          metadata: {
            symbol: symbol,
            timeframe: tf,
            language: language,
            auth_method: authMethod
          }
        });

        if (conv?.id) {
          console.log('[AI_ASSISTANT] ✅ Standard agent conversation created:', conv.id);
          setConversation(conv);
          setConnectionStatus('connected');
          setConnectionMethod('agent_sdk_direct');

          const welcomeMsg = {
            id: `welcome_${Date.now()}`,
            role: 'assistant',
            content: language === "ar" ?
            `مرحباً! أنا مساعد ليرات للتداول متصل مباشرة. أستطيع مساعدتك في:
1) الأسعار اللحظية
2) التحليل الفني (يشمل صفقة سريعة لـ XAUUSD إطار 1د)
3) الأخبار والتقويم الاقتصادي
4) إدارة الإشعارات والتفضيلات
5) البحث عبر الويب
بماذا أبدأ؟` :
            `Hello! I'm Liirat's trading assistant. I can help with:
1) Real-time prices
2) Technical analysis (incl. fast XAUUSD 1m setup)
3) Economic news & calendar
4) Manage notifications & preferences
5) Web search
What should I start with?`,
            timestamp: new Date().toISOString()
          };

          setMessages([welcomeMsg]);
          return;
        }
      } catch (agentSDKError) {
        console.log('[AI_ASSISTANT] ⚠️ Standard agent SDK failed:', agentSDKError.message);
      }

      // ✅ METHOD 2: Use secure agent function as fallback
      console.log('[AI_ASSISTANT] 🔄 Using secure agent function...');
      const response = await fetch('/functions/secureAgentConversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-token') || 'custom-auth'}`,
          'User-Session': JSON.stringify({
            ...user,
            auth_method: authMethod
          })
        },
        body: JSON.stringify({
          action: 'create_conversation',
          agent_name: 'liirat_trade_assistant',
          metadata: {
            symbol: symbol,
            timeframe: tf,
            language: language,
            auth_method: authMethod
          }
        })
      });

      // ✅ DEFENSIVE: Handle response safely
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('[AI_ASSISTANT] ❌ Invalid JSON response:', jsonError);
        throw new Error('Invalid server response');
      }

      console.log('[AI_ASSISTANT] 📋 Secure agent response:', {
        status: response.status,
        success: data.success,
        hasConversation: !!data.conversation
      });

      if (response.ok && data.success && data.conversation) {
        console.log('[AI_ASSISTANT] ✅ Secure agent conversation created:', data.conversation.id);
        setConversation(data.conversation);
        setConnectionStatus('connected');
        setConnectionMethod(`secure_${authMethod}`);

        const welcomeMsg = {
          id: `welcome_${Date.now()}`,
          role: 'assistant',
          content: language === "ar" ?
          `مرحباً! أنا مساعد ليرات للتداول متصل بالنظام الآمن. يمكنني مساعدتك في التحليل الفني والأسعار والأخبار الاقتصادية لـ ${symbol}. كيف يمكنني مساعدتك اليوم؟` :
          `Hello! I'm Liirat's trading assistant connected via secure system. I can help you with technical analysis, prices, and economic news for ${symbol}. How can I assist you today?`,
          timestamp: new Date().toISOString()
        };

        setMessages([welcomeMsg]);
        return;
      } else {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

    } catch (error) {
      console.error('[AI_ASSISTANT] ❌ All agent connection methods failed:', {
        message: error.message,
        status: error.status,
        authMethod: authMethod,
        stack: error.stack?.substring(0, 500)
      });

      setConnectionStatus('error');
      setConnectionMethod('failed');

      const errorMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: language === "ar" ?
        "عذراً، فشل الاتصال بالمساعد الذكي. يرجى إعادة تحميل الصفحة أو المحاولة لاحقاً." :
        "Sorry, failed to connect to AI assistant. Please refresh the page or try again later.",
        isError: true,
        timestamp: new Date().toISOString(),
        error_details: error.message
      };
      setMessages([errorMessage]);
    }
  }, [language, symbol, tf, user, authMethod]);

  useEffect(() => {
    if (user?.email) {
      initializeAgentConversation();
    } else {
      setConnectionStatus('not_authenticated');
      setConnectionMethod(null);
    }
  }, [user?.email, authMethod, initializeAgentConversation]);

  // ✅ ENHANCED: Subscription handling with better message processing
  useEffect(() => {
    if (!conversation?.id) return;

    console.log('[AI_ASSISTANT] 📡 Setting up conversation updates for:', {
      id: conversation.id,
      method: connectionMethod
    });

    try {
      const unsubscribe = agentSDK.subscribeToConversation(conversation.id, (data) => {
        console.log('[AI_ASSISTANT] 📨 Conversation update received:', {
          hasMessages: !!data?.messages,
          hasData: !!data?.data,
          hasList: !!data?.data?.list,
          fullData: JSON.stringify(data, null, 2)
        });

        // ✅ DEFENSIVE: Safely handle message updates with multiple formats
        if (data && Array.isArray(data.messages)) {
          console.log('[AI_ASSISTANT] ✅ Processing messages from data.messages');
          setMessages(data.messages);
          setTyping(false);
          const acts = collectActions(data.messages);
          if (acts.length) setActions((prev) => mergeActions(prev, acts));
        } else if (data && data.data && Array.isArray(data.data.list)) {
          console.log('[AI_ASSISTANT] ✅ Processing messages from data.data.list');
          setMessages(data.data.list);
          setTyping(false);
          const acts = collectActions(data.data.list);
          if (acts.length) setActions((prev) => mergeActions(prev, acts));
        } else if (data && data.data && Array.isArray(data.data.messages)) {
          console.log('[AI_ASSISTANT] ✅ Processing messages from data.data.messages');
          setMessages(data.data.messages);
          setTyping(false);
          const acts = collectActions(data.data.messages);
          if (acts.length) setActions((prev) => mergeActions(prev, acts));
        } else {
          console.warn('[AI_ASSISTANT] ⚠️ Unexpected message data structure:', data);
        }
      });

      return () => {
        try {
          unsubscribe();
          console.log('[AI_ASSISTANT] 🔌 Unsubscribed from conversation');
        } catch (e) {
          console.warn('[AI_ASSISTANT] Warning during unsubscribe:', e);
        }
      };
    } catch (error) {
      console.error('[AI_ASSISTANT] ❌ Subscription setup failed:', error);
    }
  }, [conversation?.id, connectionMethod]);

  // ✅ ENHANCED: Message sending with comprehensive logging and response handling
  const send = async () => {
    const msg = input.trim();
    if (!msg || typing || !conversation?.id) return;

    setInput("");
    setTyping(true);

    try {
      console.log('[AI_ASSISTANT] 📤 Sending message directly to agent:', conversation.id);

      // Add user message immediately to the UI
      const userMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: msg,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...(Array.isArray(prev) ? prev : []), userMessage]);

      // --- THE FINAL FIX ---
      // This is the pure, direct connection to the agent via the frontend SDK.
      // There are no intermediary backend functions involved in sending this message.
      // The `subscribeToConversation` hook will handle receiving the agent's real response.
      await agentSDK.addMessage(conversation, {
        role: 'user',
        content: msg
      });
      
      console.log('[AI_ASSISTANT] ✅ Message sent directly to agent. Awaiting subscription update.');

    } catch (e) {
      console.error('[AI_ASSISTANT] ❌ Message send error:', {
        message: e.message,
        status: e.status,
        response: e.response?.data,
        stack: e.stack?.substring(0, 500)
      });
      
      const errorMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `Send error: ${e.message}`,
        isError: true,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => {
        const currentMessages = Array.isArray(prev) ? prev : [];
        return [...currentMessages, errorMessage];
      });
    } finally {
      // The subscription handler will eventually set typing to false.
    }
  };

  // ✅ FIXED: Enhanced connection status display
  const getConnectionStatusText = () => {
    if (connectionStatus === 'connected') {
      return language === "ar" ?
      `متصل (${connectionMethod})` :
      `Connected (${connectionMethod})`;
    } else if (connectionStatus === 'connecting') {
      return language === "ar" ? "جاري الاتصال" : "Connecting";
    } else if (connectionStatus === 'waiting_auth') {
      return language === "ar" ? "بانتظار المصادقة" : "Waiting for Auth";
    } else {
      return language === "ar" ? "خطأ في الاتصال" : "Connection Error";
    }
  };

  // ✅ SHOW LOGIN PROMPT: If user not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] p-6">

        {/* Fluent-Card Theme Variables */}
        <style>{`
          :root {
            --bg:#ffffff; --surface:#f8fafc; --surfaceAlt:#f1f5f9;
            --border:#e5e7eb; --fg:#111827; --muted:#6b7280;
            --accent:#0ea5e9; --accentSoft:rgba(14,165,233,0.12);
          }
          .dark {
            --bg:#0b0f1a; --surface:#0f172a; --surfaceAlt:#111827;
            --border:rgba(255,255,255,.08); --fg:#e5e7eb; --muted:#94a3b8;
            --accent:#06b6d4; --accentSoft:rgba(6,182,212,0.12);
          }
        `}</style>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col lg:flex-row gap-6">

          {/* Chart still visible for non-authenticated users */}
          <div className="lg:w-1/2">
            <div className="rounded-2xl border bg-[var(--surface)] border-[var(--border)] p-4 h-[600px]">
              <h3 className="text-lg font-semibold text-[var(--fg)] mb-4 text-center">
                {symbol} - {tf}
              </h3>
              <div className="relative h-[560px]">
              <LightweightPriceChart
                symbol={symbol}
                timeframe={tf}
                actions={actions}
                locale={language === "ar" ? "ar" : "en"} />

              </div>
            </div>

            {/* Controls still available */}
            <div className="rounded-2xl border bg-[var(--surface)] border-[var(--border)] p-4 mt-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div>
                  <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                    {language === "ar" ? "الرمز" : "Symbol"}
                  </label>
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="rounded-xl border bg-[var(--surfaceAlt)] border-[var(--border)] p-2 outline-none text-[var(--fg)]">

                    {CLIENT_SYMBOLS.map((s) =>
                    <option key={s} value={s}>{s}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                    {language === "ar" ? "الإطار الزمني" : "Timeframe"}
                  </label>
                  <select
                    value={tf}
                    onChange={(e) => setTf(e.target.value)}
                    className="rounded-xl border bg-[var(--surfaceAlt)] border-[var(--border)] p-2 outline-none text-[var(--fg)]">

                    {TIMEFRAMES.map((t) =>
                    <option key={t} value={t}>{t}</option>
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Chat section with login prompt */}
          <div className="lg:w-1/2">
            <div className="rounded-2xl border bg-[var(--surface)] border-[var(--border)] p-6 h-[600px] flex flex-col justify-center items-center text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 rounded-full border bg-[var(--surface)] border-[var(--border)] flex items-center justify-center mx-auto mb-6">
                  <Bot className="w-8 h-8" style={{ color: '#7cb342' }} />
                </div>
                <h2 className="text-2xl font-bold text-[var(--fg)] mb-4">
                  {language === "ar" ? "مساعد ليرات الذكي" : "Liirat AI Assistant"}
                </h2>
                <p className="text-[var(--muted)] mb-6">
                  {language === "ar" ?
                  "سجل دخولك للتفاعل مع المساعد الذكي والحصول على تحليلات فنية وتوصيات تداول." :
                  "Sign in to interact with the AI assistant and get technical analysis and trading recommendations."}
                </p>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('show-login-modal'))}
                  className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accentSoft)] text-[var(--accent)] px-6 py-3 font-semibold hover:brightness-110">

                  {language === "ar" ? "تسجيل الدخول" : "Sign In"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>);

  }

  return (
    <div className="pb-28 p-6 min-h-screen md:py-8 md:pb-8 relative">

      {/* Fluent-Card Theme Variables */}
      <style>{`
        :root {
          --bg:#ffffff; --surface:#f8fafc; --surfaceAlt:#f1f5f9;
          --border:#e5e7eb; --fg:#111827; --muted:#6b7280;
          --accent:#0ea5e9; --accentSoft:rgba(14,165,233,0.12);
        }
        .dark {
          --bg:#0b0f1a; --surface:#0f172a; --surfaceAlt:#111827;
          --border:rgba(255,255,255,.08); --fg:#e5e7eb; --muted:#94a3b8;
          --accent:#06b6d4; --accentSoft:rgba(6,182,212,0.12);
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col lg:flex-row gap-6">

        {/* Mobile: Chart first, Chat second */}
        <div className="lg:hidden w-full">
          {/* Chart on top for mobile (fixed height; never grows with chat) */}
          <div className="rounded-2xl border bg-[var(--surface)] border-[var(--border)] p-4 mb-6">
            <h3 className="text-lg font-semibold text-[var(--fg)] mb-4 text-center">
              {symbol} - {tf}
            </h3>
            <div className="relative w-full h-[420px] sm:h-[460px] overflow-hidden">
              <LightweightPriceChart
                symbol={symbol}
                timeframe={tf}
                actions={actions}
                locale={language === "ar" ? "ar" : "en"} />

            </div>
          </div>

          {/* Chat below for mobile */}
          <div className="rounded-2xl border bg-[var(--surface)] border-[var(--border)] p-4 flex flex-col relative h-[70vh] max-h-[75vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
              <div>
                <h2 className="text-xl font-bold text-[var(--fg)]">
                  {language === "ar" ? "مساعد ليرات الذكي" : "Liirat AI Assistant"}
                </h2>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {language === "ar" ?
                  `${symbol} • ${tf} • وكيل لييرات للتداول` :
                  `${symbol} • ${tf} • Liirat Trade Agent`}
                </p>

                <div className="flex items-center gap-2 mt-1 text-xs">
                  <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                  connectionStatus === 'connecting' || connectionStatus === 'waiting_auth' ? 'bg-yellow-500 animate-pulse' :
                  'bg-red-500'}`
                  }></div>
                  <span className={
                  connectionStatus === 'connected' ? 'text-green-500' :
                  connectionStatus === 'connecting' || connectionStatus === 'waiting_auth' ? 'text-yellow-500' :
                  'text-red-500'
                  }>
                    {getConnectionStatusText()}
                  </span>
                </div>
              </div>
            </div>

            {/* Enhanced Mobile Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-3 justify-center">
              <button
                onClick={() => {
                  setInput(language === "ar" ? `تحليل ${symbol}` : `Analyze ${symbol}`);
                  setTimeout(send, 100);
                }}
                disabled={typing || connectionStatus !== 'connected'}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium border-emerald-300 bg-emerald-100/60 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300 disabled:opacity-50 hover:brightness-110">

                <DollarSign className="w-4 h-4" />
                {language === "ar" ? "تحليل السعر" : "Price Analysis"}
              </button>
              <button
                onClick={() => {
                  setInput(language === "ar" ? "ابحث في الويب عن الأخبار الأمريكية الرائجة اليوم" : "Check the web for trending US news today");
                }}
                disabled={typing || connectionStatus !== 'connected'}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium border-[var(--accent)]/30 bg-[var(--accentSoft)] text-[var(--accent)] disabled:opacity-50 hover:brightness-110">

                <Newspaper className="w-4 h-4" />
                {language === "ar" ? "أخبار رائجة" : "Trending News"}
              </button>
              <button
                onClick={() => setShowRiskCalculator(true)}
                disabled={typing || connectionStatus !== 'connected'}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium border-purple-300 bg-purple-100/60 text-purple-700 dark:border-purple-400/30 dark:bg-purple-400/10 dark:text-purple-300 disabled:opacity-50 hover:brightness-110">

                <Calculator className="w-4 h-4" />
                {language === "ar" ? "حاسبة المخاطر" : "Risk Calculator"}
              </button>
            </div>

            {/* Messages list: scrolls, with padding to avoid overlap with sticky input */}
            <div className="flex-1 overflow-y-auto space-y-1 mb-0 overscroll-contain pr-1 -mr-1 pb-24">
              {messages.map((message, index) =>
              <ChatBubble key={message.id || index} message={message} isUser={message.role === 'user'} />
              )}
              {typing &&
              <div className="flex gap-3 justify-start mb-4">
                  <div className="h-8 w-8 rounded-full border bg-[var(--surface)] border-[var(--border)] flex items-center justify-center mt-0.5 flex-shrink-0">
                    <Bot className="w-4 h-4" style={{ color: '#7cb342' }} />
                  </div>
                  <div className="rounded-2xl border bg-[var(--surfaceAlt)] border-[var(--border)] p-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              }
              <div ref={endRef} />
            </div>

            {/* Sticky input at bottom (mobile) */}
            <div className="rounded-2xl border bg-[var(--surfaceAlt)] border-[var(--border)] p-3 flex gap-3 sticky bottom-0 left-0 right-0 z-20">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={language === "ar" ? "اكتب رسالتك هنا..." : "Type your message here..."}
                className="flex-1 bg-transparent outline-none resize-none text-[var(--fg)] placeholder:text-[var(--muted)]"
                rows="3"
                disabled={typing || connectionStatus !== 'connected'}
                style={{ direction: language === "ar" ? "rtl" : "ltr" }} />

              <button
                onClick={send}
                disabled={!input.trim() || typing || connectionStatus !== 'connected'}
                className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accentSoft)] text-[var(--accent)] p-3 disabled:opacity-50 flex-shrink-0 hover:brightness-110">

                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile Controls - Below Chat */}
          <div className="rounded-2xl border bg-[var(--surface)] border-[var(--border)] p-4 mt-4">
            <div className="flex flex-wrap gap-4 items-center justify-center">
              <div className="text-center">
                <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                  {language === "ar" ? "الرمز" : "Symbol"}
                </label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="rounded-xl border bg-[var(--surfaceAlt)] border-[var(--border)] p-2 outline-none text-[var(--fg)] text-center">

                  {CLIENT_SYMBOLS.map((s) =>
                  <option key={s} value={s}>{s}</option>
                  )}
                </select>
              </div>

              <div className="text-center">
                <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                  {language === "ar" ? "الإطار الزمني" : "Timeframe"}
                </label>
                <select
                  value={tf}
                  onChange={(e) => setTf(e.target.value)}
                  className="rounded-xl border bg-[var(--surfaceAlt)] border-[var(--border)] p-2 outline-none text-[var(--fg)] text-center">

                  {TIMEFRAMES.map((t) =>
                  <option key={t} value={t}>{t}</option>
                  )}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: Chat left, Chart right */}
        <div className="hidden lg:flex lg:w-2/3 flex-col h-full">
          <div className="p-6 rounded-2xl border border-[var(--border)] h-[680px] lg:h-[720px] xl:h-[760px] max-h-[calc(100vh-160px)] overflow-hidden flex flex-col">
            <div>
              <div>
                <h2 className="text-2xl font-bold text-[var(--fg)]">
                  {language === "ar" ? "مساعد ليرات الذكي" : "Liirat AI Assistant"}
                </h2>
                <p className="text-sm text-[var(--muted)] mt-1">
                  {language === "ar" ?
                  `${symbol} • ${tf} • وكيل لييرات للتداول` :
                  `${symbol} • ${tf} • Liirat Trade Agent`}
                </p>

                <div className="flex items-center gap-2 mt-2 text-sm">
                  <div className={`w-3 h-3 rounded-full ${
                  connectionStatus === "connected" ?
                  "bg-green-500 animate-pulse" :
                  connectionStatus === "connecting" || connectionStatus === "waiting_auth" ?
                  "bg-yellow-500 animate-pulse" :
                  "bg-red-500"}`
                  } />
                  <span className={
                  connectionStatus === "connected" ?
                  "text-green-500" :
                  connectionStatus === "connecting" || connectionStatus === "waiting_auth" ?
                  "text-yellow-500" :
                  "text-red-500"
                  }>
                    {getConnectionStatusText()}
                  </span>
                </div>
              </div>
            </div>

            {/* Enhanced Desktop Action Buttons */}
            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={() => {
                  setInput(language === "ar" ? `تحليل ${symbol}` : `Analyze ${symbol}`);
                  setTimeout(send, 100);
                }}
                disabled={typing || connectionStatus !== 'connected'}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium border-emerald-300 bg-emerald-100/60 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300 disabled:opacity-50 hover:brightness-110">

                <DollarSign className="w-4 h-4" />
                {language === "ar" ? "تحليل السعر" : "Price Analysis"}
              </button>
              <button
                onClick={() => {
                  setInput(language === "ar" ? "ابحث في الويب عن الأخبار الأمريكية الرائجة اليوم" : "Check the web for trending US news today");
                }}
                disabled={typing || connectionStatus !== 'connected'}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium border-[var(--accent)]/30 bg-[var(--accentSoft)] text-[var(--accent)] disabled:opacity-50 hover:brightness-110">

                <Newspaper className="w-4 h-4" />
                {language === "ar" ? "أخبار رائجة" : "Trending News"}
              </button>
              <button
                onClick={() => setShowRiskCalculator(true)}
                disabled={typing || connectionStatus !== 'connected'}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium border-purple-300 bg-purple-100/60 text-purple-700 dark:border-purple-400/30 dark:bg-purple-400/10 dark:text-purple-300 disabled:opacity-50 hover:brightness-110">

                <Calculator className="w-4 h-4" />
                {language === "ar" ? "حاسبة المخاطر" : "Risk Calculator"}
              </button>
            </div>

            {/* Messages list */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2">
              {messages.map((message, index) =>
              <ChatBubble key={message.id || index} message={message} isUser={message.role === 'user'} />
              )}
              {typing &&
              <div className="flex gap-3 justify-start mb-4">
                  <div className="h-8 w-8 rounded-full border bg-[var(--surface)] border-[var(--border)] flex items-center justify-center mt-0.5 flex-shrink-0">
                    <Bot className="w-4 h-4" style={{ color: '#7cb342' }} />
                  </div>
                  <div className="rounded-2xl border bg-[var(--surfaceAlt)] border-[var(--border)] p-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              }
              <div ref={endRef} />
            </div>

            {/* Input area */}
            <div className="p-4 rounded-2xl border border-[var(--border)] flex gap-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={language === "ar" ? "اكتب رسالتك هنا..." : "Type your message here..."}
                className="flex-1 bg-transparent outline-none resize-none text-[var(--fg)] placeholder:text-[var(--muted)]"
                rows="3"
                disabled={typing || connectionStatus !== 'connected'}
                style={{ direction: language === "ar" ? "rtl" : "ltr" }} />

              <button
                onClick={send}
                disabled={!input.trim() || typing || connectionStatus !== 'connected'}
                className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accentSoft)] text-[var(--accent)] p-3 disabled:opacity-50 flex-shrink-0 hover:brightness-110">

                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Desktop Controls */}
          <div className="mt-4 p-4 rounded-2xl border border-[var(--border)]">
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                  {language === "ar" ? "الرمز" : "Symbol"}
                </label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="rounded-xl border bg-[var(--surfaceAlt)] border-[var(--border)] p-2 outline-none text-[var(--fg)]">

                  {CLIENT_SYMBOLS.map((s) =>
                  <option key={s} value={s}>{s}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                  {language === "ar" ? "الإطار الزمني" : "Timeframe"}
                </label>
                <select
                  value={tf}
                  onChange={(e) => setTf(e.target.value)}
                  className="rounded-xl border bg-[var(--surfaceAlt)] border-[var(--border)] p-2 outline-none text-[var(--fg)]">

                  {TIMEFRAMES.map((t) =>
                  <option key={t} value={t}>{t}</option>
                  )}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:block lg:w-1/3">
          {/* Fixed, viewport-aware height to prevent expanding with chat */}
          <div className="p-4 rounded-2xl border border-[var(--border)] h-[680px] lg:h-[720px] xl:h-[760px] max-h-[calc(100vh-160px)] overflow-hidden">
            <h3 className="text-lg font-semibold text-[var(--fg)] mb-4 text-center">
              {symbol} - {tf}
            </h3>
            <div className="relative w-full h-full overflow-hidden pb-6">
              <LightweightPriceChart
                symbol={symbol}
                timeframe={tf}
                actions={actions}
                locale={language === "ar" ? "ar" : "en"} />

            </div>
          </div>
        </div>
      </div>

      {/* Advanced Risk Calculator Modal */}
      <AdvancedRiskCalculator
        language={language}
        onCalculate={handleRiskCalculation}
        isOpen={showRiskCalculator}
        onClose={() => setShowRiskCalculator(false)} />

    </div>);

}

export default function AIAssistantPage() {
  return (
    <ChartProvider>
      <Content />
    </ChartProvider>
  );
}
