#!/usr/bin/env node

/*
  Migration: campanhas + backfill campaignId

  Usage example (PowerShell):
    $env:FIREBASE_PROJECT_ID="helo-confeitaria"
    $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\keys\\service-account.json"
    node scripts/migrate-campaigns.js
*/

const admin = require('firebase-admin');

const CAMPAIGN_LEGACY_ID = 'evento_id';
const CAMPAIGN_GENERAL_ID = 'dia_a_dia';

function getAppRoot(db) {
  return db
    .collection('artifacts')
    .doc('helo-confeitaria')
    .collection('public')
    .doc('data');
}

function getCol(db, name) {
  return getAppRoot(db).collection(name);
}

async function commitUpdatesInChunks(updates, chunkSize = 400) {
  let committed = 0;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const batch = admin.firestore().batch();
    chunk.forEach((entry) => batch.update(entry.ref, entry.payload));
    await batch.commit();
    committed += chunk.length;
  }
  return committed;
}

async function run() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required.');
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'helo-confeitaria',
    });
  }

  const db = admin.firestore();
  const appRoot = getAppRoot(db);
  const migrationRef = appRoot.collection('meta').doc('campaigns_migration_v1');
  const migrationSnap = await migrationRef.get();

  if (migrationSnap.exists && migrationSnap.data()?.done === true) {
    console.log('[migrate-campaigns] already migrated. Nothing to do.');
    return;
  }

  await getCol(db, 'campanhas').doc(CAMPAIGN_GENERAL_ID).set({
    nome: 'Dia a Dia',
    status: 'ativo',
    data_criacao: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await getCol(db, 'campanhas').doc(CAMPAIGN_LEGACY_ID).set({
    nome: 'Evento Anterior',
    status: 'inativo',
    data_criacao: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const [ordersSnap, productsSnap, financeSnap] = await Promise.all([
    getCol(db, 'orders').get(),
    getCol(db, 'products').get(),
    getCol(db, 'financeiro').get(),
  ]);

  const pending = [];

  ordersSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    if (typeof data.campaignId === 'string' && data.campaignId.trim()) return;
    pending.push({ ref: docSnap.ref, payload: { campaignId: CAMPAIGN_LEGACY_ID } });
  });

  productsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    if (typeof data.campaignId === 'string' && data.campaignId.trim()) return;
    pending.push({ ref: docSnap.ref, payload: { campaignId: CAMPAIGN_LEGACY_ID } });
  });

  financeSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    if (typeof data.campaignId === 'string' && data.campaignId.trim()) return;
    pending.push({ ref: docSnap.ref, payload: { campaignId: CAMPAIGN_LEGACY_ID } });
  });

  const committed = await commitUpdatesInChunks(pending);

  await migrationRef.set({
    done: true,
    version: 1,
    updatedItems: committed,
    doneAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`[migrate-campaigns] done. updated=${committed}`);
}

run().catch((error) => {
  console.error('[migrate-campaigns] failed:', error.message || error);
  process.exit(1);
});
