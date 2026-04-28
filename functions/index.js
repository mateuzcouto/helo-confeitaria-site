const crypto = require('node:crypto');
const admin = require('firebase-admin');
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');

admin.initializeApp();

const db = admin.firestore();

function getPublicDataRoot() {
  return db.collection('artifacts').doc('helo-confeitaria')
    .collection('public').doc('data');
}

function getProductsCollection() {
  return getPublicDataRoot().collection('products');
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
