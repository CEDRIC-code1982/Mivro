/**
 * @file index.js
 * @description Cloud Functions Mivro.
 *
 *              purgeExpiredSessions — purge RGPD planifiée des sessions
 *              partagées (F5) dont l'expiration (`meta.expiresAt`) est
 *              dépassée. Complète la suppression best-effort côté client
 *              (le propriétaire supprime sa session au reset) : ici on
 *              garantit qu'AUCUNE session n'est conservée au-delà de son
 *              expiration, même si le client n'a jamais appelé delete
 *              (app tuée, lien jamais rouvert, etc.).
 *
 *              RGPD : « Position Firebase supprimée à la fin de chaque
 *              session » + liens expirables 24h guest / 7j compte.
 *
 *              ⚠️ Cloud Scheduler nécessite le plan Blaze (pay-as-you-go).
 *              La région DOIT correspondre à l'instance RTDB (europe-west1).
 */

const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { logger } = require('firebase-functions/v2');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const DATABASE_URL = 'https://mivro-40125-default-rtdb.europe-west1.firebasedatabase.app';

initializeApp({ databaseURL: DATABASE_URL });

/**
 * Purge les sessions expirées toutes les heures.
 *
 * Lit `sessions`, supprime en un seul `update()` (écritures atomiques
 * par clé) tout nœud dont `meta.expiresAt <= now`. Les nœuds sans
 * `meta.expiresAt` (forme inattendue) sont laissés intacts et signalés.
 */
exports.purgeExpiredSessions = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
  },
  async () => {
    const db = getDatabase();
    const now = Date.now();

    const snapshot = await db.ref('sessions').once('value');
    const sessions = snapshot.val();

    if (!sessions) {
      logger.info('[purgeExpiredSessions] no sessions to scan');
      return;
    }

    const removals = {};
    let expired = 0;
    let malformed = 0;

    for (const [sessionId, session] of Object.entries(sessions)) {
      const expiresAt = session && session.meta && session.meta.expiresAt;
      if (typeof expiresAt !== 'number') {
        malformed += 1;
        continue;
      }
      if (expiresAt <= now) {
        // Supprime le nœud entier : meta + members + participants (positions live F4).
        removals[sessionId] = null;
        expired += 1;
      }
    }

    if (expired > 0) {
      await db.ref('sessions').update(removals);
    }

    logger.info(
      `[purgeExpiredSessions] scanned ${Object.keys(sessions).length} session(s), ` +
        `removed ${expired} expired, ${malformed} without meta.expiresAt`,
    );
  },
);
