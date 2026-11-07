let cached = { token: null, expires: 0 };
let cachedChar = { data: null, expires: 0 };

const CHARACTER_NAME = 'Leronda Jenkins';
const CHAR_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const CLIENT_ID =
  (typeof Netlify !== 'undefined' && Netlify?.env?.get?.('CLIENT_ID')) ||
  process.env.CLIENT_ID;
const CLIENT_SECRET =
  (typeof Netlify !== 'undefined' && Netlify?.env?.get?.('CLIENT_SECRET')) ||
  process.env.CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error(
    'Missing required CLIENT_ID and/or CLIENT_SECRET environment variables.'
  );
}

async function getToken() {
  if (cached.token && Date.now() < cached.expires - 60_000) {
    return cached.token;
  }

  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const res = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  cached = {
    token: data.access_token,
    expires: Date.now() + data.expires_in * 1000,
  };
  return cached.token;
}

// "Leronda Jenkins" -> "leronda-jenkins"
function toSlug(name) {
  const parts = String(name).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length !== 2) {
    throw new Error(`Expected "FIRST LAST", got "${name}"`);
  }
  return parts.join('-');
}

// Remove Blizzard's _links noise to keep the output clean
function stripLinks(value) {
  if (Array.isArray(value)) return value.map(stripLinks);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== '_links')
        .map(([k, v]) => [k, stripLinks(v)])
    );
  }
  return value;
}

// key -> path suffix (appended to /profile/wow/character/{slug})
const ENDPOINTS = {
  profile: '',
  appearance: '/appearance',
  media: '/character-media',
  equipment: '/equipment',
  specializations: '/specializations',
  mounts: '/collections/mounts',
  pets: '/collections/pets',
  toys: '/collections/toys',
  heirlooms: '/collections/heirlooms',
  transmogs: '/collections/transmogs',
  professions: '/professions',
  reputations: '/reputations',
  titles: '/titles',
  quests: '/quests',
  completedQuests: '/quests/completed',
};

const REGION = 'us';
const NAMESPACE = `profile-forever-${REGION}`;
const LOCALE = 'en_US';
const API_BASE = `https://${REGION}.api.blizzard.com`;

async function fetchSection(slug, path, token) {
  const url =
    `${API_BASE}/profile/wow/character/${encodeURIComponent(slug)}${path}` +
    `?namespace=${NAMESPACE}&locale=${LOCALE}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return stripLinks(await res.json());
}

export async function getForeverCharacter(name) {
  const slug = toSlug(name);
  const token = await getToken();

  const keys = Object.keys(ENDPOINTS);
  const settled = await Promise.allSettled(
    keys.map((k) => fetchSection(slug, ENDPOINTS[k], token))
  );

  const data = {};
  const errors = {};
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') data[keys[i]] = r.value;
    else errors[keys[i]] = r.reason.message;
  });

  // Forever endpoints are undocumented, so field names are read defensively.
  const p = data.profile ?? {};

  // make an img ob
  const img = Object.fromEntries(
    (data.media?.assets ?? []).map((a) => [a.key, a.value])
  );

  const fullName =
    p.name_search ||
    [p.name, p.surname].filter(Boolean).join(' ') ||
    name;

  return {
    character: {
      img,
      name: fullName,
      firstName: p.name ?? null,
      surname: p.surname ?? null,
      slug,
      region: REGION,
      level: p.level ?? null,
      race: p.race?.name ?? null,
      class: p.character_class?.name ?? null,
      activeSpec: p.active_spec?.name ?? null,
      faction: p.faction?.name ?? null,
      guild: p.guild?.name ?? null,
      gender: p.gender?.name ?? null,
      averageItemLevel: p.average_item_level ?? null,
      equippedItemLevel: p.equipped_item_level ?? null,
      achievementPoints: p.achievement_points ?? null,
      activeTitle: p.active_title?.display_string ?? p.active_title?.name ?? data.titles?.active_title?.display_string ?? data.titles?.active_title?.name ?? null,
      lastLogin: p.last_login_timestamp
        ? new Date(p.last_login_timestamp).toISOString()
        : null,
    },
    profileRaw: p,
    appearance: data.appearance ?? null,
    media: data.media ?? null,
    equipment: data.equipment ?? null,
    specializations: data.specializations ?? null,
    collections: {
      mounts: data.mounts ?? null,
      pets: data.pets ?? null,
      toys: data.toys ?? null,
      heirlooms: data.heirlooms ?? null,
      transmogs: data.transmogs ?? null,
    },
    professions: data.professions ?? null,
    reputations: data.reputations ?? null,
    titles: data.titles ?? null,
    quests: {
      log: data.quests ?? null,
      completed: data.completedQuests ?? null,
    },
    meta: {
      namespace: NAMESPACE,
      fetchedAt: new Date().toISOString(),
      callsMade: keys.length,
      callsFailed: Object.keys(errors).length,
      errors,
    },
  };
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === '1';

    if (
      !forceRefresh &&
      cachedChar.data &&
      Date.now() < cachedChar.expires
    ) {
      return Response.json(cachedChar.data, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300',
          'X-Cache': 'HIT',
        },
      });
    }

    const data = await getForeverCharacter(CHARACTER_NAME);
    cachedChar = {
      data,
      expires: Date.now() + CHAR_CACHE_TTL_MS,
    };

    return Response.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    console.error('Error fetching Forever character:', err);
    return Response.json(
      {
        error: err.message || 'Failed to fetch character profile.',
      },
      { status: 500 }
    );
  }
};

export const config = {
  path: '/api/character',
};
