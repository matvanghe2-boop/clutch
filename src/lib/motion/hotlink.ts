/**
 * Filet de sécurité pour les images de Liquipedia. Une image demandée avec l'adresse de Clutch en
 * Referer reçoit à la place un bandeau « Sorry, hotlinking images is not allowed » de 289 × 33 px,
 * qu'un cache (celui du navigateur ou du service worker) peut ensuite resservir aux bonnes requêtes.
 * Toute image de Liquipedia qui arrive à cette taille est redemandée sans Referer, sous une adresse
 * légèrement différente (`?r=1`) pour contourner le cache empoisonné.
 */

const HOST = "liquipedia.net/commons/images/";

function isRefusal(img: HTMLImageElement): boolean {
  return img.src.includes(HOST) && img.naturalWidth === 289 && img.naturalHeight === 33;
}

function heal(img: HTMLImageElement) {
  if (img.dataset.healed) return;
  img.dataset.healed = "";
  img.referrerPolicy = "no-referrer";
  const url = new URL(img.src);
  url.searchParams.set("r", "1");
  img.src = url.toString();
}

export function watchHotlink(): () => void {
  for (const img of document.images) if (img.complete && isRefusal(img)) heal(img);
  // `load` ne remonte pas, mais se capture sur le document.
  const onLoad = (e: Event) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && isRefusal(img)) heal(img);
  };
  document.addEventListener("load", onLoad, true);
  return () => document.removeEventListener("load", onLoad, true);
}
