/* ── ChatWidget: Componente de chat flutuante com IA Groq ─────────────────
   Widget de chat no canto inferior direito do site para atendimento ao
   cliente com IA. Comunica-se com Cloud Function groqChat (proxy seguro
   para API Groq). Mantém histórico de conversa na sessão.
   
   @update 2026-04-29 — Criado para assistente de vendas Helô Confeitaria. */
(function() {
  /* React hooks injetados globalmente via core-globals.js */

  /* ── Componente ChatWidget ────────────────────────────────────────────
     Exibe botão flutuante que abre/fecha o chat. Gerencia mensagens,
     estado de carregamento e histórico de conversa. */
  const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
      { role: 'assistant', content: 'Olá! Sou o assistente virtual da Helô Confeitaria. Como posso ajudar você hoje?' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const chatWindowRef = useRef(null);

    /* ── Scroll automático para última mensagem ──────────────────────────── */
    const scrollToBottom = () => {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    };

    useEffect(() => {
      if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    /* ── Ajustar chat quando teclado virtual abre/fecha no mobile ─────── */
    useEffect(() => {
      if (!isOpen || typeof window.visualViewport === 'undefined') return;
      const vv = window.visualViewport;
      const onResize = () => {
        const win = chatWindowRef.current;
        if (!win) return;
        const availH = vv.height;
        win.style.maxHeight = Math.max(availH * 0.9, 200) + 'px';
      };
      onResize();
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
      return () => {
        vv.removeEventListener('resize', onResize);
        vv.removeEventListener('scroll', onResize);
        const win = chatWindowRef.current;
        if (win) win.style.maxHeight = '';
      };
    }, [isOpen]);

    /* ── Resolve URL do endpoint groqChat ────────────────────────────────────
       Em produção (Firebase Hosting), usa rewrite /api/groq/chat (mesmo domínio).
       Em ambiente local (localhost/Live Server), usa URL direta da Cloud Function.
       @update 2026-04-29 — Adicionado detection de ambiente para URL dinâmica.
       @update 2026-05-01 — Corrigido nome de grokChat para groqChat. */
    const getGroqChatUrl = () => {
      const isLocalhost = Boolean(
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.')
      );
      /* Em produção, o rewrite do Firebase Hosting encaminha /api/groq/chat
         para a Cloud Function groqChat. Localmente não existe rewrite,
         então usamos a URL direta da função. */
      return isLocalhost
        ? 'https://us-central1-helo-confeitaria.cloudfunctions.net/groqChat'
        : '/api/groq/chat';
    };

    /* ── Faz parse seguro de JSON da resposta ────────────────────────────────
       Tenta fazer parse do body como JSON. Se falhar (resposta HTML, vazia,
       etc.), retorna objeto com mensagem genérica. Evita SyntaxError quando
       o servidor retorna erro não-JSON (ex: 405 do Live Server).
       @update 2026-04-29 — Criado para tratar resposta não-JSON com segurança. */
    const safeParseJson = async (response) => {
      try {
        const text = await response.text();
        if (!text || !text.trim()) return { error: 'Resposta vazia do servidor' };
        return JSON.parse(text);
      } catch (_) {
        return { error: 'Resposta inválida do servidor' };
      }
    };

    /* ── Enviar mensagem para Cloud Function groqChat ────────────────────────
     Chama endpoint HTTPS da Cloud Function com mensagem e histórico.
     Adiciona resposta ao array de mensagens.
     @update 2026-04-29 — Adicionado URL dinâmica e parse seguro de JSON.
     @update 2026-05-01 — Corrigido nome de grokChat para groqChat. */
    const sendMessage = async () => {
      const trimmedInput = inputValue.trim();
      if (!trimmedInput || isLoading) return;

      const userMessage = { role: 'user', content: trimmedInput };
      setMessages(prev => [...prev, userMessage]);
      setInputValue('');
      setIsLoading(true);

      try {
        /* ── Prepara histórico de conversa (últimas 10 mensagens) ───────────── */
        const conversationHistory = messages.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

        /* ── Chama Cloud Function groqChat ────────────────────────────────────
           URL dinâmica: produção usa rewrite, localhost usa URL direta.
           Payload: { message, conversationHistory } */
        const response = await fetch(
          getGroqChatUrl(),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: trimmedInput,
              conversationHistory,
            }),
          }
        );

        /* ── Parse seguro: trata resposta não-JSON sem lançar SyntaxError ──── */
        const data = await safeParseJson(response);

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao comunicar com assistente');
        }

        /* ── Processa ações do agente (Function Calling) ─────────────────────
           Se o backend retornou agentActions, executa cada ação no front-end
           chamando window.HeloApp.setAgentAction.
           
           @update 2026-04-30 — Adicionado suporte a function calling. */
        if (data.agentActions && Array.isArray(data.agentActions)) {
          data.agentActions.forEach((action) => {
            if (typeof window !== 'undefined' && window.HeloApp && window.HeloApp.setAgentAction) {
              window.HeloApp.setAgentAction(action);
            }
          });
        }

        const assistantMessage = { role: 'assistant', content: data.reply || 'Não foi possível gerar resposta.' };
        setMessages(prev => [...prev, assistantMessage]);
      } catch (error) {
        console.error('[ChatWidget] Error:', error);
        const errorMessage = { 
          role: 'assistant', 
          content: 'Desculpe, tive um problema ao processar sua mensagem. Tente novamente ou entre em contato pelo WhatsApp.' 
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    };

    /* ── Enviar ao pressionar Enter ─────────────────────────────────────────
       Usa onKeyDown em vez de onKeyPress (deprecado no React 18).
       @update 2026-04-29 — Corrigido de onKeyPress para onKeyDown. */
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };

    /* ── Renderização ──────────────────────────────────────────────────────── */
    return React.createElement('div', { className: 'helo-chat-widget' },
      /* ── Botão flutuante ──────────────────────────────────────────────────── */
      !isOpen && React.createElement('button', {
        className: 'helo-chat-toggle',
        onClick: () => setIsOpen(true),
        'aria-label': 'Abrir chat',
      },
        React.createElement('span', { className: 'helo-chat-icon' }, '💬')
      ),

      /* ── Janela do chat ───────────────────────────────────────────────────── */
      isOpen && React.createElement('div', { className: 'helo-chat-window', ref: chatWindowRef },
        /* ── Cabeçalho ───────────────────────────────────────────────────────── */
        React.createElement('div', { className: 'helo-chat-header' },
          React.createElement('div', { className: 'helo-chat-title' },
            React.createElement('span', { className: 'helo-chat-avatar' }, '🧁'),
            'Assistente Helô'
          ),
          React.createElement('button', {
            className: 'helo-chat-close',
            onClick: () => setIsOpen(false),
            'aria-label': 'Fechar chat',
          }, '✕')
        ),

        /* ── Área de mensagens ───────────────────────────────────────────────── */
        React.createElement('div', { className: 'helo-chat-messages', ref: messagesContainerRef },
          messages.map((msg, index) =>
            React.createElement('div', {
              key: index,
              className: `helo-chat-message helo-chat-message-${msg.role}`,
            },
              React.createElement('div', { className: 'helo-chat-bubble' },
                msg.content
              )
            )
          ),
          isLoading && React.createElement('div', { className: 'helo-chat-message helo-chat-message-assistant' },
            React.createElement('div', { className: 'helo-chat-bubble helo-chat-bubble-loading' },
              'Digitando...'
            )
          ),
          React.createElement('div', { ref: messagesEndRef })
        ),

        /* ── Área de input ───────────────────────────────────────────────────── */
        React.createElement('div', { className: 'helo-chat-input-area' },
          React.createElement('textarea', {
            className: 'helo-chat-textarea',
            value: inputValue,
            onChange: (e) => setInputValue(e.target.value),
            onKeyDown: handleKeyDown,
            placeholder: 'Digite sua mensagem...',
            rows: 1,
            disabled: isLoading,
          }),
          React.createElement('button', {
            className: 'helo-chat-send',
            onClick: sendMessage,
            disabled: isLoading || !inputValue.trim(),
            'aria-label': 'Enviar mensagem',
          }, isLoading ? '...' : 'Enviar')
        )
      )
    );
  };

  /* ── Expor componente globalmente ─────────────────────────────────────────── */
  if (typeof window !== 'undefined') {
    window.HeloChatWidget = ChatWidget;
  }
})();
