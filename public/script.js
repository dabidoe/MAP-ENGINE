const socket = io();
const locationStorage = new Map();
const characterData = new Map();
let currentTokens = [];
let activeLocationId = null;

// Initialize map
const map = L.map('map', { 
    zoomControl: false,
    maxZoom: 20,
    fadeAnimation: true
}).setView([40.217, -74.759], 16);

L.DomUtil.addClass(map.getContainer(), 'parchment-container');

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri'
}).addTo(map);

// UI Elements
const sidebar = document.getElementById('sidebar');
const unitList = document.getElementById('unit-list');
const tacticalIntel = document.getElementById('tactical-intel');

// Tactical View Overlay System
const tacticalContainer = document.createElement('div');
tacticalContainer.className = 'tactical-map-container';
document.getElementById('map').appendChild(tacticalContainer);

const tacticalImg = document.createElement('img');
tacticalImg.className = 'tactical-map-img';
tacticalContainer.appendChild(tacticalImg);

const tokenPlane = document.createElement('div');
tokenPlane.style.position = 'absolute';
tokenPlane.style.top = '0';
tokenPlane.style.left = '0';
tokenPlane.style.width = '100%';
tokenPlane.style.height = '100%';
tacticalContainer.appendChild(tokenPlane);

// World Map Layer Group for Markers
const worldMarkers = L.layerGroup().addTo(map);

// Back to World Map Button
const backButton = document.createElement('button');
backButton.innerHTML = '← Back to World Map';
backButton.className = 'cycle-button';
backButton.style.position = 'absolute';
backButton.style.bottom = '20px';
backButton.style.left = '320px';
backButton.style.display = 'none';
backButton.onclick = exitTacticalView;
document.body.appendChild(backButton);

// Gallery Switcher Control
const GalleryControl = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function() {
        const btn = L.DomUtil.create('button', 'cycle-button');
        btn.innerHTML = 'Cycle View';
        btn.style.display = 'none';
        btn.onclick = (e) => {
            L.DomEvent.stopPropagation(e);
            cycleTacticalView();
        };
        this._btn = btn;
        return btn;
    },
    show: function() { this._btn.style.display = 'block'; },
    hide: function() { this._btn.style.display = 'none'; }
});
const galleryControl = new GalleryControl();
map.addControl(galleryControl);

function cycleTacticalView() {
    const loc = locationStorage.get(activeLocationId);
    if (!loc || !Array.isArray(loc.data.tacticalMapUrl)) return;
    loc.currentIndex = (loc.currentIndex + 1) % loc.data.tacticalMapUrl.length;
    tacticalImg.src = loc.data.tacticalMapUrl[loc.currentIndex];
}

function exitTacticalView() {
    document.body.classList.remove('tactical-active');
    activeLocationId = null;
    galleryControl.hide();
    backButton.style.display = 'none';
    map.dragging.enable();
    map.scrollWheelZoom.enable();
    renderWorldMarkers();
    renderWorldSidebar();
}

function updateSidebarWithCharacter(char) {
    const attrs = char.attributes || {};
    const attrHtml = `
        <table style="width: 100%; font-size: 0.8em; margin-top: 10px; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #444;">
                <th>STR</th><th>DEX</th><th>CON</th><th>INT</th><th>WIS</th><th>CHA</th>
            </tr>
            <tr style="text-align: center;">
                <td>${attrs.str||0}</td><td>${attrs.dex||0}</td><td>${attrs.con||0}</td>
                <td>${attrs.int||0}</td><td>${attrs.wis||0}</td><td>${attrs.cha||0}</td>
            </tr>
        </table>
    `;

    const traitsHtml = (char.passiveTraits || []).map(t => 
        `<li><b>${t.name}:</b> ${t.summary || t.description}</li>`
    ).join('');

    unitList.innerHTML = `
        <div class="character-card" style="padding: 15px; border: 1px solid #c5a059; background: rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <b style="font-size: 1.2em;">${char.name}</b>
                <span style="color: #c5a059;">Level ${char.level} ${char.class}</span>
            </div>
            <div style="margin: 10px 0; font-size: 0.9em; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px;">
                <span>HP: ${char.hp?.current||0}/${char.hp?.max||0}</span>
                <span>AC: ${char.ac||0}</span>
                <span style="color: #4CAF50;">${char.state||'Normal'}</span>
            </div>
            ${attrHtml}
            <details style="margin-top: 15px;">
                <summary style="cursor: pointer; color: #c5a059; font-size: 0.8em; outline: none;">Passives & Traits</summary>
                <ul style="padding-left: 15px; margin-top: 5px; font-size: 0.8em; list-style-type: none;">
                    ${traitsHtml || '<li>None</li>'}
                </ul>
            </details>
        </div>
        <button class="cycle-button" style="width:100%; margin-top:10px;" onclick="activeLocationId ? renderTacticalSidebar() : renderWorldSidebar()">Back</button>
    `;
}

function renderTacticalSidebar() {
    const loc = locationStorage.get(activeLocationId);
    if (!loc) return;

    unitList.innerHTML = `<h3>Tactical Units</h3>`;
    tacticalIntel.innerHTML = `
        <div style="padding: 10px; background: rgba(197, 160, 89, 0.1); border: 1px solid #c5a059;">
            <h4 style="margin: 0 0 10px 0; color: #c5a059;">Strategic Intel</h4>
            <p style="font-size: 0.9em; line-height: 1.4;">${loc.data.longDescription || loc.data.description}</p>
        </div>
    `;

    currentTokens.forEach(token => {
        if (token.locationId !== activeLocationId) return;
        const char = characterData.get(token.characterRef);
        if (!char) return;

        unitList.innerHTML += `
            <div class="character-card" style="margin-bottom: 10px; padding: 10px; border: 1px solid #c5a059; background: rgba(0,0,0,0.3); cursor: pointer;" onclick="window.updateSidebarWithCharacterById('${token.characterRef}')">
                <div style="display: flex; justify-content: space-between;">
                    <b>${char.name}</b>
                    <small>${char.class}</small>
                </div>
                <div style="font-size: 0.8em; color: #c5a059;">Status: ${token.status || 'Active'}</div>
            </div>
        `;
    });
}

window.updateSidebarWithCharacterById = (id) => {
    const char = characterData.get(id);
    if (char) updateSidebarWithCharacter(char);
};

function renderWorldSidebar() {
    unitList.innerHTML = `<h3>Campaign Units</h3>`;
    characterData.forEach(char => {
        unitList.innerHTML += `<p style="cursor:pointer;" onclick="window.updateSidebarWithCharacterById('${char._id?.$oid || char.characterId}')"><b>${char.name}</b><br><small>Level ${char.level} ${char.class}</small></p>`;
    });

    tacticalIntel.innerHTML = `<h3>Locations</h3>`;
    locationStorage.forEach((loc, id) => {
        tacticalIntel.innerHTML += `
            <div style="cursor:pointer; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #c5a059;" onclick="map.flyTo([${loc.data.lat}, ${loc.data.lng}], 19)">
                <b>${loc.data.title}</b><br>
                <small>${loc.data.description || 'Tactical point available.'}</small>
            </div>`;
    });
}

function renderWorldMarkers() {
    worldMarkers.clearLayers();
    
    // Add Location Pins
    locationStorage.forEach((loc) => {
        L.marker([loc.data.lat, loc.data.lng], {
            icon: L.divIcon({
                className: 'location-pin',
                html: `<div style="background:#c5a059; border:2px solid #000; width:12px; height:12px; border-radius:50%;"></div>`,
                iconSize: [12, 12]
            })
        }).addTo(worldMarkers).on('click', () => {
            map.flyTo([loc.data.lat, loc.data.lng], 19);
        });
    });

    // Add World Map Character Tokens
    currentTokens.forEach(token => {
        const char = characterData.get(token.characterRef);
        if (!char || !token.lat || !token.lng) return;
        
        L.marker([token.lat, token.lng], {
            icon: L.icon({
                iconUrl: char.icon,
                iconSize: [40, 40],
                className: 'character-chip'
            })
        }).addTo(worldMarkers).on('click', () => updateSidebarWithCharacter(char));
    });
}

function renderTacticalTokens() {
    tokenPlane.innerHTML = '';
    currentTokens.forEach(token => {
        if (token.locationId !== activeLocationId) return;
        const char = characterData.get(token.characterRef);
        if (!char) return;

        const tokenEl = document.createElement('div');
        tokenEl.className = 'tactical-token';
        tokenEl.style.left = `${token.posX}%`;
        tokenEl.style.top = `${token.posY}%`;
        
        const img = document.createElement('img');
        img.src = char.icon;
        tokenEl.appendChild(img);

        tokenEl.onclick = () => updateSidebarWithCharacter(char);
        tokenPlane.appendChild(tokenEl);
    });
}

map.on('zoomend', () => {
    if (activeLocationId) return;

    const currentZoom = map.getZoom();
    const center = map.getCenter();
    let nearestLoc = null;
    let minDist = Infinity;

    locationStorage.forEach((loc, id) => {
        const dist = center.distanceTo(L.latLng(loc.data.lat, loc.data.lng));
        if (dist < loc.data.radius * 2 && dist < minDist) {
            minDist = dist;
            nearestLoc = { id, ...loc };
        }
    });

    if (currentZoom >= 19 && nearestLoc) {
        enterTacticalView(nearestLoc);
    }
});

function enterTacticalView(loc) {
    document.body.classList.add('tactical-active');
    activeLocationId = loc.id;
    tacticalImg.src = Array.isArray(loc.data.tacticalMapUrl) ? loc.data.tacticalMapUrl[0] : loc.data.tacticalMapUrl;
    backButton.style.display = 'block';
    map.dragging.disable();
    map.scrollWheelZoom.disable();
    worldMarkers.clearLayers();
    
    if (Array.isArray(loc.data.tacticalMapUrl) && loc.data.tacticalMapUrl.length > 1) {
        galleryControl.show();
    }
    
    renderTacticalSidebar();
    renderTacticalTokens();
}

async function initCampaign() {
    try {
        const [sessionRes, locationRes] = await Promise.all([
            fetch('/session'),
            fetch('/api/locations')
        ]);
        
        const sessionData = await sessionRes.json();
        const locations = await locationRes.json();
        currentTokens = sessionData.tokens;
        
        sessionData.characters.forEach(c => {
            const id = c._id?.$oid || c.characterId;
            if (id) characterData.set(id, c);
        });

        locations.forEach(loc => {
            locationStorage.set(loc.id, { data: loc, currentIndex: 0 });
        });

        renderWorldMarkers();
        renderWorldSidebar();
    } catch (e) {
        console.error("Campaign initialization failed:", e);
    }
}

initCampaign();