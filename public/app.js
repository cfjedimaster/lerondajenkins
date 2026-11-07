const CLASS_COLORS = {
  Warrior: '#C69B6D',
  Paladin: '#F48CBA',
  Hunter: '#AAD372',
  Rogue: '#FFF468',
  Priest: '#FFFFFF',
  'Death Knight': '#C41E3A',
  Shaman: '#0070DD',
  Mage: '#3FC7EB',
  Warlock: '#8788EE',
  Monk: '#00FF98',
  Druid: '#FF7C0A',
  'Demon Hunter': '#A330C9',
  Evoker: '#33937F',
};

const LEFT_SLOTS = [
  { type: 'HEAD', label: 'Head', abbr: 'HD' },
  { type: 'NECK', label: 'Neck', abbr: 'NK' },
  { type: 'SHOULDER', label: 'Shoulders', abbr: 'SH' },
  { type: 'BACK', label: 'Back', abbr: 'BK' },
  { type: 'CHEST', label: 'Chest', abbr: 'CH' },
  { type: 'SHIRT', label: 'Shirt', abbr: 'SR' },
  { type: 'TABARD', label: 'Tabard', abbr: 'TB' },
  { type: 'WRIST', label: 'Wrist', abbr: 'WR' },
];

const RIGHT_SLOTS = [
  { type: 'HANDS', label: 'Hands', abbr: 'HN' },
  { type: 'WAIST', label: 'Waist', abbr: 'WS' },
  { type: 'LEGS', label: 'Legs', abbr: 'LG' },
  { type: 'FEET', label: 'Feet', abbr: 'FT' },
  { type: 'FINGER_1', label: 'Finger 1', abbr: 'R1' },
  { type: 'FINGER_2', label: 'Finger 2', abbr: 'R2' },
  { type: 'TRINKET_1', label: 'Trinket 1', abbr: 'T1' },
  { type: 'TRINKET_2', label: 'Trinket 2', abbr: 'T2' },
];

const WEAPON_SLOTS = [
  { type: 'MAIN_HAND', label: 'Main Hand', abbr: 'MH' },
  { type: 'OFF_HAND', label: 'Off Hand', abbr: 'OH' },
];

const ALL_ENDPOINTS = [
  'profile',
  'appearance',
  'media',
  'equipment',
  'specializations',
  'mounts',
  'pets',
  'toys',
  'heirlooms',
  'transmogs',
  'professions',
  'reputations',
  'titles',
  'quests',
  'completedQuests',
];

let appState = {
  payload: null,
  activeCollection: 'mounts',
  collectionSearch: '',
  repSearch: '',
  selectedSlotItem: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRelativeTime(isoString) {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

function getItemQualityType(item) {
  const raw = item?.quality?.type || item?.quality?.name || 'COMMON';
  return String(raw).toUpperCase().replace(/\s+/g, '_');
}

function getItemLevel(item) {
  if (typeof item?.level === 'number') return item.level;
  if (typeof item?.level?.value === 'number') return item.level.value;
  if (typeof item?.item_level === 'number') return item.item_level;
  return null;
}

function formatActiveTitle(titleTemplate, charName) {
  if (!titleTemplate) return null;
  if (titleTemplate.includes('{name}')) {
    return titleTemplate.replace('{name}', charName);
  }
  if (titleTemplate.includes('%s')) {
    return titleTemplate.replace('%s', charName);
  }
  return titleTemplate;
}

async function fetchCharacterData(forceRefresh = false) {
  const query = forceRefresh ? '?refresh=1' : '';
  const urls = [`/api/character${query}`, `/.netlify/functions/character${query}`];

  let lastError = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Unexpected response from ${url} (${res.status})`);
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Unable to reach the character serverless function.');
}

function applyTheme(character) {
  const root = document.documentElement;
  const classColor = CLASS_COLORS[character?.class] || '#f0c254';
  root.style.setProperty('--class-color', classColor);

  const faction = String(character?.faction || '').toLowerCase();
  if (faction.includes('horde')) {
    root.style.setProperty('--faction-color', '#dc2626');
  } else if (faction.includes('alliance')) {
    root.style.setProperty('--faction-color', '#2563eb');
  } else {
    root.style.setProperty('--faction-color', '#eab308');
  }
}

function renderHero(payload) {
  const c = payload.character || {};
  applyTheme(c);

  document.getElementById('namespace-badge').textContent =
    payload.meta?.namespace || 'profile-forever-us';

  const avatarImg = document.getElementById('char-avatar');
  const avatarFallback = document.getElementById('char-avatar-fallback');
  const avatarUrl = c.img?.avatar || c.img?.inset || c.img?.main || c.img?.['main-raw'];

  if (avatarUrl) {
    avatarImg.src = avatarUrl;
    avatarImg.hidden = false;
    avatarFallback.hidden = true;
  } else {
    avatarImg.hidden = true;
    avatarFallback.hidden = false;
  }

  document.getElementById('char-level-pill').textContent = c.level ?? '??';
  document.getElementById('char-faction-badge').textContent = c.faction || 'Azeroth';
  document.getElementById('char-region-badge').textContent = `${(c.region || 'us').toUpperCase()} · Forever`;

  const titleEl = document.getElementById('char-title-prefix');
  const fullName =
    c.name && c.surname && !c.name.includes(c.surname)
      ? `${c.name} ${c.surname}`
      : c.name ||
        [payload.profileRaw?.name, payload.profileRaw?.surname]
          .filter(Boolean)
          .join(' ') ||
        'Leronda Jenkins';

  if (c.activeTitle) {
    titleEl.textContent = formatActiveTitle(c.activeTitle, fullName);
    titleEl.hidden = false;
  } else {
    titleEl.hidden = true;
  }

  document.getElementById('char-name').textContent = fullName;

  const parts = [
    c.level ? `Level ${c.level}` : null,
    c.gender,
    c.race,
    c.activeSpec ? `${c.activeSpec} ${c.class || ''}`.trim() : c.class,
    c.guild || payload.profileRaw?.guild?.name
      ? `<${c.guild || payload.profileRaw?.guild?.name}>`
      : null,
  ].filter(Boolean);
  document.getElementById('char-subtitle').textContent =
    parts.join(' · ') || 'Hero of Azeroth';

  document.getElementById('char-ilvl-equipped').textContent =
    c.equippedItemLevel ?? c.averageItemLevel ?? '--';
  document.getElementById('char-ilvl-avg').textContent =
    c.averageItemLevel != null ? `Average iLvl: ${c.averageItemLevel}` : 'Item Level';

  document.getElementById('char-spec').textContent = c.activeSpec || 'Adventurer';
  document.getElementById('char-class-sub').textContent = c.class || 'Unknown Class';

  document.getElementById('char-race').textContent = c.race || 'Unknown Race';
  document.getElementById('char-gender').textContent = c.gender || 'Azerothian';

  document.getElementById('char-last-login').textContent = formatRelativeTime(c.lastLogin);
  document.getElementById('char-last-login-exact').textContent = c.lastLogin
    ? new Date(c.lastLogin).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'No timestamp';
}

function getCollectionArrays(payload) {
  const mounts =
    payload.collections?.mounts?.mounts ||
    (Array.isArray(payload.collections?.mounts) ? payload.collections.mounts : []);
  const pets =
    payload.collections?.pets?.pets ||
    (Array.isArray(payload.collections?.pets) ? payload.collections.pets : []);
  const toys =
    payload.collections?.toys?.toys ||
    (Array.isArray(payload.collections?.toys) ? payload.collections.toys : []);
  const heirlooms =
    payload.collections?.heirlooms?.heirlooms ||
    (Array.isArray(payload.collections?.heirlooms) ? payload.collections.heirlooms : []);
  const transmogs =
    payload.collections?.transmogs?.slots ||
    payload.collections?.transmogs?.appearance_sets ||
    [];
  return { mounts, pets, toys, heirlooms, transmogs };
}

function renderKpis(payload) {
  const equipped = payload.equipment?.equipped_items || [];
  const { mounts, pets, toys, heirlooms } = getCollectionArrays(payload);
  const completedQuests =
    payload.quests?.completed?.quests ||
    (Array.isArray(payload.quests?.completed) ? payload.quests.completed : []);
  const titles = payload.titles?.titles || [];
  const reps = payload.reputations?.reputations || [];

  document.getElementById('kpi-gear-count').textContent = equipped.length;
  document.getElementById('kpi-mounts-count').textContent = mounts.length;
  document.getElementById('kpi-pets-count').textContent = pets.length;
  document.getElementById('kpi-toys-count').textContent = toys.length + heirlooms.length;
  document.getElementById('kpi-quests-count').textContent = completedQuests.length;
  document.getElementById('kpi-titles-count').textContent = `${titles.length} / ${reps.length}`;
}

function applyMediaViewClasses(imgEl, key) {
  const isCutout = key.includes('raw') || key === 'main';
  const isPortrait = key.includes('avatar') || key === 'inset';
  imgEl.classList.toggle('is-cutout', isCutout);
  imgEl.classList.toggle('is-portrait', isPortrait);
}

function renderMediaStage(payload) {
  const imgObj = payload.character?.img || {};
  const mainImg = document.getElementById('char-main-img');
  const noImg = document.getElementById('char-no-img');
  const switcher = document.getElementById('media-switcher');

  const labelMap = {
    'main-raw': 'Cutout Render',
    main: 'Full Scene',
    inset: 'Bust',
    avatar: 'Portrait',
    'main-sd-raw': 'SD Cutout',
    'avatar-sd': 'SD Portrait',
  };

  const preferredOrder = ['main-raw', 'main', 'inset', 'avatar', 'main-sd-raw', 'avatar-sd'];
  const views = preferredOrder
    .filter((k) => Boolean(imgObj[k]))
    .map((k) => ({ key: k, label: labelMap[k] || k }));

  Object.keys(imgObj).forEach((k) => {
    if (!views.some((v) => v.key === k) && imgObj[k]) {
      views.push({ key: k, label: labelMap[k] || k });
    }
  });

  if (views.length === 0) {
    mainImg.hidden = true;
    noImg.hidden = false;
    switcher.innerHTML = '';
    return;
  }

  mainImg.hidden = false;
  noImg.hidden = true;
  mainImg.src = imgObj[views[0].key];
  applyMediaViewClasses(mainImg, views[0].key);

  switcher.innerHTML = views
    .map(
      (v, idx) => `
      <button type="button" class="media-btn ${idx === 0 ? 'active' : ''}" data-img-key="${escapeHtml(v.key)}" data-img-url="${escapeHtml(imgObj[v.key])}">
        ${escapeHtml(v.label)}
      </button>
    `
    )
    .join('');

  switcher.querySelectorAll('.media-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      switcher.querySelectorAll('.media-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      mainImg.src = btn.dataset.imgUrl;
      applyMediaViewClasses(mainImg, btn.dataset.imgKey || '');
    });
  });
}

function buildSlotCardHtml(slotDef, item) {
  if (!item) {
    return `
      <div class="slot-card empty-slot" title="${escapeHtml(slotDef.label)}: Empty">
        <div class="slot-icon-box">${escapeHtml(slotDef.abbr)}</div>
        <div class="slot-meta">
          <span class="slot-type-label">${escapeHtml(slotDef.label)}</span>
          <span class="slot-item-name">Empty Slot</span>
        </div>
      </div>
    `;
  }

  const quality = getItemQualityType(item);
  const ilvl = getItemLevel(item);

  return `
    <button type="button" class="slot-card q-${escapeHtml(quality)}" data-slot-type="${escapeHtml(slotDef.type)}">
      <div class="slot-icon-box">
        ${escapeHtml(slotDef.abbr)}
        ${ilvl != null ? `<span class="slot-ilvl-tag">${escapeHtml(ilvl)}</span>` : ''}
      </div>
      <div class="slot-meta">
        <span class="slot-type-label">${escapeHtml(slotDef.label)}</span>
        <span class="slot-item-name">${escapeHtml(item.name || 'Unknown Item')}</span>
      </div>
    </button>
  `;
}

function renderPaperDoll(payload) {
  const equipped = payload.equipment?.equipped_items || [];
  const bySlot = new Map();
  equipped.forEach((item) => {
    const slotKey = item?.slot?.type || item?.slot?.name;
    if (slotKey) {
      bySlot.set(String(slotKey).toUpperCase().replace(/\s+/g, '_'), item);
    }
  });

  const leftEl = document.getElementById('paperdoll-left');
  const rightEl = document.getElementById('paperdoll-right');
  const weaponsEl = document.getElementById('paperdoll-weapons');

  leftEl.innerHTML = LEFT_SLOTS.map((s) => buildSlotCardHtml(s, bySlot.get(s.type))).join('');
  rightEl.innerHTML = RIGHT_SLOTS.map((s) => buildSlotCardHtml(s, bySlot.get(s.type))).join('');
  weaponsEl.innerHTML = WEAPON_SLOTS.map((s) => buildSlotCardHtml(s, bySlot.get(s.type))).join('');

  document.querySelectorAll('.slot-card[data-slot-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slotType = btn.dataset.slotType;
      const item = bySlot.get(slotType);
      if (item) {
        selectInspectorItem(item, slotType);
      }
    });
  });
}

function selectInspectorItem(item, slotType = null) {
  appState.selectedSlotItem = item;
  document.querySelectorAll('.slot-card').forEach((el) => {
    el.classList.toggle('active', Boolean(slotType && el.dataset.slotType === slotType));
  });

  const resetBtn = document.getElementById('inspector-reset');
  const bodyEl = document.getElementById('inspector-body');
  resetBtn.hidden = false;

  const quality = getItemQualityType(item);
  const ilvl = getItemLevel(item);
  const slotName = item.slot?.name || item.slot?.type || 'Equipment';
  const subclass = item.item_subclass?.name || item.item_class?.name || '';
  const binding = item.binding?.name || '';
  const armor = item.armor?.display?.display_string || (item.armor?.value ? `${item.armor.value} Armor` : '');
  const weaponDmg = item.weapon?.damage?.display_string || '';
  const weaponSpeed = item.weapon?.attack_speed?.display_string || '';
  const weaponDps = item.weapon?.dps?.display_string || '';

  const stats = item.stats || [];
  const enchantments = item.enchantments || [];
  const spells = item.spells || [];
  const transmog = item.transmog?.display_string || item.transmog?.item?.name || '';
  const durability = item.durability?.display_string || '';

  bodyEl.innerHTML = `
    <div class="wow-tooltip q-${escapeHtml(quality)}">
      <div class="tt-header">
        <h3 class="tt-name">${escapeHtml(item.name || 'Equipped Item')}</h3>
      </div>
      ${ilvl != null ? `<div class="tt-ilvl">Item Level ${escapeHtml(ilvl)}</div>` : ''}
      ${binding ? `<div class="tt-row"><span>${escapeHtml(binding)}</span></div>` : ''}
      <div class="tt-row">
        <span>${escapeHtml(slotName)}</span>
        <span>${escapeHtml(subclass)}</span>
      </div>
      ${armor ? `<div class="tt-row"><span>${escapeHtml(armor)}</span></div>` : ''}
      ${
        weaponDmg
          ? `<div class="tt-row"><span>${escapeHtml(weaponDmg)}</span><span>${escapeHtml(weaponSpeed)}</span></div>`
          : ''
      }
      ${weaponDps ? `<div class="tt-row"><span>${escapeHtml(weaponDps)}</span></div>` : ''}

      ${
        stats.length > 0
          ? `<ul class="tt-stat-list">
              ${stats
                .map((st) => {
                  const text =
                    st.display?.display_string ||
                    `+${st.value} ${st.type?.name || st.type?.type || ''}`;
                  const isEquip = Boolean(st.is_equip_bonus);
                  return `<li class="tt-stat-item ${isEquip ? 'tt-stat-equip' : ''}">${escapeHtml(text)}</li>`;
                })
                .join('')}
            </ul>`
          : ''
      }

      ${enchantments
        .map(
          (en) =>
            `<div class="tt-enchant">${escapeHtml(en.display_string || en.enchantment_slot?.type || 'Enchanted')}</div>`
        )
        .join('')}

      ${spells
        .map(
          (sp) =>
            `<div class="tt-enchant">${escapeHtml(sp.description || sp.spell?.name || '')}</div>`
        )
        .join('')}

      ${
        transmog
          ? `<div class="tt-transmog">Transmogrified to: ${escapeHtml(transmog)}</div>`
          : ''
      }
      ${durability ? `<div class="tt-durability">${escapeHtml(durability)}</div>` : ''}
    </div>
  `;
}

function renderDefaultInspector(payload) {
  appState.selectedSlotItem = null;
  document.querySelectorAll('.slot-card').forEach((el) => el.classList.remove('active'));
  const resetBtn = document.getElementById('inspector-reset');
  const bodyEl = document.getElementById('inspector-body');
  resetBtn.hidden = true;

  const c = payload.character || {};
  const p = payload.profileRaw || {};
  const equipped = payload.equipment?.equipped_items || [];

  // Aggregate primary/secondary stats across equipped gear
  const statTotals = new Map();
  equipped.forEach((item) => {
    (item.stats || []).forEach((st) => {
      const name = st.type?.name || st.type?.type;
      const val = Number(st.value);
      if (name && !Number.isNaN(val)) {
        statTotals.set(name, (statTotals.get(name) || 0) + val);
      }
    });
  });

  const statEntries = Array.from(statTotals.entries()).sort((a, b) => b[1] - a[1]);

  bodyEl.innerHTML = `
    <p style="margin:0; font-size:0.82rem; color:var(--text-muted);">
      Select any equipment slot on the Armory paper-doll to inspect item stats, enchantments, and transmogrifications.
    </p>
    <div class="overview-list">
      <div class="overview-row">
        <span>Character Name</span>
        <strong>${escapeHtml(c.name || 'Leronda Jenkins')}</strong>
      </div>
      <div class="overview-row">
        <span>Class &amp; Spec</span>
        <strong>${escapeHtml([c.activeSpec, c.class].filter(Boolean).join(' ') || 'Unknown')}</strong>
      </div>
      <div class="overview-row">
        <span>Equipped / Avg iLvl</span>
        <strong>${escapeHtml(c.equippedItemLevel ?? '--')} / ${escapeHtml(c.averageItemLevel ?? '--')}</strong>
      </div>
      ${
        c.achievementPoints != null
          ? `<div class="overview-row">
              <span>Achievement Points</span>
              <strong>${escapeHtml(c.achievementPoints.toLocaleString())}</strong>
            </div>`
          : ''
      }
      ${
        p.realm?.name
          ? `<div class="overview-row">
              <span>Realm</span>
              <strong>${escapeHtml(p.realm.name)}</strong>
            </div>`
          : ''
      }
      ${
        p.guild?.name
          ? `<div class="overview-row">
              <span>Guild</span>
              <strong>&lt;${escapeHtml(p.guild.name)}&gt;</strong>
            </div>`
          : ''
      }
      ${statEntries
        .slice(0, 6)
        .map(
          ([statName, total]) => `
          <div class="overview-row">
            <span>Gear ${escapeHtml(statName)}</span>
            <strong>+${escapeHtml(total.toLocaleString())}</strong>
          </div>
        `
        )
        .join('')}
    </div>
  `;
}

function renderEquipmentAndSpecsTab(payload) {
  const equipped = payload.equipment?.equipped_items || [];
  document.getElementById('equipment-summary-pill').textContent = `${equipped.length} items equipped`;

  const listEl = document.getElementById('equipment-list');
  if (equipped.length === 0) {
    listEl.innerHTML = `<p class="empty-note">No equipped items returned for this character.</p>`;
  } else {
    listEl.innerHTML = equipped
      .map((item, idx) => {
        const quality = getItemQualityType(item);
        const ilvl = getItemLevel(item);
        const slotName = item.slot?.name || item.slot?.type || 'Slot';
        const statSummary = (item.stats || [])
          .slice(0, 3)
          .map((s) => s.display?.display_string || `+${s.value} ${s.type?.name || ''}`)
          .join(' · ');

        return `
          <div class="gear-detail-card q-${escapeHtml(quality)}" data-gear-idx="${idx}">
            <div class="gear-card-top">
              <span>${escapeHtml(slotName)}</span>
              <span>${ilvl != null ? `iLvl ${escapeHtml(ilvl)}` : ''}</span>
            </div>
            <div class="gear-card-name">${escapeHtml(item.name || 'Unknown Item')}</div>
            <div class="gear-card-stats">${escapeHtml(statSummary || item.item_subclass?.name || '')}</div>
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('.gear-detail-card').forEach((card) => {
      card.addEventListener('click', () => {
        const item = equipped[Number(card.dataset.gearIdx)];
        if (item) {
          selectInspectorItem(item, item.slot?.type);
          document.getElementById('inspector-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  }

  // Specializations
  const specData = payload.specializations || {};
  const specs = specData.specializations || [];
  const activeSpecName =
    specData.active_specialization?.name || payload.character?.activeSpec || '';

  document.getElementById('spec-summary-pill').textContent = activeSpecName
    ? `Active: ${activeSpecName}`
    : `${specs.length} specs`;

  const specContainer = document.getElementById('specializations-content');
  if (specs.length === 0) {
    specContainer.innerHTML = `
      <div class="prof-card">
        <div class="prof-title-row">
          <span class="prof-name">${escapeHtml(activeSpecName || payload.character?.class || 'Class Specialization')}</span>
          <span class="standing-tag">Active</span>
        </div>
        <p class="empty-note" style="padding:0.25rem 0 0; margin:0;">
          Detailed specialization talent trees are minimal or unpopulated in this Forever profile snapshot.
        </p>
      </div>
    `;
    return;
  }

  specContainer.innerHTML = `<div class="stack-list">${specs
    .map((sp) => {
      const name = sp.specialization?.name || sp.name || 'Specialization';
      const isActive = name === activeSpecName;
      const talents =
        sp.talents ||
        sp.loadouts?.[0]?.selected_class_talents ||
        sp.pvp_talent_slots ||
        [];

      return `
        <div class="prof-card">
          <div class="prof-title-row">
            <span class="prof-name">${escapeHtml(name)}</span>
            ${isActive ? `<span class="standing-tag">Active Spec</span>` : ''}
          </div>
          ${
            talents.length > 0
              ? `<div style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.5rem;">
                  ${talents
                    .slice(0, 18)
                    .map((t) => {
                      const tName =
                        t.tooltip?.talent?.name ||
                        t.talent?.name ||
                        t.selected?.talent?.name ||
                        t.name;
                      return tName
                        ? `<span class="count-pill">${escapeHtml(tName)}</span>`
                        : '';
                    })
                    .join('')}
                </div>`
              : `<p class="empty-note" style="padding:0.2rem 0 0; margin:0;">No talent nodes selected.</p>`
          }
        </div>
      `;
    })
    .join('')}</div>`;
}

function renderCollectionsTab(payload) {
  const { mounts, pets, toys, heirlooms, transmogs } = getCollectionArrays(payload);

  document.getElementById('badge-mounts').textContent = mounts.length;
  document.getElementById('badge-pets').textContent = pets.length;
  document.getElementById('badge-toys').textContent = toys.length;
  document.getElementById('badge-heirlooms').textContent = heirlooms.length;
  document.getElementById('badge-transmogs').textContent = transmogs.length;

  const active = appState.activeCollection;
  const query = appState.collectionSearch.trim().toLowerCase();
  const grid = document.getElementById('collections-grid');

  let items = [];
  if (active === 'mounts') {
    items = mounts.map((m) => ({
      name: m.mount?.name || m.name || 'Mount',
      subLeft: m.mount?.id ? `ID #${m.mount.id}` : 'Mount',
      subRight: m.is_favorite ? '★ Favorite' : m.is_useable === false ? 'Unusable' : 'Collected',
      quality: 'EPIC',
    }));
  } else if (active === 'pets') {
    items = pets.map((p) => ({
      name: p.name || p.species?.name || 'Battle Pet',
      subLeft: `${p.species?.name || 'Pet'} · Lv ${p.level ?? 1}`,
      subRight: p.quality?.name || p.quality?.type || '',
      quality: String(p.quality?.type || 'RARE').toUpperCase(),
    }));
  } else if (active === 'toys') {
    items = toys.map((t) => ({
      name: t.toy?.name || t.name || 'Toy',
      subLeft: t.toy?.id ? `Toy #${t.toy.id}` : 'Toy Box',
      subRight: t.is_favorite ? '★ Favorite' : 'Unlocked',
      quality: 'RARE',
    }));
  } else if (active === 'heirlooms') {
    items = heirlooms.map((h) => ({
      name: h.heirloom?.name || h.name || 'Heirloom',
      subLeft: 'Account Heirloom',
      subRight: h.upgrade?.level != null ? `Upgrade Lv ${h.upgrade.level}` : '',
      quality: 'HEIRLOOM',
    }));
  } else if (active === 'transmogs') {
    items = transmogs.map((tr) => ({
      name: tr.slot?.name || tr.slot?.type || tr.name || 'Transmog Slot',
      subLeft: 'Wardrobe Slot',
      subRight: `${(tr.appearances || []).length} appearances`,
      quality: 'EPIC',
    }));
  }

  if (query) {
    items = items.filter(
      (it) =>
        it.name.toLowerCase().includes(query) ||
        it.subLeft.toLowerCase().includes(query)
    );
  }

  if (items.length === 0) {
    grid.innerHTML = `<p class="empty-note">No ${escapeHtml(active)} match your current view.</p>`;
    return;
  }

  grid.innerHTML = items
    .slice(0, 250)
    .map(
      (it) => `
      <div class="col-item-card q-${escapeHtml(it.quality)}">
        <div class="col-item-name">${escapeHtml(it.name)}</div>
        <div class="col-item-sub">
          <span>${escapeHtml(it.subLeft)}</span>
          <span>${escapeHtml(it.subRight)}</span>
        </div>
      </div>
    `
    )
    .join('');
}

function renderProfessionsAndRepsTab(payload) {
  const profData = payload.professions || {};
  const primaries = profData.primaries || [];
  const secondaries = profData.secondaries || [];
  const allProfs = [
    ...primaries.map((p) => ({ ...p, category: 'Primary' })),
    ...secondaries.map((p) => ({ ...p, category: 'Secondary' })),
  ];

  document.getElementById('professions-count-pill').textContent = `${allProfs.length} active`;
  const profEl = document.getElementById('professions-content');

  if (allProfs.length === 0) {
    profEl.innerHTML = `<p class="empty-note">No professions trained on this character.</p>`;
  } else {
    profEl.innerHTML = allProfs
      .map((prof) => {
        const name = prof.profession?.name || prof.name || 'Profession';
        const tiers = prof.tiers || [];
        return `
          <div class="prof-card">
            <div class="prof-title-row">
              <span class="prof-name">${escapeHtml(name)}</span>
              <span class="standing-tag">${escapeHtml(prof.category)}</span>
            </div>
            ${
              tiers.length > 0
                ? tiers
                    .map((t) => {
                      const cur = t.skill_points ?? 0;
                      const max = t.max_skill_points || 100;
                      const pct = Math.min(100, Math.round((cur / max) * 100));
                      const recipes = t.known_recipes || [];
                      return `
                        <div style="margin-top:0.55rem;">
                          <div class="rep-progress-meta">
                            <span>${escapeHtml(t.tier?.name || name)}</span>
                            <span>${escapeHtml(cur)} / ${escapeHtml(max)}</span>
                          </div>
                          <div class="progress-track">
                            <div class="progress-fill" style="width:${pct}%"></div>
                          </div>
                          ${
                            recipes.length > 0
                              ? `<div style="font-size:0.74rem; color:var(--text-muted); margin-top:0.3rem;">
                                  ${recipes.length} known recipes
                                </div>`
                              : ''
                          }
                        </div>
                      `;
                    })
                    .join('')
                : `<div class="rep-progress-meta"><span>Skill Rank</span><span>${escapeHtml(prof.skill_points ?? '--')} / ${escapeHtml(prof.max_skill_points ?? '--')}</span></div>`
            }
          </div>
        `;
      })
      .join('');
  }

  // Reputations
  renderReputationsList(payload);
}

function renderReputationsList(payload) {
  const reps = payload.reputations?.reputations || [];
  document.getElementById('reputations-count-pill').textContent = `${reps.length} factions`;

  const query = appState.repSearch.trim().toLowerCase();
  const filtered = query
    ? reps.filter((r) => {
        const fName = (r.faction?.name || '').toLowerCase();
        const sName = (r.standing?.name || '').toLowerCase();
        return fName.includes(query) || sName.includes(query);
      })
    : reps;

  const repEl = document.getElementById('reputations-content');
  if (filtered.length === 0) {
    repEl.innerHTML = `<p class="empty-note">No faction reputations found.</p>`;
    return;
  }

  repEl.innerHTML = filtered
    .map((r) => {
      const fName = r.faction?.name || 'Faction';
      const st = r.standing || {};
      const sName =
        st.name ||
        (st.renown_level != null ? `Renown ${st.renown_level}` : `Tier ${st.tier ?? 0}`);
      const val = st.value ?? st.raw ?? 0;
      const max = st.max || 1000;
      const pct = max > 0 ? Math.min(100, Math.max(4, Math.round((val / max) * 100))) : 100;

      return `
        <div class="rep-card">
          <div class="rep-title-row">
            <span class="rep-name">${escapeHtml(fName)}</span>
            <span class="standing-tag">${escapeHtml(sName)}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="rep-progress-meta">
            <span>Standing Progress</span>
            <span>${escapeHtml(val)} / ${escapeHtml(max)}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderChronicleTab(payload) {
  // Appearance
  const appData = payload.appearance || {};
  const customizations = appData.customizations || [];
  document.getElementById('appearance-count-pill').textContent = `${customizations.length} traits`;

  const appEl = document.getElementById('appearance-content');
  if (customizations.length === 0) {
    appEl.innerHTML = `<p class="empty-note">No appearance customization entries returned.</p>`;
  } else {
    appEl.innerHTML = customizations
      .map((c) => {
        const optName = c.option?.name || 'Trait';
        const choiceName =
          c.choice?.name ||
          (c.choice?.display_order != null ? `Style #${c.choice.display_order}` : 'Selected');
        return `
          <div class="trait-pill">
            <span class="trait-label">${escapeHtml(optName)}</span>
            <span class="trait-value">${escapeHtml(choiceName)}</span>
          </div>
        `;
      })
      .join('');
  }

  // Titles
  const titles = payload.titles?.titles || [];
  document.getElementById('titles-count-pill').textContent = `${titles.length} unlocked`;
  const titlesEl = document.getElementById('titles-content');

  if (titles.length === 0) {
    titlesEl.innerHTML = `<p class="empty-note">No character titles unlocked yet.</p>`;
  } else {
    const charName = payload.character?.name || 'Leronda Jenkins';
    titlesEl.innerHTML = titles
      .map((t) => {
        const formatted = formatActiveTitle(t.display_string || t.name, charName);
        return `
          <div class="title-item">
            <span>${escapeHtml(formatted || t.name || 'Title')}</span>
            <span class="count-pill">#${escapeHtml(t.id ?? '')}</span>
          </div>
        `;
      })
      .join('');
  }

  // Quests
  const inProgress = payload.quests?.log?.in_progress || [];
  const completed =
    payload.quests?.completed?.quests ||
    (Array.isArray(payload.quests?.completed) ? payload.quests.completed : []);

  document.getElementById('quests-count-pill').textContent = `${completed.length} completed`;
  const questsEl = document.getElementById('quests-content');

  const combinedHtml = [];
  combinedHtml.push(`
    <div class="overview-row">
      <span>Active Quests in Log</span>
      <strong>${escapeHtml(inProgress.length)}</strong>
    </div>
    <div class="overview-row">
      <span>Total Completed Quests</span>
      <strong>${escapeHtml(completed.length)}</strong>
    </div>
  `);

  inProgress.slice(0, 15).forEach((q) => {
    combinedHtml.push(`
      <div class="quest-item">
        <span>📜 ${escapeHtml(q.name || `Quest #${q.id}`)}</span>
        <span class="standing-tag">In Log</span>
      </div>
    `);
  });

  completed.slice(0, 35).forEach((q) => {
    combinedHtml.push(`
      <div class="quest-item">
        <span>✓ ${escapeHtml(q.name || `Completed Quest #${q.id}`)}</span>
        <span class="count-pill">#${escapeHtml(q.id ?? '')}</span>
      </div>
    `);
  });

  questsEl.innerHTML = combinedHtml.join('');
}

function renderTelemetryTab(payload) {
  const meta = payload.meta || {};
  const errors = meta.errors || {};

  document.getElementById('meta-fetched-at').textContent = meta.fetchedAt
    ? `Synced ${formatRelativeTime(meta.fetchedAt)}`
    : 'Synced';

  const gridEl = document.getElementById('telemetry-endpoints');
  gridEl.innerHTML = ALL_ENDPOINTS.map((key) => {
    const err = errors[key];
    return `
      <div class="telemetry-tile ${err ? 'fail' : 'ok'}">
        <strong>${escapeHtml(key)}</strong>
        <span class="count-pill">${escapeHtml(err || '200 OK')}</span>
      </div>
    `;
  }).join('');

  document.getElementById('raw-json-viewer').textContent = JSON.stringify(
    payload,
    null,
    2
  );
}

function renderAll(payload) {
  appState.payload = payload;
  renderHero(payload);
  renderKpis(payload);
  renderMediaStage(payload);
  renderPaperDoll(payload);
  renderDefaultInspector(payload);
  renderEquipmentAndSpecsTab(payload);
  renderCollectionsTab(payload);
  renderProfessionsAndRepsTab(payload);
  renderChronicleTab(payload);
  renderTelemetryTab(payload);
}

async function initApp(forceRefresh = false) {
  const loadingEl = document.getElementById('loading-state');
  const errorEl = document.getElementById('error-state');
  const contentEl = document.getElementById('profile-content');

  loadingEl.hidden = false;
  errorEl.hidden = true;
  if (!appState.payload) {
    contentEl.hidden = true;
  }

  try {
    const data = await fetchCharacterData(forceRefresh);
    loadingEl.hidden = true;
    errorEl.hidden = true;
    contentEl.hidden = false;
    renderAll(data);
  } catch (err) {
    loadingEl.hidden = true;
    contentEl.hidden = true;
    errorEl.hidden = false;
    document.getElementById('error-message').textContent =
      err.message || 'Could not load character profile from Battle.net.';
  }
}

// Event Listeners Setup
document.addEventListener('DOMContentLoaded', () => {
  // Primary section tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((b) => {
        const active = b.dataset.tab === targetTab;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        const match = panel.id === `panel-${targetTab}`;
        panel.classList.toggle('active', match);
        panel.hidden = !match;
      });
    });
  });

  // Collection sub-tabs
  document.querySelectorAll('.subtab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.activeCollection = btn.dataset.col;
      document.querySelectorAll('.subtab-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      if (appState.payload) renderCollectionsTab(appState.payload);
    });
  });

  // Collection live search
  document.getElementById('collection-search').addEventListener('input', (e) => {
    appState.collectionSearch = e.target.value;
    if (appState.payload) renderCollectionsTab(appState.payload);
  });

  // Reputation live search
  document.getElementById('rep-search').addEventListener('input', (e) => {
    appState.repSearch = e.target.value;
    if (appState.payload) renderReputationsList(appState.payload);
  });

  // Inspector reset button
  document.getElementById('inspector-reset').addEventListener('click', () => {
    if (appState.payload) renderDefaultInspector(appState.payload);
  });

  // Refresh & Retry buttons
  document.getElementById('refresh-btn').addEventListener('click', () => initApp(true));
  document.getElementById('retry-btn').addEventListener('click', () => initApp(true));

  initApp(false);
});
