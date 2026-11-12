/**
 * Clé publique des notifications (VAPID). Publique par nature : le navigateur la reçoit pour
 * s'abonner. La clé privée qui va avec est la variable VAPID_PRIVATE_KEY (Vercel, .env.local).
 */
export const VAPID_PUBLIC_KEY = "BLE8qSKC8pM_QooLQdL9r8BNziyIFfnzzdtoslwM6bmDGuaGsMjJtxfzlUCMyPdrZfuc17gFM9-I-einpWV1fJk";

/** Le contact que les services de notification (Google, Apple, Mozilla) peuvent joindre en cas d'abus. */
export const VAPID_SUBJECT = "https://clutch-ochre.vercel.app";
