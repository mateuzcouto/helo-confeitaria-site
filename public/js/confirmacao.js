/* ═══════════════════════════════════════════════════════════════════════
   confirmacao.js — CONFIRMAÇÃO DE PAGAMENTO PIX (RETORNO INFINITEPAY)
   ═══════════════════════════════════════════════════════════════════════
   Executado apenas em confirmacao.html. Lê o ID do pedido (`nsu`) na URL,
   garante sessão anónima Firebase (mesmo utilizador que criou o pedido no
   mesmo browser) e subscreve `orders/{id}` até o status passar a `Pago`
   (actualizado pela Cloud Function confirmarPagamentoPix via Make.com).

   Dependências globais: Firebase compat + window.HeloApp (app.js).
   ═══════════════════════════════════════════════════════════════════════ */

(function inicializarConfirmacaoPixHelo() {
  'use strict';

  /** Tempo máximo de espera pelo webhook (ms) antes de mensagem alternativa. */
  const TIMEOUT_CONFIRMACAO_MS = 5 * 60 * 1000;

  /** IDs dos estados da UI (classes CSS auxiliares no markup gerado). */
  const CLASSE_SPINNER = 'confirmacao-pix--carregando';

  /**
   * Lê o ID do pedido Firestore a partir do query param `nsu`.
   *
   * @returns {string} ID trimado ou string vazia se ausente
   */
  function extrairIdPedidoNsDaUrl() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      return String(params.get('nsu') || '').trim();
    } catch (_) {
      return '';
    }
  }

  /**
   * Escapa texto para inserção em HTML (evita XSS em nomes de cliente/produto).
   *
   * @param {*} valor - Valor arbitrário
   * @returns {string} Texto escapado
   */
  function escapeHtmlBasico(valor) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Escreve HTML seguro no contentor principal (apenas markup estático nosso).
   *
   * @param {string} htmlInterno - Fragmento HTML gerado por este ficheiro
   * @returns {void}
   */
  function renderizarHtmlConfirmacao(htmlInterno) {
    const el = document.getElementById('confirmacao-pix-conteudo');
    if (!el) return;
    el.innerHTML = htmlInterno;
  }

  /**
   * Garante utilizador Firebase anónimo (restaura sessão em LocalStorage).
   *
   * @param {firebase.auth.Auth} authRef - Instância auth do HeloApp
   * @returns {Promise<firebase.User|null>} Utilizador actual ou null
   */
  async function garantirAutenticacaoAnonima(authRef) {
    return new Promise((resolve) => {
      const unsub = authRef.onAuthStateChanged(async (utilizador) => {
        unsub();
        if (utilizador) {
          resolve(utilizador);
          return;
        }
        try {
          await authRef.signInAnonymously();
        } catch (errAutonomo) {
          console.error('[confirmacao-pix] Falha signInAnonymously', errAutonomo);
        }
        resolve(authRef.currentUser);
      });
    });
  }

  /**
   * Monta lista textual simples de itens do pedido para o resumo final.
   *
   * @param {Array<{ name?: string, qty?: number, price?: number }>} items - Itens Firestore
   * @param {(n: number) => string} formatarMoeda - fmtBRL do HeloApp
   * @returns {string} HTML com <br /> entre linhas
   */
  function montarLinhasItensPedido(items, formatarMoeda) {
    const lista = Array.isArray(items) ? items : [];
    return lista
      .map((item) => {
        const nome = escapeHtmlBasico(String(item.name || item.productId || 'Item').trim());
        const q = Number(item.qty) || 0;
        const preco = Number(item.price) || 0;
        const sub = q * preco;
        return `${q}x ${nome} — R$ ${formatarMoeda(sub)}`;
      })
      .join('<br />');
  }

  /**
   * Arranca listener Firestore e timeout; navegação UX em três estados.
   *
   * @returns {Promise<void>}
   */
  async function executarFluxoConfirmacao() {
    const orderId = extrairIdPedidoNsDaUrl();
    if (!orderId) {
      renderizarHtmlConfirmacao(
        '<p style="color:#b45309;font-weight:600;">Link inválido.</p>' +
        '<p style="font-size:14px;color:var(--s600);">Abra esta página a partir do redirecionamento após o pagamento.</p>',
      );
      return;
    }

    const HeloApp = window.HeloApp;
    if (!HeloApp || !HeloApp.auth || !HeloApp.getCol || !HeloApp.fmtBRL) {
      renderizarHtmlConfirmacao(
        '<p style="color:#b91c1c;">Erro ao carregar o sistema. Atualize a página.</p>',
      );
      return;
    }

    const { auth: authRef, getCol, fmtBRL } = HeloApp;

    renderizarHtmlConfirmacao(
      `<div class="${CLASSE_SPINNER}" style="padding:1rem 0;">` +
      '<div style="width:40px;height:40px;border:3px solid #e2e8f8;border-top-color:var(--primary);border-radius:50%;margin:0 auto 1rem;animation:spin-confirmacao-pix 0.8s linear infinite;"></div>' +
      '<p style="font-size:15px;color:var(--s700);margin:0;">Confirmando pagamento…</p>' +
      '<p style="font-size:13px;color:var(--s500);margin-top:0.5rem;">Aguarde alguns segundos após concluir o PIX.</p>' +
      '</div>' +
      '<style>@keyframes spin-confirmacao-pix{to{transform:rotate(360deg)}}</style>',
    );

    const utilizador = await garantirAutenticacaoAnonima(authRef);
    if (!utilizador) {
      renderizarHtmlConfirmacao(
        '<p style="color:#b91c1c;">Não foi possível iniciar sessão. Atualize e tente de novo.</p>',
      );
      return;
    }

    const docRef = getCol('orders').doc(orderId);
    let timeoutId = null;

    const cancelarTimeout = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    timeoutId = window.setTimeout(() => {
      renderizarHtmlConfirmacao(
        '<p style="font-size:15px;color:var(--s700);font-weight:600;">Ainda não detectámos confirmação automática.</p>' +
        '<p style="font-size:14px;color:var(--s600);margin-top:0.75rem;">' +
        'Se já pagou, guarde o comprovante e aguarde o contacto da Helô. ' +
        'Se preferir, fale connosco pelo WhatsApp com o número do seu pedido: <strong>' +
        escapeHtmlBasico(orderId) +
        '</strong>.</p>',
      );
    }, TIMEOUT_CONFIRMACAO_MS);

    docRef.onSnapshot(
      (snapshot) => {
        if (!snapshot.exists) {
          cancelarTimeout();
          renderizarHtmlConfirmacao(
            '<p style="color:#b91c1c;">Pedido não encontrado.</p>',
          );
          return;
        }

        const dados = snapshot.data() || {};
        const status = String(dados.status || '').trim();

        if (status === 'Pago') {
          cancelarTimeout();
          const nomeCliente = escapeHtmlBasico(String(dados.customerName || 'Cliente').trim());
          const totalTxt = fmtBRL(Number(dados.total) || 0);
          const linhasItens = montarLinhasItensPedido(dados.items, fmtBRL);
          renderizarHtmlConfirmacao(
            '<p style="font-size:48px;line-height:1;margin:0 0 0.5rem;">✓</p>' +
            '<p style="font-size:18px;font-weight:700;color:#15803d;margin:0;">Pagamento confirmado!</p>' +
            `<p style="font-size:15px;color:var(--s700);margin-top:1rem;">Olá, <strong>${nomeCliente}</strong>. Obrigado pela preferência.</p>` +
            `<p style="font-size:14px;color:var(--s600);margin-top:0.75rem;text-align:left;">${linhasItens || '—'}</p>` +
            `<p style="font-size:16px;font-weight:700;color:var(--primary);margin-top:1rem;">Total: R$ ${totalTxt}</p>` +
            '<p style="font-size:13px;color:var(--s500);margin-top:1rem;">Guarde o número do pedido: <strong>' +
            escapeHtmlBasico(orderId) +
            '</strong></p>',
          );
        }
      },
      (erroListener) => {
        console.error('[confirmacao-pix] onSnapshot erro', erroListener);
        cancelarTimeout();
        renderizarHtmlConfirmacao(
          '<p style="color:#b91c1c;">Não foi possível verificar o pedido.</p>' +
          '<p style="font-size:14px;color:var(--s600);">Confirme que abriu esta página no mesmo dispositivo onde fez o pedido.</p>',
        );
      },
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      executarFluxoConfirmacao().catch((e) => console.error(e));
    });
  } else {
    executarFluxoConfirmacao().catch((e) => console.error(e));
  }
})();
