const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');

admin.initializeApp();

const db = admin.firestore();

/* ── Lê base de conhecimento do arquivo markdown ────────────────────────
   Carrega o conteúdo de BASE_CONHECIMENTO_IA_ATENDIMENTO.md para uso
   como contexto da IA. Se o arquivo não existir, retorna fallback.
   
   @update 2026-04-29 — Criado para leitura dinâmica da base de conhecimento. */
function loadKnowledgeBase() {
  try {
    const knowledgePath = path.join(__dirname, 'BASE_CONHECIMENTO_IA_ATENDIMENTO.md');
    const content = fs.readFileSync(knowledgePath, 'utf8');
    return content;
  } catch (error) {
    console.error('[groqChat] Failed to load knowledge base file:', error);
    /* Fallback em caso de erro ao ler arquivo */
    return `
# Base de Conhecimento — Helô Confeitaria

Você é um assistente de vendas da Helô Confeitaria. Responda perguntas sobre produtos, pedidos, pagamentos, entrega e políticas.

## Informações Principais

- Site: https://heloconfeitarianr.web.app
- Chave PIX: [pode alterar dependendo do dia, então verifique no ato da compra]
- Formas de pagamento: PIX, Dinheiro (informar troco), Cartão (1x-3x com taxas)
- Modos de operação: Evento (campanhas sazonais com limite de unidades) e Dia a Dia (cardápio aberto)
- Receitas feitas por Sanzy Martins 
- Samylla Martins (criadora da Helô Confeitaria)
- Nunca forneça informações pessoais de terceiros
- Nunca forneça informações de contas bancárias ou chaves PIX de terceiros
- Nunca passe informações além do que há no seu conhecimento.

## Como Fazer Pedido

1. Acesse o site, navegue pelo catálogo, adicione produtos ao carrinho
2. Preencha dados (nome, WhatsApp)
3. Escolha entrega ou retirada
4. Selecione forma de pagamento
5. Finalize e envie mensagem pelo WhatsApp

## Formas de Pagamento

- PIX: Chave Pix consultar ao finalizar a compra
- Dinheiro: Informar troco obrigatório
- Cartão: 1x, 2x e 3x com taxas da maquina

## Entrega vs Retirada

- Retirada: Gratuita, no endereço da confeitaria
- Entrega: Taxa variável, motoristas cadastrados e de confiança

## Política de Cancelamento

- Cancelamentos com antecedência não geram multa
- Última hora pode ter taxa
- Reembolso conforme forma de pagamento

## Produtos

- Cardápio organizado em abas dinâmicas
- Produtos com badge "Mais Vendido" são populares
- Produtos ocultos podem estar temporariamente indisponíveis

## Cupons

- Cupons quando liberados são anunciados nas redes sociais.
- Um cupom por pedido
- Tipos: percentual, valor fixo, frete grátis

## Dúvidas Frequentes

- Pedido não é confirmado automaticamente: precisa enviar mensagem WhatsApp
- Pode alterar pedido após enviar: entre em contato rápido
- Prazo de produção: informado ao confirmar
- Entrega Nova Russas e Região
- Aceita cartão na entrega/retirada
- Faz encomendas personalizadas: entre em contato
- Quem é o criador/desenvolver do site: Mateus Couto

## Tom de Voz

- Amigável, acolhedor, profissional e humano
- Linguagem simples e direta
- Empático com problemas
- Ofereça soluções práticas
- Pode usar emojis, casos necessário.

## Situações que Requerem Intervenção Humana

- Cancelamentos com menos de X horas
- Reclamações sobre qualidade
- Reembolsos complexos
- Encomendas personalizadas
- Problemas técnicos no site

Nesses casos, sugira contato direto pelo WhatsApp.
`;
  }
}

function getPublicDataRoot() {
  return db.collection('artifacts').doc('helo-confeitaria')
    .collection('public').doc('data');
}

function getProductsCollection() {
  return getPublicDataRoot().collection('products');
}

/**
 * Retorna referência de documento na coleção meta pública.
 *
 * @param {string} name - Nome do documento meta (ex: site_settings)
 * @returns {FirebaseFirestore.DocumentReference} Referência do documento meta
 */
function getMetaDoc(name) {
  return getPublicDataRoot().collection('meta').doc(String(name || '').trim());
}

function normalizeNotifyEmails(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function readAdminAllowedEmails() {
  return new Set(
    String(readEnvText('ADMIN_ALLOWED_EMAILS'))
      .split(',')
      .map((value) => normalizeEmail(value))
      .filter(Boolean)
  );
}

function formatOrderDateForEmail(orderData = {}) {
  const rawDate = String(orderData.date || '').trim();
  const rawTime = String(orderData.time || '').trim();
  if (!rawDate) return 'Não informado';

  const parts = rawDate.split('-');
  const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : rawDate;
  return rawTime ? `${dateLabel} às ${rawTime}h` : dateLabel;
}

function buildOrderItemsSummary(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return 'Nenhum item informado';
  return list
    .map((item) => {
      const qty = Math.max(0, Math.trunc(Number(item?.qty) || 0));
      const name = String(item?.name || 'Produto').trim() || 'Produto';
      const price = Number(item?.price || 0);
      const lineTotal = Number.isFinite(price) ? price * qty : 0;
      return `${qty}x ${name} - R$ ${lineTotal.toFixed(2)}`;
    })
    .join('\n');
}

async function sendEmailJsNotification({
  serviceId,
  templateId,
  publicKey,
  privateKey,
  toEmail,
  templateParams,
}) {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        ...templateParams,
        to_email: toEmail,
      },
    }),
  });

  if (response.ok) return;

  const responseText = await response.text();
  throw new Error(`EmailJS HTTP ${response.status}: ${String(responseText || '').slice(0, 400)}`);
}

function normalizeOrderItemProductId(item) {
  return String(item?.productId || item?.id || '').trim();
}

function normalizeOrderItemQty(item) {
  const parsed = Number(item?.qty);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

const STOCK_RESERVATION_STATUS = {
  APPLIED: 'applied',
  NO_LIMITED_PRODUCTS: 'no_limited_products',
  SKIPPED_NO_PRODUCT_IDS: 'skipped_no_product_ids',
  FAILED_INSUFFICIENT_STOCK: 'failed_insufficient_stock',
  FAILED_MISSING_PRODUCTS: 'failed_missing_products',
  FAILED_DATABASE_ERROR: 'failed_database_error',
};

const CONCLUDABLE_STOCK_RESERVATION_STATUSES = new Set([
  STOCK_RESERVATION_STATUS.APPLIED,
  STOCK_RESERVATION_STATUS.NO_LIMITED_PRODUCTS,
  STOCK_RESERVATION_STATUS.SKIPPED_NO_PRODUCT_IDS,
]);

function createStockReservationError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function normalizeStatusKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isConcludedOrderStatus(value) {
  return normalizeStatusKey(value) === 'concluido';
}

exports.sendOrderNotificationEmail = onDocumentCreated(
  'artifacts/helo-confeitaria/public/data/orders/{orderId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return null;

    const serviceId = readEnvText('EMAILJS_SERVICE_ID');
    const templateId = readEnvText('EMAILJS_TEMPLATE_ID');
    const publicKey = readEnvText('EMAILJS_PUBLIC_KEY');
    const privateKey = readEnvText('EMAILJS_PRIVATE_KEY');
    const notifyEmails = normalizeNotifyEmails(readEnvText('EMAILJS_NOTIFY_EMAILS'));

    if (!serviceId || !templateId || !publicKey || !privateKey || notifyEmails.length === 0) {
      console.warn(`Order ${event.params.orderId}: email notification skipped (missing EMAILJS env configuration).`);
      return null;
    }

    const orderData = snapshot.data() || {};
    const templateParams = {
      order_id: event.params.orderId,
      customer_name: String(orderData.customerName || 'Cliente').trim() || 'Cliente',
      customer_phone: String(orderData.customerPhone || '').trim(),
      order_date: formatOrderDateForEmail(orderData),
      order_items: buildOrderItemsSummary(orderData.items),
      payment_method: String(orderData.paymentMethod || 'Não informado').trim(),
      delivery_method: String(orderData.method || 'Não informado').trim(),
      delivery_address: String(orderData.address || '').trim(),
      order_total: `R$ ${Number(orderData.total || 0).toFixed(2)}`,
      campaign_id: String(orderData.campaignId || '').trim(),
    };

    const sentTo = [];
    const failedTo = [];

    for (const toEmail of notifyEmails) {
      try {
        await sendEmailJsNotification({
          serviceId,
          templateId,
          publicKey,
          privateKey,
          toEmail,
          templateParams,
        });
        sentTo.push(toEmail);
      } catch (error) {
        failedTo.push({
          toEmail,
          reason: String(error?.message || error).slice(0, 400),
        });
      }
    }

    const status = failedTo.length === 0
      ? 'sent'
      : sentTo.length > 0
        ? 'partial_failure'
        : 'failed';

    try {
      await snapshot.ref.set({
        emailNotification: {
          provider: 'emailjs_server',
          status,
          sentTo,
          failedTo,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      }, { merge: true });
    } catch (error) {
      console.error(`Order ${event.params.orderId}: failed to persist email notification result:`, error);
    }

    return null;
  }
);

exports.applyOrderStockReservation = onDocumentCreated(
  'artifacts/helo-confeitaria/public/data/orders/{orderId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return null;
    const orderRef = snapshot.ref;

    try {
      await db.runTransaction(async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) return;

        const orderData = orderSnap.data() || {};
        const reservation = orderData.stockReservation || {};
        if (reservation.appliedAt || reservation.processedAt || reservation.status) return;

        const items = Array.isArray(orderData.items) ? orderData.items : [];
        const qtyByProductId = new Map();

        items.forEach((item) => {
          const productId = normalizeOrderItemProductId(item);
          const qty = normalizeOrderItemQty(item);
          if (!productId || qty <= 0) return;
          qtyByProductId.set(productId, (qtyByProductId.get(productId) || 0) + qty);
        });

        if (qtyByProductId.size === 0) {
          transaction.update(orderRef, {
            stockReservation: {
              status: STOCK_RESERVATION_STATUS.SKIPPED_NO_PRODUCT_IDS,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              orderItemCount: items.length,
              distinctProductCount: 0,
            },
          });
          return;
        }

        const productEntries = [];
        for (const [productId, qty] of qtyByProductId.entries()) {
          const productRef = getProductsCollection().doc(productId);
          const productSnap = await transaction.get(productRef);
          productEntries.push({ productId, qty, productRef, productSnap });
        }

        const missingProductIds = [];
        const unlimitedProductIds = [];
        const insufficientItems = [];
        const limitedEntries = [];

        for (const entry of productEntries) {
          const { productId, qty, productSnap, productRef } = entry;

          if (!productSnap.exists) {
            missingProductIds.push(productId);
            continue;
          }

          const productData = productSnap.data() || {};
          const currentStock = Number(productData.stockLimit);
          if (!Number.isFinite(currentStock)) {
            unlimitedProductIds.push(productId);
            continue;
          }

          const normalizedCurrentStock = Math.max(0, Math.trunc(currentStock));
          if (qty > normalizedCurrentStock) {
            insufficientItems.push({
              productId,
              requestedQty: qty,
              availableStock: normalizedCurrentStock,
            });
            continue;
          }

          limitedEntries.push({
            productId,
            qty,
            productRef,
            previousStock: normalizedCurrentStock,
            nextStock: normalizedCurrentStock - qty,
          });
        }

        if (missingProductIds.length > 0) {
          throw createStockReservationError(
            STOCK_RESERVATION_STATUS.FAILED_MISSING_PRODUCTS,
            'Missing products while reserving stock.',
            {
              missingProductIds,
              unlimitedProductIds,
              insufficientItems,
            }
          );
        }

        if (insufficientItems.length > 0) {
          throw createStockReservationError(
            STOCK_RESERVATION_STATUS.FAILED_INSUFFICIENT_STOCK,
            'Insufficient stock for one or more products.',
            {
              missingProductIds,
              unlimitedProductIds,
              insufficientItems,
            }
          );
        }

        const decremented = [];
        for (const entry of limitedEntries) {
          transaction.update(entry.productRef, {
            stockLimit: admin.firestore.FieldValue.increment(-entry.qty),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          decremented.push({
            productId: entry.productId,
            qty: entry.qty,
            previousStock: entry.previousStock,
            nextStock: entry.nextStock,
          });
        }

        transaction.update(orderRef, {
          stockReservation: {
            status: decremented.length > 0
              ? STOCK_RESERVATION_STATUS.APPLIED
              : STOCK_RESERVATION_STATUS.NO_LIMITED_PRODUCTS,
            appliedAt: admin.firestore.FieldValue.serverTimestamp(),
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            orderItemCount: items.length,
            distinctProductCount: qtyByProductId.size,
            decremented,
            insufficientItems: [],
            unlimitedProductIds,
            missingProductIds,
          },
        });
      });
    } catch (error) {
      const errorCode = String(error?.code || '').trim();
      const failureStatus = [
        STOCK_RESERVATION_STATUS.FAILED_INSUFFICIENT_STOCK,
        STOCK_RESERVATION_STATUS.FAILED_MISSING_PRODUCTS,
      ].includes(errorCode)
        ? errorCode
        : STOCK_RESERVATION_STATUS.FAILED_DATABASE_ERROR;
      const details = (error && typeof error.details === 'object' && error.details)
        ? error.details
        : {};
      const reason = String(error?.message || error || 'Stock reservation failure').slice(0, 400);

      try {
        await orderRef.set({
          stockReservation: {
            status: failureStatus,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
            reason,
            ...details,
          },
        }, { merge: true });
      } catch (markError) {
        console.error(`Failed to persist stock reservation error for order ${event.params.orderId}:`, markError);
      }

      if (failureStatus === STOCK_RESERVATION_STATUS.FAILED_DATABASE_ERROR) {
        console.error(`Database error while reserving stock for order ${event.params.orderId}:`, error);
      } else {
        console.warn(`Stock reservation blocked for order ${event.params.orderId}: ${failureStatus}`);
      }
    }

    return null;
  }
);

const ALGOS = {
  SHA1: 'RSA-SHA1',
  SHA256: 'RSA-SHA256',
  SHA512: 'RSA-SHA512',
};

function readEnvText(name, fallback = '') {
  const raw = process.env[name];
  if (!raw) return fallback;
  return String(raw).trim();
}

function normalizePem(pemLike) {
  const raw = String(pemLike || '').trim();
  if (!raw) return '';
  if (raw.includes('BEGIN') && raw.includes('END')) {
    return raw.replace(/\\n/g, '\n');
  }
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (decoded.includes('BEGIN') && decoded.includes('END')) {
      return decoded;
    }
  } catch (_) {
    // Ignore and return raw as-is below.
  }
  return raw.replace(/\\n/g, '\n');
}

function corsHeaders(req) {
  const origin = req.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Vary': 'Origin',
  };
}

function sendCors(res, req) {
  const headers = corsHeaders(req);
  Object.keys(headers).forEach((key) => res.set(key, headers[key]));
}

function extractBearerToken(authorizationHeaderValue) {
  const raw = String(authorizationHeaderValue || '').trim();
  if (!raw) return '';
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match) return '';
  return String(match[1] || '').trim();
}

function getPrivateKeyPem() {
  return normalizePem(readEnvText('QZ_PRIVATE_KEY_PEM'));
}

function getCertificatePem() {
  return normalizePem(readEnvText('QZ_CERT_PEM'));
}

exports.adminClaimApi = onRequest({ invoker: 'public' }, async (req, res) => {
  sendCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const path = String(req.path || '/').toLowerCase();

  if (req.method === 'POST' && path.endsWith('/claim/sync')) {
    const allowedEmails = readAdminAllowedEmails();
    if (allowedEmails.size === 0) {
      console.error('adminClaimApi: ADMIN_ALLOWED_EMAILS is empty.');
      return res.status(503).json({
        error: 'ADMIN_ALLOWED_EMAILS is not configured on backend.',
      });
    }

    const idToken = extractBearerToken(req.get('authorization'));
    if (!idToken) {
      console.warn('adminClaimApi: missing bearer token.', { path, method: req.method });
      return res.status(401).json({ error: 'Missing Bearer token.' });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.warn('adminClaimApi: invalid auth token.', {
        path,
        method: req.method,
        reason: String(error?.message || error).slice(0, 200),
      });
      return res.status(401).json({ error: 'Invalid auth token.' });
    }

    const uid = String(decodedToken?.uid || '').trim();
    const email = normalizeEmail(decodedToken?.email);
    if (!uid || !email || !allowedEmails.has(email)) {
      console.warn('adminClaimApi: user not eligible for admin claim.', {
        uid,
        email,
      });
      return res.status(403).json({ error: 'User is not eligible for admin claim.' });
    }

    try {
      const userRecord = await admin.auth().getUser(uid);
      const currentClaims = (userRecord.customClaims && typeof userRecord.customClaims === 'object')
        ? userRecord.customClaims
        : {};

      if (currentClaims.admin === true) {
        console.log('adminClaimApi: claim already present.', { uid, email });
        return res.status(200).json({ status: 'already_admin' });
      }

      await admin.auth().setCustomUserClaims(uid, {
        ...currentClaims,
        admin: true,
      });

      console.log('adminClaimApi: claim applied.', { uid, email });

      return res.status(200).json({ status: 'claim_applied' });
    } catch (error) {
      console.error('adminClaimApi claim/sync failed:', error);
      return res.status(500).json({ error: 'Failed to sync admin claim.' });
    }
  }

  return res.status(404).json({ error: 'Not found' });
});

exports.restoreOrderStockOnDelete = onDocumentDeleted(
  'artifacts/helo-confeitaria/public/data/orders/{orderId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return null;

    const orderData = snapshot.data() || {};
    const reservation = orderData.stockReservation || {};
    const decremented = Array.isArray(reservation.decremented) ? reservation.decremented : [];

    /* Se o estoque já foi restaurado pelo cancelamento, não restaura de novo */
    if (reservation.stockRestoredAt) return null;

    if (decremented.length === 0) return null;

    const decrementedEntries = [];
    for (const entry of decremented) {
      const productId = String(entry.productId || '').trim();
      const qty = Math.trunc(Number(entry.qty));
      if (!productId || !Number.isFinite(qty) || qty <= 0) continue;
      decrementedEntries.push({ productId, qty });
    }

    if (decrementedEntries.length === 0) return null;

    try {
      await db.runTransaction(async (transaction) => {
        const productEntries = [];
        for (const entry of decrementedEntries) {
          const productRef = getProductsCollection().doc(entry.productId);
          const productSnap = await transaction.get(productRef);
          productEntries.push({ ...entry, productRef, productSnap });
        }

        for (const entry of productEntries) {
          if (!entry.productSnap.exists) continue;

          const productData = entry.productSnap.data() || {};
          const currentStock = Number(productData.stockLimit);
          if (!Number.isFinite(currentStock)) continue;

          const restoredStock = Math.max(0, Math.trunc(currentStock)) + entry.qty;

          transaction.update(entry.productRef, {
            stockLimit: restoredStock,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });

      console.log(`Stock restored for deleted order ${event.params.orderId}, items: ${decrementedEntries.length}`);
    } catch (error) {
      console.error('Error restoring stock for deleted order:', error);
    }

    return null;
  }
);

exports.preventOrderConclusionWithoutStockReservation = onDocumentUpdated(
  'artifacts/helo-confeitaria/public/data/orders/{orderId}',
  async (event) => {
    const beforeSnap = event.data?.before;
    const afterSnap = event.data?.after;
    if (!beforeSnap?.exists || !afterSnap?.exists) return null;

    const beforeData = beforeSnap.data() || {};
    const afterData = afterSnap.data() || {};

    const wasConcluded = isConcludedOrderStatus(beforeData.status);
    const isNowConcluded = isConcludedOrderStatus(afterData.status);
    if (wasConcluded || !isNowConcluded) return null;

    const reservationStatus = String(afterData?.stockReservation?.status || '').trim();
    if (CONCLUDABLE_STOCK_RESERVATION_STATUSES.has(reservationStatus)) return null;

    const fallbackStatus = String(beforeData.status || '').trim() || 'Novo';
    const reason = reservationStatus
      ? `Order conclusion blocked: stockReservation.status=${reservationStatus}`
      : 'Order conclusion blocked: missing stock reservation.';

    try {
      await afterSnap.ref.set({
        status: fallbackStatus,
        completedAt: admin.firestore.FieldValue.delete(),
        concluidoEm: admin.firestore.FieldValue.delete(),
        stockReservation: {
          ...(afterData.stockReservation || {}),
          status: reservationStatus || STOCK_RESERVATION_STATUS.FAILED_DATABASE_ERROR,
          blocksConclusion: true,
          blockedConclusionAt: admin.firestore.FieldValue.serverTimestamp(),
          blockReason: reason,
        },
      }, { merge: true });

      console.warn(`Conclusion reverted for order ${event.params.orderId}: ${reason}`);
    } catch (error) {
      console.error(`Failed to revert invalid conclusion for order ${event.params.orderId}:`, error);
    }

    return null;
  }
);

/* ── Restaura estoque quando pedido é cancelado (mudança de status) ──
   Ao contrário de restoreOrderStockOnDelete (que roda quando o documento
   é deletado), esta função roda quando o status muda para "Cancelado".
   O pedido permanece no banco para auditoria, mas o estoque volta.

   Usa stockReservation.decremented para saber exatamente quanto
   incrementar em cada produto. Se não houver reserva registrada,
   faz fallback lendo os items do pedido e os produtos atuais. */
exports.restoreStockOnCancel = onDocumentUpdated(
  'artifacts/helo-confeitaria/public/data/orders/{orderId}',
  async (event) => {
    const beforeSnap = event.data?.before;
    const afterSnap = event.data?.after;
    if (!beforeSnap?.exists || !afterSnap?.exists) return null;

    const beforeStatus = normalizeStatusKey((beforeSnap.data() || {}).status);
    const afterStatus = normalizeStatusKey((afterSnap.data() || {}).status);

    /* Só atua quando status muda PARA cancelado (não era cancelado antes) */
    if (beforeStatus === 'cancelado' || afterStatus !== 'cancelado') return null;

    const afterData = afterSnap.data() || {};
    const reservation = afterData.stockReservation || {};

    /* Se já foi restaurado, não faz nada */
    if (reservation.stockRestoredAt) return null;

    const decremented = Array.isArray(reservation.decremented) ? reservation.decremented : [];
    const decrementedEntries = [];

    for (const entry of decremented) {
      const productId = String(entry.productId || '').trim();
      const qty = Math.trunc(Number(entry.qty));
      if (!productId || !Number.isFinite(qty) || qty <= 0) continue;
      decrementedEntries.push({ productId, qty });
    }

    if (decrementedEntries.length === 0) return null;

    try {
      await db.runTransaction(async (transaction) => {
        const productEntries = [];
        for (const entry of decrementedEntries) {
          const productRef = getProductsCollection().doc(entry.productId);
          const productSnap = await transaction.get(productRef);
          productEntries.push({ ...entry, productRef, productSnap });
        }

        for (const entry of productEntries) {
          if (!entry.productSnap.exists) continue;

          const productData = entry.productSnap.data() || {};
          const currentStock = Number(productData.stockLimit);
          if (!Number.isFinite(currentStock)) continue;

          const restoredStock = Math.max(0, Math.trunc(currentStock)) + entry.qty;

          transaction.update(entry.productRef, {
            stockLimit: restoredStock,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        /* Marca que o estoque foi restaurado para evitar dupla restauração */
        transaction.update(afterSnap.ref, {
          'stockReservation.stockRestoredAt': admin.firestore.FieldValue.serverTimestamp(),
          'stockReservation.stockRestoredReason': 'order_cancelled',
        });
      });

      console.log(`Stock restored for cancelled order ${event.params.orderId}, items: ${decrementedEntries.length}`);
    } catch (error) {
      console.error(`Error restoring stock for cancelled order ${event.params.orderId}:`, error);
    }

    return null;
  }
);

exports.qzApiV2 = onRequest({ invoker: 'public' }, (req, res) => {
  sendCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const path = String(req.path || '/').toLowerCase();

  if (req.method === 'GET' && path.endsWith('/certificate')) {
    const cert = getCertificatePem();
    if (!cert) {
      return res.status(500).json({ error: 'QZ_CERT_PEM not configured.' });
    }
    return res.status(200).json({ certificate: cert });
  }

  if (req.method === 'POST' && path.endsWith('/sign')) {
    const privateKey = getPrivateKeyPem();
    if (!privateKey) {
      return res.status(500).json({ error: 'QZ_PRIVATE_KEY_PEM not configured.' });
    }

    const requestToSign = String((req.body && req.body.request) || '');
    if (!requestToSign) {
      return res.status(400).json({ error: 'Missing request payload to sign.' });
    }

    const requestedAlgo = String((req.body && req.body.algorithm) || 'SHA512').toUpperCase();
    const signerAlgo = ALGOS[requestedAlgo] || ALGOS.SHA512;

    try {
      const signer = crypto.createSign(signerAlgo);
      signer.update(requestToSign, 'utf8');
      signer.end();
      const signature = signer.sign(privateKey, 'base64');
      return res.status(200).json({ signature });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to sign payload.',
        details: String(error && error.message ? error.message : error),
      });
    }
  }

  return res.status(404).json({ error: 'Not found' });
});

/* ── Definição de ferramentas para o agente AI (Function Calling) ─────────
   Define as ferramentas que o agente pode invocar para realizar ações no site.
   Cada ferramenta tem: nome, descrição e parâmetros esperados.
   
   @update 2026-04-30 — Criado para implementar agente com function calling. */
const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'adicionar_ao_carrinho',
      description: 'Adiciona um produto ao carrinho de compras do cliente. Use quando o usuário pedir para adicionar um produto específico.',
      parameters: {
        type: 'object',
        properties: {
          produtoId: {
            type: 'string',
            description: 'ID do produto a ser adicionado (ex: "p1", "p2")',
          },
          nomeProduto: {
            type: 'string',
            description: 'Nome do produto para confirmação visual (ex: "Bolo de Chocolate")',
          },
          quantidade: {
            type: 'number',
            description: 'Quantidade a adicionar (padrão: 1)',
          },
        },
        required: ['produtoId', 'nomeProduto'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_estoque',
      description: 'Consulta o estoque disponível de um produto específico. Use quando o usuário perguntar sobre disponibilidade.',
      parameters: {
        type: 'object',
        properties: {
          produtoId: {
            type: 'string',
            description: 'ID do produto a consultar (ex: "p1", "p2")',
          },
          nomeProduto: {
            type: 'string',
            description: 'Nome do produto para busca (ex: "Bolo de Chocolate")',
          },
        },
        required: ['nomeProduto'],
      },
    },
  },
];

/* ── Função auxiliar: adicionar_ao_carrinho ───────────────────────────────
   Executa a lógica de adicionar produto ao carrinho no backend.
   Valida que o produto existe, está visível e tem estoque suficiente.
   Como o carrinho é estado do front-end, retorna instruções para o front-end
   executar a ação localmente.
   
   @update 2026-04-30 — Criado para agente adicionar produtos ao carrinho.
   @update 2026-05-01 — Adicionada validação de existência, visibilidade e estoque. */
async function toolAdicionarAoCarrinho({ produtoId, nomeProduto, quantidade = 1 }) {
  try {
    /* Valida parâmetros */
    if (!produtoId || !nomeProduto) {
      return {
        success: false,
        error: 'ID do produto e nome são obrigatórios',
      };
    }

    /* Valida quantidade */
    const qty = Math.max(1, Math.trunc(Number(quantidade) || 1));

    /* Busca o produto no banco para validar */
    const productRef = getProductsCollection().doc(String(produtoId).trim());
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      return {
        success: false,
        error: 'Produto não encontrado no catálogo',
      };
    }

    const productData = productSnap.data() || {};

    /* Valida se o produto está visível */
    if (productData.isVisible === false) {
      return {
        success: false,
        error: 'Este produto não está disponível no momento',
      };
    }

    /* Valida estoque se houver limite */
    const stockLimit = Number(productData.stockLimit);
    if (Number.isFinite(stockLimit) && stockLimit <= 0) {
      return {
        success: false,
        error: 'Produto sem estoque disponível',
      };
    }

    if (Number.isFinite(stockLimit) && qty > stockLimit) {
      return {
        success: false,
        error: `Estoque insuficiente. Disponível: ${stockLimit} unidade(s), solicitado: ${qty}`,
      };
    }

    /* Como o carrinho é estado do front-end, retorna instruções */
    return {
      success: true,
      action: 'add_to_cart',
      data: {
        productId: String(produtoId).trim(),
        productName: String(nomeProduto).trim(),
        quantity: qty,
      },
      message: `Adicionando ${qty}x "${nomeProduto}" ao carrinho.`,
    };
  } catch (error) {
    console.error('[toolAdicionarAoCarrinho] Error:', error);
    return {
      success: false,
      error: String(error.message),
    };
  }
}

/* ── Função auxiliar: consultar_estoque ───────────────────────────────────
   Consulta o estoque de um produto no Firestore.
   
   @update 2026-04-30 — Criado para agente consultar disponibilidade de produtos. */
async function toolConsultarEstoque({ produtoId, nomeProduto }) {
  try {
    /* Se productId foi fornecido, consulta direto */
    if (produtoId) {
      const productRef = getProductsCollection().doc(String(produtoId).trim());
      const productSnap = await productRef.get();

      if (!productSnap.exists) {
        return {
          success: false,
          error: 'Produto não encontrado',
        };
      }

      const productData = productSnap.data() || {};
      const stockLimit = Number(productData.stockLimit);

      return {
        success: true,
        data: {
          productId: String(produtoId).trim(),
          productName: String(productData.name || nomeProduto || 'Produto').trim(),
          stockAvailable: Number.isFinite(stockLimit) ? Math.max(0, Math.trunc(stockLimit)) : null,
          hasLimit: Number.isFinite(stockLimit),
        },
        message: Number.isFinite(stockLimit)
          ? `Estoque disponível: ${Math.max(0, Math.trunc(stockLimit))} unidade(s)`
          : 'Produto sem limite de estoque',
      };
    }

    /* Se apenas nomeProduto foi fornecido, busca por nome normalizado */
    const normalizedSearch = normalizeStatusKey(nomeProduto);
    /* Divide em palavras para busca mais flexível (ex: "snicker supreme" -> ["snicker", "supreme"]) */
    const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 0);
    
    console.log('[toolConsultarEstoque] Buscando por nome:', nomeProduto, 'palavras:', searchWords);
    
    let productsSnapshot;
    
    try {
      /* Tenta buscar apenas produtos visíveis */
      productsSnapshot = await getProductsCollection()
        .where('isVisible', '==', true)
        .get();
    } catch (queryError) {
      /* Fallback: busca todos os produtos se a query com isVisible falhar */
      console.warn('[toolConsultarEstoque] Query com isVisible falhou, buscando todos os produtos:', queryError.message);
      productsSnapshot = await getProductsCollection().get();
    }

    const matchedProducts = [];
    productsSnapshot.forEach((doc) => {
      const data = doc.data() || {};
      /* Pula produtos explicitamente ocultos se a data tiver o campo */
      if (data.isVisible === false) return;
      
      const normalizedName = normalizeStatusKey(data.name || '');
      
      /* Verifica se TODAS as palavras de busca estão no nome do produto */
      const allWordsMatch = searchWords.every(word => 
        normalizedName.includes(word) || word.includes(normalizedName)
      );
      
      if (allWordsMatch) {
        matchedProducts.push({
          id: doc.id,
          ...data,
        });
      }
    });
    
    console.log('[toolConsultarEstoque] Produtos encontrados:', matchedProducts.length);

    if (matchedProducts.length === 0) {
      return {
        success: false,
        error: 'Nenhum produto encontrado com esse nome',
      };
    }

    if (matchedProducts.length === 1) {
      const product = matchedProducts[0];
      const stockLimit = Number(product.stockLimit);
      return {
        success: true,
        data: {
          productId: product.id,
          productName: String(product.name || nomeProduto).trim(),
          stockAvailable: Number.isFinite(stockLimit) ? Math.max(0, Math.trunc(stockLimit)) : null,
          hasLimit: Number.isFinite(stockLimit),
        },
        message: Number.isFinite(stockLimit)
          ? `Estoque disponível: ${Math.max(0, Math.trunc(stockLimit))} unidade(s)`
          : 'Produto sem limite de estoque',
      };
    }

    /* Múltiplos produtos encontrados - retorna lista */
    const productsList = matchedProducts.map((p) => {
      const stockLimit = Number(p.stockLimit);
      return {
        productId: p.id,
        productName: String(p.name).trim(),
        stockAvailable: Number.isFinite(stockLimit) ? Math.max(0, Math.trunc(stockLimit)) : null,
        hasLimit: Number.isFinite(stockLimit),
      };
    });

    return {
      success: true,
      data: {
        multiple: true,
        products: productsList,
      },
      message: `Encontrados ${productsList.length} produtos. Por favor, especifique qual deseja.`,
    };
  } catch (error) {
    console.error('[toolConsultarEstoque] Error:', error);
    return {
      success: false,
      error: String(error.message),
    };
  }
}

/* ── Rate limiting simples em memória para groqChat ────────────────────
   Mapa de IP → { count, resetAt }. Limita cada IP a GROQ_RATE_LIMIT_MAX
   requisições por GROQ_RATE_LIMIT_WINDOW_MS. Entradas expiradas são
   limpas a cada verificação para evitar vazamento de memória.
   
   @update 2026-04-29 — Criado para proteção contra abuso do endpoint. */
const GROQ_RATE_LIMIT_MAX = 10;
const GROQ_RATE_LIMIT_WINDOW_MS = 60_000;
const groqRateLimitMap = new Map();
const AI_ENABLED_CACHE_TTL_MS = 20_000;
const aiEnabledCacheState = {
  value: false,
  expiresAt: 0,
  inFlight: null,
};

/**
 * Lê aiEnabled do site_settings com cache curto para reduzir custo por request.
 *
 * @returns {Promise<boolean>} true quando chat está habilitado
 * @update 2026-05-09 — Adicionado gate de custo no endpoint groqChat.
 */
async function readAiEnabledWithCache() {
  const now = Date.now();
  if (now < aiEnabledCacheState.expiresAt) {
    return Boolean(aiEnabledCacheState.value);
  }

  if (aiEnabledCacheState.inFlight) {
    return aiEnabledCacheState.inFlight;
  }

  aiEnabledCacheState.inFlight = getMetaDoc('site_settings').get()
    .then((snapshot) => {
      const settingsData = snapshot.exists ? (snapshot.data() || {}) : {};
      const enabled = settingsData.aiEnabled === true;
      aiEnabledCacheState.value = enabled;
      aiEnabledCacheState.expiresAt = Date.now() + AI_ENABLED_CACHE_TTL_MS;
      return enabled;
    })
    .catch((error) => {
      console.warn('[groqChat] Falha ao ler aiEnabled em site_settings:', String(error?.message || error));
      aiEnabledCacheState.value = false; // fail-closed para evitar custo inesperado.
      aiEnabledCacheState.expiresAt = Date.now() + 5_000;
      return false;
    })
    .finally(() => {
      aiEnabledCacheState.inFlight = null;
    });

  return aiEnabledCacheState.inFlight;
}

/* ── Verifica se IP excedeu limite de requisições ────────────────────────
   Retorna true se o IP pode prosseguir, false se excedeu o limite.
   Limpa entradas expiradas automaticamente. */
function checkGroqRateLimit(ip) {
  const now = Date.now();

  /* Limpa entradas expiradas para evitar crescimento infinito do Map */
  for (const [key, entry] of groqRateLimitMap) {
    if (now >= entry.resetAt) groqRateLimitMap.delete(key);
  }

  const entry = groqRateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    groqRateLimitMap.set(ip, { count: 1, resetAt: now + GROQ_RATE_LIMIT_WINDOW_MS });
    return true;
  }

  entry.count++;
  return entry.count <= GROQ_RATE_LIMIT_MAX;
}

/* ── Limpa respostas de tags de função visíveis ─────────────────────────
   Remove as tags <function=...> que aparecem visíveis no texto da resposta.
   Essas tags são gerenciadas internamente; o cliente deve ver apenas texto natural.
   
   @update 2026-05-01 — Criado para remover ruído de function calling da resposta. */
function cleanResponseContent(content) {
  if (!content) return content;
  /* Remove tags <function=...> incluindo quebras de linha e espaços */
  return String(content)
    .replace(/<function=[^>]*>[^<]*<\/function>/gs, '')
    .replace(/<function=[^>]*>/g, '')
    .trim();
}

/* ── groqChat: Proxy seguro para API Groq ───────────────────────────
   Recebe mensagens do front-end, chama API Groq com contexto da base de
   conhecimento e retorna resposta. A chave API nunca é exposta ao cliente.
   Inclui rate limiting por IP para proteção contra abuso.
   
   @update 2026-04-29 — Criado para assistente de vendas no site Helô Confeitaria.
   @update 2026-04-29 — Adicionado rate limiting por IP (10 req/min).
   @update 2026-04-29 — Corrigido para usar API Groq (https://console.groq.com).
   @update 2026-05-01 — Adicionado filtro para remover tags de função visíveis. */
exports.groqChat = onRequest({ invoker: 'public' }, async (req, res) => {
  sendCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isAiEnabled = await readAiEnabledWithCache();
  if (!isAiEnabled) {
    return res.status(403).json({
      error: 'Assistente virtual indisponível no momento.',
      code: 'ai_disabled',
    });
  }

  /* ── Rate limiting por IP ──────────────────────────────────────────────
     Protege contra abuso: máximo 10 mensagens por minuto por IP. */
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';

  if (!checkGroqRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'Muitas mensagens. Aguarde um momento e tente novamente.',
    });
  }

  try {
    const { message, conversationHistory } = req.body;

    console.log('[groqChat] Recebida mensagem:', message?.substring(0, 100));

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.error('[groqChat] GROQ_API_KEY não configurada');
      return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: 'Mensagem muito longa (máximo 2000 caracteres)' });
    }

    /* ── Contexto da base de conhecimento ────────────────────────────────
       Carrega o documento BASE_CONHECIMENTO_IA_ATENDIMENTO.md dinamicamente
       para a IA responder perguntas sobre a Helô Confeitaria.
       @update 2026-04-29 — Alterado para leitura dinâmica do arquivo. */
    const knowledgeBase = loadKnowledgeBase();

    /* ── Constrói array de mensagens para API Groq ────────────────────────
       Inclui contexto da base de conhecimento + histórico de conversa. */
    const messages = [
      {
        role: 'system',
        content: knowledgeBase,
      },
      ...conversationHistory,
      {
        role: 'user',
        content: message,
      },
    ];

    /* ── Loop de execução com Function Calling ─────────────────────────────
       Executa chamadas à API Groq em loop até que o modelo não solicite mais
       ferramentas. Suporta múltiplas chamadas de função em uma única requisição.
       
       @update 2026-04-30 — Adicionado suporte a function calling com loop.
       @update 2026-05-01 — Reduzido para máx 3 iterações para economizar tokens. */
    let currentMessages = messages;
    let agentActions = [];
    const MAX_TOOL_ITERATIONS = 3;
    let iterationCount = 0;

    while (iterationCount < MAX_TOOL_ITERATIONS) {
      iterationCount++;
      console.log(`[groqChat] Iteração ${iterationCount}/${MAX_TOOL_ITERATIONS}`);

      /* Chama API do Groq com ferramentas habilitadas */
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: currentMessages,
          tools: AGENT_TOOLS,
          tool_choice: 'auto',
          max_tokens: 256,
          temperature: 0.7,
        }),
      });

      if (!groqResponse.ok) {
        const errorText = await groqResponse.text();
        console.error('[Groq API] Error:', groqResponse.status, errorText);
        return res.status(500).json({ error: 'Failed to call Groq API', details: errorText });
      }
      
      console.log('[groqChat] Resposta da API Groq recebida com sucesso');

      const groqData = await groqResponse.json();
      const assistantMessage = groqData.choices?.[0]?.message;

      /* Se não houver tool_calls, retorna a resposta textual */
      if (!assistantMessage?.tool_calls || assistantMessage.tool_calls.length === 0) {
        const rawReply = assistantMessage?.content || 'Não foi possível gerar resposta.';
        const reply = cleanResponseContent(rawReply);
        return res.status(200).json({ 
          reply,
          agentActions: agentActions.length > 0 ? agentActions : undefined,
        });
      }

      /* Executa as chamadas de ferramenta */
      const toolCalls = assistantMessage.tool_calls;
      const toolResults = [];
      
      console.log(`[groqChat] ${toolCalls.length} chamadas de ferramenta a executar`);

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

        console.log(`[groqChat] Executing tool: ${functionName}`, functionArgs);

        let toolResult;
        try {
          if (functionName === 'adicionar_ao_carrinho') {
            toolResult = await toolAdicionarAoCarrinho(functionArgs);
          } else if (functionName === 'consultar_estoque') {
            toolResult = await toolConsultarEstoque(functionArgs);
          } else {
            toolResult = {
              success: false,
              error: `Ferramenta desconhecida: ${functionName}`,
            };
          }
        } catch (toolError) {
          console.error(`[groqChat] Erro ao executar ${functionName}:`, toolError);
          toolResult = {
            success: false,
            error: String(toolError.message),
          };
        }

        console.log(`[groqChat] Resultado de ${functionName}:`, toolResult.success ? 'sucesso' : 'falha');

        /* Se a ferramenta retornou uma ação para o front-end, armazena */
        if (toolResult.success && toolResult.action) {
          agentActions.push(toolResult);
          console.log(`[groqChat] Ação adicionada: ${toolResult.action}`);
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(toolResult),
        });
      }

      /* Adiciona mensagem do assistente e resultados das ferramentas ao histórico */
      currentMessages.push({
        role: 'assistant',
        content: assistantMessage.content || null,
        tool_calls: toolCalls,
      });

      currentMessages.push(...toolResults);
    }

    /* Se excedeu o limite de iterações, retorna erro */
    return res.status(500).json({
      error: 'Excedido limite de iterações de ferramentas',
      details: 'O agente tentou executar muitas ações seguidas.',
    });
  } catch (error) {
    console.error('[groqChat] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: String(error.message),
    });
  }
});
