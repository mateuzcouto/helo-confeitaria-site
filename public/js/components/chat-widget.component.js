/* ═══════════════════════════════════════════════════════════════════════
   chat-widget.component.js — ASSISTENTE VIRTUAL (CHAT)
   ═══════════════════════════════════════════════════════════════════════
   Widget de chat flutuante que conecta ao assistente IA via Cloud
   Functions (Groq API). Expõe window.HeloChatWidget para inclusão
   no render principal via index.html.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
	'use strict';

	const { useState, useEffect, useRef } = React;

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

		const scrollToBottom = () => {
			const container = messagesContainerRef.current;
			if (container) {
				container.scrollTop = container.scrollHeight;
			}
		};

		useEffect(() => {
			if (isOpen) scrollToBottom();
		}, [messages, isOpen]);

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

		const getGroqChatUrl = () => {
			const isLocalhost = Boolean(
				window.location.hostname === 'localhost' ||
				window.location.hostname === '127.0.0.1' ||
				window.location.hostname.startsWith('192.168.')
			);
			return isLocalhost
				? 'https://us-central1-helo-confeitaria.cloudfunctions.net/groqChat'
				: '/api/groq/chat';
		};

		const safeParseJson = async (response) => {
			try {
				const text = await response.text();
				if (!text || !text.trim()) return { error: 'Resposta vazia do servidor' };
				return JSON.parse(text);
			} catch (_) {
				return { error: 'Resposta inválida do servidor' };
			}
		};

		const sendMessage = async () => {
			const trimmedInput = inputValue.trim();
			if (!trimmedInput || isLoading) return;
			const userMessage = { role: 'user', content: trimmedInput };
			setMessages((prev) => [...prev, userMessage]);
			setInputValue('');
			setIsLoading(true);
			try {
				const conversationHistory = messages.slice(-10).map((msg) => ({
					role: msg.role,
					content: msg.content,
				}));
				const response = await fetch(getGroqChatUrl(), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ message: trimmedInput, conversationHistory }),
				});
				const data = await safeParseJson(response);
				if (!response.ok) {
					throw new Error(data.error || 'Erro ao comunicar com assistente');
				}
				if (data.agentActions && Array.isArray(data.agentActions)) {
					data.agentActions.forEach((action) => {
						if (typeof window !== 'undefined' && window.HeloApp && window.HeloApp.setAgentAction) {
							window.HeloApp.setAgentAction(action);
						}
					});
				}
				const assistantMessage = { role: 'assistant', content: data.reply || 'Não foi possível gerar resposta.' };
				setMessages((prev) => [...prev, assistantMessage]);
			} catch (error) {
				console.error('[ChatWidget] Error:', error);
				const errorMessage = {
					role: 'assistant',
					content: 'Desculpe, tive um problema ao processar sua mensagem. Tente novamente ou entre em contato pelo WhatsApp.',
				};
				setMessages((prev) => [...prev, errorMessage]);
			} finally {
				setIsLoading(false);
			}
		};

		const handleKeyDown = (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				sendMessage();
			}
		};

		return (
			<div className="helo-chat-widget">
				{!isOpen && (
					<button className="helo-chat-toggle" onClick={() => setIsOpen(true)} aria-label="Abrir chat">
						<span className="helo-chat-icon">💬</span>
					</button>
				)}
				{isOpen && (
					<div className="helo-chat-window" ref={chatWindowRef}>
						<div className="helo-chat-header">
							<div className="helo-chat-title">
								<span className="helo-chat-avatar">🧁</span>
								Assistente Helô
							</div>
							<button className="helo-chat-close" onClick={() => setIsOpen(false)} aria-label="Fechar chat">✕</button>
						</div>
						<div className="helo-chat-messages" ref={messagesContainerRef}>
							{messages.map((msg, index) => (
								<div key={index} className={`helo-chat-message helo-chat-message-${msg.role}`}>
									<div className="helo-chat-bubble">{msg.content}</div>
								</div>
							))}
							{isLoading && (
								<div className="helo-chat-message helo-chat-message-assistant">
									<div className="helo-chat-bubble helo-chat-bubble-loading">Digitando...</div>
								</div>
							)}
							<div ref={messagesEndRef} />
						</div>
						<div className="helo-chat-input-area">
							<textarea
								className="helo-chat-textarea"
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Digite sua mensagem..."
								rows={1}
								disabled={isLoading}
							/>
							<button
								className="helo-chat-send"
								onClick={sendMessage}
								disabled={isLoading || !inputValue.trim()}
								aria-label="Enviar mensagem"
							>
								{isLoading ? '...' : 'Enviar'}
							</button>
						</div>
					</div>
				)}
			</div>
		);
	};

	if (typeof window !== 'undefined') {
		window.HeloChatWidget = ChatWidget;
	}
})();
