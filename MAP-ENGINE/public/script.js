const socket = io();
const tokenStorage = new Map();
const locationStorage = new Map();
const characterData = new Map(); // Global storage for Big Mongo Data

// Initialize map
const map = L.map('map', { 
    zoomControl: false,
    maxZoom: 20,
    fadeAnimation: true
}).setView([40.217, -74.759], 16);

L.DomUtil.addClass(map.getContainer(), 'parchment-container');

const baseTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri'
}).addTo(map);

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

let activeLocationId = null;
function cycleTacticalView() {
    const loc = locationStorage.get(activeLocationId);
    if (!loc || !Array.isArray(loc.data.tacticalMapUrl)) return;
    
    loc.currentIndex = (loc.currentIndex + 1) % loc.data.tacticalMapUrl.length;
    loc.overlay.setUrl(loc.data.tacticalMapUrl[loc.currentIndex]);
}

// Geospatial Ruler Tool
let isMeasuring = false;
let rulerLine = null;
let rulerLabel = null;
let startPoint = null;
let dKeyDown = false;

window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd') dKeyDown = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 'd') dKeyDown = false;
});

map.on('mousedown', (e) => {
    if (dKeyDown) {
        isMeasuring = true;
        startPoint = e.latlng;
        map.dragging.disable();
        rulerLine = L.polyline([startPoint, startPoint], {
            color: '#1a0f00', weight: 3, opacity: 0.6, className: 'ruler-line'
        }).addTo(map);
        rulerLabel = L.marker(startPoint, {
            icon: L.divIcon({ className: 'distance-label', html: '0 Yards', iconAnchor: [-10, 20] })
        }).addTo(map);
    }
});

map.on('mousemove', (e) => {
    if (isMeasuring && rulerLine) {
        const currentPoint = e.latlng;
        rulerLine.setLatLngs([startPoint, currentPoint]);
        const distanceMeters = startPoint.distanceTo(currentPoint);
        const yards = (distanceMeters * 1.09361).toFixed(0);
        const miles = (distanceMeters * 0.000621371).toFixed(2);
        rulerLabel.setLatLng(currentPoint);
        rulerLabel.setIcon(L.divIcon({
            className: 'distance-label', html: `${yards} Yards (${miles} Mi)`, iconAnchor: [-10, 20]
        }));
    }
});

map.on('mouseup', () => {
    if (isMeasuring) {
        isMeasuring = false;
        map.dragging.enable();
        if (rulerLine) map.removeLayer(rulerLine);
        if (rulerLabel) map.removeLayer(rulerLabel);
        rulerLine = null; rulerLabel = null;
    }
});

function checkProximity(latlng) {
    locationStorage.forEach((loc) => {
        const dist = latlng.distanceTo(L.latLng(loc.data.lat, loc.data.lng));
        if (dist < loc.data.radius) {
            if (map.getZoom() < 19) map.flyTo([loc.data.lat, loc.data.lng], 19, { duration: 1.5 });
        }
    });
}

map.on('zoomend', () => {
    const currentZoom = map.getZoom();
    const center = map.getCenter();
    let activeLoc = null;

    locationStorage.forEach((loc, id) => {
        const dist = center.distanceTo(L.latLng(loc.data.lat, loc.data.lng));
        if (dist < loc.data.radius * 2) activeLoc = { id, ...loc };
    });

    if (currentZoom >= 19 && activeLoc) {
        document.body.classList.add('tactical-active');
        activeLocationId = activeLoc.id;
        if (Array.isArray(activeLoc.data.tacticalMapUrl) && activeLoc.data.tacticalMapUrl.length > 1) {
            galleryControl.show();
        }
    } else {
        document.body.classList.remove('tactical-active');
        activeLocationId = null;
        galleryControl.hide();
    }
});

function getIconUrl(icon) {
    if (!icon) return '';
    if (icon.length > 20 && icon.includes('-') && !icon.startsWith('http')) {
        return `https://statsheet-cdn.b-cdn.net/images/${icon}.png`;
    }
    return icon;
}

function updateSidebarWithCharacter(char) {
    const list = document.getElementById('unit-list');
    const intel = document.getElementById('tactical-intel');
    
    // Attributes table
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

    list.innerHTML = `
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
    `;

    // Populate Flavor in Tactical Intel
    if (char.profile?.behavior) {
        intel.innerHTML = `
            <div style="padding: 10px; background: rgba(197, 160, 89, 0.1); border: 1px solid #c5a059;">
                <h4 style="margin: 0 0 10px 0; color: #c5a059;">Strategic Intel</h4>
                <p style="font-size: 0.9em; line-height: 1.4; font-style: italic;">"${char.profile.behavior}"</p>
            </div>
        `;
    }
}

async function initCampaign() {
    try {
        const [sessionRes, locationRes] = await Promise.all([
            fetch('/session'),
            fetch('/api/locations')
        ]);
        
        const sessionData = await sessionRes.json();
        const locations = await locationRes.json();
        
        // Index character data by OID correctly handling the $oid structure
        sessionData.characters.forEach(c => {
            const id = c._id?.$oid;
            if (id) characterData.set(id, c);
        });

        const list = document.getElementById('unit-list');
        const intel = document.getElementById('tactical-intel');
        list.innerHTML = "";
        intel.innerHTML = "";

        // Hydrate Locations
        locations.forEach(loc => {
            const center = L.latLng(loc.lat, loc.lng);
            const sw = map.unproject(map.project(center).subtract([loc.radius * 2, loc.radius * 2]));
            const ne = map.unproject(map.project(center).add([loc.radius * 2, loc.radius * 2]));
            const bounds = L.latLngBounds(sw, ne);
            const initialUrl = Array.isArray(loc.tacticalMapUrl) ? loc.tacticalMapUrl[0] : loc.tacticalMapUrl;

            const tacticalOverlay = L.imageOverlay(initialUrl, bounds, {
                className: 'tactical-overlay',
                zIndex: 300,
                interactive: true,
                alt: loc.title
            }).addTo(map);

            locationStorage.set(loc.id, { data: loc, overlay: tacticalOverlay, currentIndex: 0 });
            
            intel.innerHTML += `<div style="cursor:pointer; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #c5a059;" onclick="map.flyTo([${loc.lat}, ${loc.lng}], 19)">
                <b>${loc.title}</b><br>
                <small>${loc.longDescription || loc.description || 'No tactical description available.'}</small>
            </div>`;
        });

        // Hydrate Tokens
        if (sessionData.tokens) {
            sessionData.tokens.forEach(token => {
                const char = characterData.get(token.characterRef);
                if (!char) {
                    console.warn("Could not find character for token:", token.characterRef);
                    return;
                }

                const marker = L.marker([token.lat, token.lng], {
                    draggable: true,
                    zIndexOffset: 1000,
                    icon: L.icon({ 
                        iconUrl: getIconUrl(char.icon), 
                        iconSize: [50, 50], 
                        className: 'character-chip' 
                    })
                }).addTo(map);

                tokenStorage.set(token.tokenId, marker);

                marker.on('click', () => {
                    updateSidebarWithCharacter(char);
                });

                marker.on('dragend', function(e) {
                    const pos = e.target.getLatLng();
                    socket.emit('token_move', { id: token.tokenId, lat: pos.lat, lng: pos.lng });
                    checkProximity(pos);
                });
            });
        }
    } catch (e) {
        console.error("Campaign initialization failed:", e);
    }
}

socket.on('update_token', (data) => {
    const marker = tokenStorage.get(data.id);
    if (marker) marker.setLatLng([data.lat, data.lng]);
});

window.addEventListener('resize', () => map.invalidateSize());
initCampaign();