import '@nldd/design-system';
import '@nldd/design-system/styles';
import './style.css';

import pools from './data/pools.json';
import { tekenKaart } from './kaart.js';

const ORGANISATIES = ['Gemeenten', 'Provincies', 'Waterschappen', 'Rijksoverheid', 'Overheidsbreed'];
const VAKGEBIEDEN = [
  'Data',
  'AI',
  'Software',
  'Security',
  'Architectuur',
  'Beheer',
  'Informatiemanagement',
  'Projectmanagement',
];

const filters = {
  organisatie: { titel: 'Organisatie', opties: ORGANISATIES, gekozen: new Set() },
  vakgebied: { titel: 'Vakgebied', opties: VAKGEBIEDEN, gekozen: new Set() },
};
let zoekterm = '';

/** Maakt een element met attributen; een attribuut `true` wordt een leeg booleaans attribuut. */
function el(tag, attrs = {}, ...kinderen) {
  const node = document.createElement(tag);
  for (const [naam, waarde] of Object.entries(attrs)) {
    if (waarde === false || waarde == null) continue;
    node.setAttribute(naam, waarde === true ? '' : String(waarde));
  }
  node.append(...kinderen);
  return node;
}

const meervoud = (aantal) => `${aantal} ${aantal === 1 ? 'pool' : 'pools'}`;

function poolWaarden(pool, sleutel) {
  return sleutel === 'organisatie' ? [pool.organisatie] : pool.vakgebieden;
}

// Binnen een groep is elke gekozen waarde goed (of), tussen groepen moeten ze allemaal kloppen (en).
function voldoet(pool) {
  for (const [sleutel, filter] of Object.entries(filters)) {
    if (filter.gekozen.size === 0) continue;
    if (!poolWaarden(pool, sleutel).some((w) => filter.gekozen.has(w))) return false;
  }
  if (!zoekterm) return true;
  const tekst = `${pool.naam} ${pool.organisatie} ${pool.plaats}`.toLowerCase();
  return tekst.includes(zoekterm);
}

function groepeerPerPlaats(lijst) {
  const plaatsen = new Map();
  for (const pool of lijst) {
    const plaats = plaatsen.get(pool.plaats) ?? { plaats: pool.plaats, lat: pool.lat, lon: pool.lon, pools: [] };
    plaats.pools.push(pool);
    plaatsen.set(pool.plaats, plaats);
  }
  return [...plaatsen.values()];
}

// --- Filters in de zijbalk ---

function vulFilterlijst(sleutel) {
  const filter = filters[sleutel];
  const lijst = document.getElementById(`filter-${sleutel}`);
  lijst.replaceChildren(
    ...filter.opties.map((optie) => {
      const aantal = pools.filter((p) => poolWaarden(p, sleutel).includes(optie)).length;
      const rij = el(
        'nldd-list-item',
        { checkbox: true, 'data-waarde': optie },
        el('nldd-cell', {}, el('nldd-checkbox', { decorative: true })),
        el('nldd-spacer-cell', { size: 8 }),
        el('nldd-text-cell', { text: optie }),
        el('nldd-spacer-cell', { size: 8 }),
        el('nldd-text-cell', {
          width: 'fit-content',
          'horizontal-alignment': 'right',
          color: 'secondary',
          text: aantal,
        }),
      );
      rij.addEventListener('change', (event) => zetFilter(sleutel, optie, event.detail?.checked ?? rij.checked));
      return rij;
    }),
  );
}

function zetFilter(sleutel, waarde, aan) {
  const { gekozen } = filters[sleutel];
  if (aan) gekozen.add(waarde);
  else gekozen.delete(waarde);

  // De rij houdt zijn eigen staat bij, het vinkje erin niet: dat zetten we mee.
  const rij = document.querySelector(`#filter-${sleutel} [data-waarde="${CSS.escape(waarde)}"]`);
  rij.checked = aan;
  rij.querySelector('nldd-checkbox').checked = aan;
  werkBij();
}

function tekenTokens() {
  const tokens = Object.entries(filters).flatMap(([sleutel, filter]) =>
    [...filter.gekozen].map((waarde) => {
      const token = el('nldd-token', { text: `${filter.titel}: ${waarde}`, control: 'dismiss' });
      token.addEventListener('dismiss', () => zetFilter(sleutel, waarde, false));
      return token;
    }),
  );
  document.getElementById('tokens').replaceChildren(...tokens);
  document.getElementById('actieve-filters').hidden = tokens.length === 0;
}

// --- Resultaten ---

const resultaten = document.getElementById('resultaten');

function vulResultaten() {
  resultaten.append(
    ...pools.map((pool) => {
      const rij = el(
        'nldd-list-item',
        { button: true, 'data-id': pool.id },
        el('nldd-text-cell', { text: pool.naam, 'supporting-text': `${pool.organisatie} · ${pool.plaats}` }),
        el('nldd-spacer-cell', { size: 12 }),
        el('nldd-icon-cell', { size: 20, color: 'secondary', icon: 'chevron-right' }),
      );
      rij.addEventListener('click', () => toonPool(pool));
      return rij;
    }),
  );
}

let toonPlaatsen = () => {};

function werkBij() {
  const zichtbaar = pools.filter(voldoet);
  const ids = new Set(zichtbaar.map((p) => p.id));
  for (const rij of resultaten.querySelectorAll('nldd-list-item')) {
    rij.hidden = !ids.has(rij.dataset.id);
  }

  const gefilterd = zoekterm || Object.values(filters).some((f) => f.gekozen.size > 0);
  document.getElementById('aantal').textContent = gefilterd ? meervoud(zichtbaar.length) : '';

  tekenTokens();
  toonPlaatsen(groepeerPerPlaats(zichtbaar));
}

// --- Detail in een sheet ---

const sheet = document.getElementById('detail');
const detailBalk = document.getElementById('detail-balk');
const detailInhoud = document.getElementById('detail-inhoud');
let terugNaar = null;

function toonPool(pool, vanuitPlaats = null) {
  terugNaar = vanuitPlaats;
  detailBalk.setAttribute('text', pool.naam);
  detailBalk.removeAttribute('supporting-text');
  if (vanuitPlaats) detailBalk.setAttribute('back-text', vanuitPlaats.plaats);
  else detailBalk.removeAttribute('back-text');

  const kenmerken = el(
    'nldd-list',
    { 'accessible-label': 'Gegevens' },
    el('nldd-list-item', {}, el('nldd-text-cell', { overline: 'Organisatie', text: pool.organisatie })),
    el('nldd-list-item', {}, el('nldd-text-cell', { overline: 'Plaats', text: pool.plaats })),
    el(
      'nldd-list-item',
      {},
      el(
        'nldd-text-cell',
        { overline: 'Vakgebied' },
        ...pool.vakgebieden.flatMap((v, i) => (i ? [' ', el('nldd-tag', { text: v })] : [el('nldd-tag', { text: v })])),
      ),
    ),
  );

  detailInhoud.replaceChildren(
    el('nldd-rich-text', {}, el('p', {}, pool.omschrijving)),
    el('nldd-spacer', { size: 16 }),
    kenmerken,
    el('nldd-spacer', { size: 24 }),
    el('nldd-button', {
      appearance: 'primary',
      href: `mailto:${pool.contact}`,
      text: `Mail ${pool.contact}`,
    }),
  );
  sheet.open = true;
}

function toonPlaats(plaats) {
  if (plaats.pools.length === 1) {
    toonPool(plaats.pools[0]);
    return;
  }
  terugNaar = null;
  detailBalk.setAttribute('text', plaats.plaats);
  detailBalk.setAttribute('supporting-text', meervoud(plaats.pools.length));
  detailBalk.removeAttribute('back-text');

  const lijst = el(
    'nldd-list',
    { 'accessible-label': `Pools in ${plaats.plaats}` },
    ...plaats.pools.map((pool) => {
      const rij = el(
        'nldd-list-item',
        { button: true },
        el('nldd-text-cell', { text: pool.naam, 'supporting-text': pool.organisatie }),
        el('nldd-spacer-cell', { size: 12 }),
        el('nldd-icon-cell', { size: 20, color: 'secondary', icon: 'chevron-right' }),
      );
      rij.addEventListener('click', () => toonPool(pool, plaats));
      return rij;
    }),
  );
  detailInhoud.replaceChildren(lijst);
  sheet.open = true;
}

detailBalk.addEventListener('back', () => {
  if (terugNaar) toonPlaats(terugNaar);
});

// --- Opstarten ---

const sectie = document.querySelector('nldd-sidebar-section');
const openFilters = () => sectie.show();
const filterKnop = document.getElementById('filters-openen');
const filterButton = filterKnop.querySelector('nldd-button');
filterButton.addEventListener('click', openFilters);
filterKnop.querySelector('nldd-menu-item').addEventListener('select', openFilters);
sectie.addEventListener('open', () => (filterButton.expanded = true));
sectie.addEventListener('close', () => (filterButton.expanded = false));

document.getElementById('zoeken').addEventListener('input', (event) => {
  zoekterm = (event.detail?.value ?? event.target?.value ?? '').trim().toLowerCase();
  werkBij();
});

vulFilterlijst('organisatie');
vulFilterlijst('vakgebied');
vulResultaten();

const kaart = document.getElementById('kaart');
try {
  toonPlaatsen = await tekenKaart(kaart, { onKies: toonPlaats });
} catch {
  kaart.replaceChildren(
    el('nldd-inline-dialog', {
      variant: 'alert',
      text: 'De kaart kon niet worden geladen',
      'supporting-text': 'De lijst met pools hieronder is wel volledig.',
    }),
  );
}
werkBij();
