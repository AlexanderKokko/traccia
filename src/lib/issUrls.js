// Deep links to ISSalute (Istituto Superiore di Sanità) — public, non-diagnostic
// reference pages. Conditions with more than one relevant page map card index → URL.
const ISS_URLS = {
  endometriosi: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/e/endometriosi',
  ibd: {
    0: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/m/mici-malattie-infiammatorie-croniche-dell-intestino',
    1: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/m/malattia-di-crohn',
  },
  emicrania: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/e/emicrania',
  diabete: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/d/diabete-di-tipo-2',
  pcos: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/o/ovaio-policistico',
  ipertiroidismo:
    'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/i/ipertiroidismo',
  ipotiroidismo: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/i/ipotiroidismo',
  fibromialgia: 'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/f/fibromialgia',
  artrite_reumatoide:
    'https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/a/artrite-reumatoide',
}

export function getIssUrl(conditionKey, cardIndex = 0) {
  const entry = ISS_URLS[conditionKey]
  if (!entry) return null
  return typeof entry === 'string' ? entry : entry[cardIndex] || entry[0]
}
