import { geoIdentity, geoPath } from 'd3-geo';

const BREEDTE = 600;
const HOOGTE = 700;
const MARGE = 12;

// Een vlakke projectie met de lengtegraad gekrompen tot de breedte op 52°N:
// voor een land zo klein als Nederland is dat niet van Mercator te
// onderscheiden, en een vlakke projectie is ongevoelig voor de draairichting
// van de polygonen in de GeoJSON, waar d3's bolprojecties over struikelen.
const LENGTE_FACTOR = Math.cos((52.2 * Math.PI) / 180);

const naarVlak = ([lon, lat]) => [lon * LENGTE_FACTOR, lat];

function maakVlak(geometry) {
  const ringen = (polygon) => polygon.map((ring) => ring.map(naarVlak));
  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: ringen(geometry.coordinates) };
  }
  return { ...geometry, coordinates: geometry.coordinates.map(ringen) };
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [naam, waarde] of Object.entries(attrs)) node.setAttribute(naam, waarde);
  return node;
}

/**
 * Tekent de provincies in `container` en geeft een functie terug die de
 * markers toont voor een lijst plaatsen ({ plaats, lat, lon, pools }).
 */
export async function tekenKaart(container, { onKies }) {
  const antwoord = await fetch('/provincies.geojson');
  if (!antwoord.ok) throw new Error(`Kaart niet geladen (${antwoord.status})`);
  const geo = await antwoord.json();
  const vlak = {
    ...geo,
    features: geo.features.map((f) => ({ ...f, geometry: maakVlak(f.geometry) })),
  };

  const projectie = geoIdentity()
    .reflectY(true)
    .fitExtent([[MARGE, MARGE], [BREEDTE - MARGE, HOOGTE - MARGE]], vlak);
  const pad = geoPath(projectie);

  const kaart = svg('svg', {
    viewBox: `0 0 ${BREEDTE} ${HOOGTE}`,
    class: 'kaart__provincies',
    'aria-hidden': 'true',
  });
  for (const feature of vlak.features) {
    kaart.append(svg('path', { d: pad(feature) }));
  }

  const markers = document.createElement('div');
  markers.className = 'kaart__markers';
  container.replaceChildren(kaart, markers);

  return function toonPlaatsen(plaatsen) {
    markers.replaceChildren(
      ...plaatsen.map((plaats) => {
        const [x, y] = projectie(naarVlak([plaats.lon, plaats.lat]));
        const aantal = plaats.pools.length;
        const knop = document.createElement('button');
        knop.type = 'button';
        knop.className = 'kaart__marker';
        knop.style.left = `${(x / BREEDTE) * 100}%`;
        knop.style.top = `${(y / HOOGTE) * 100}%`;
        knop.setAttribute(
          'aria-label',
          `${plaats.plaats}, ${aantal} ${aantal === 1 ? 'pool' : 'pools'}`,
        );
        const pin = document.createElement('nldd-icon');
        pin.setAttribute('icon', 'map-pin');
        pin.setAttribute('size', '32');
        pin.setAttribute('color', 'accent');
        knop.append(pin);
        if (aantal > 1) {
          const badge = document.createElement('nldd-badge');
          badge.setAttribute('number', String(aantal));
          badge.setAttribute('color', 'accent');
          badge.setAttribute('size', 'sm');
          badge.setAttribute('decorative', '');
          knop.append(badge);
        }
        knop.addEventListener('click', () => onKies(plaats));
        return knop;
      }),
    );
  };
}
