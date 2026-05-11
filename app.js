// 1. ตั้งค่าแผนที่และ Panes เพื่อเรียงลำดับชั้นข้อมูล
const map = L.map('map', { zoomControl: false }).setView([13.7563, 100.5018], 11);
L.control.zoom({ position: 'topright' }).addTo(map);

// สร้าง Panes (Z-Index): Landuse ล่างสุด -> User Top สุด
map.createPane('pane_landuse'); map.getPane('pane_landuse').style.zIndex = 200;
map.createPane('pane_buffer'); map.getPane('pane_buffer').style.zIndex = 300;
map.createPane('pane_markers'); map.getPane('pane_markers').style.zIndex = 600;
map.createPane('pane_user'); map.getPane('pane_user').style.zIndex = 700;

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

const layers = {
    landuse: L.layerGroup().addTo(map),
    stations: L.layerGroup().addTo(map),
    schools: L.layerGroup().addTo(map),
    buffer: L.layerGroup().addTo(map),
    lines: L.layerGroup().addTo(map),
    userLocation: L.layerGroup().addTo(map)
};

let rawData = { stations: null, landuse: null, schools: null };
let stats = { stations: 0, schools: 0 };

// 2. ฟังก์ชันย้อมสีและอัปเดตสถิติ
function getLUColor(code) {
    const colors = { 'R': '#ffff00', 'C': '#e60000', 'A': '#99e600', 'U': '#004da8', 'I': '#92008d' };
    return colors[code] || '#e1e1e1';
}

function updateTotalStats() {
    document.getElementById('total-points').innerText = (stats.stations + stats.schools).toLocaleString();
    document.getElementById('count-stations').innerText = stats.stations;
    document.getElementById('count-schools').innerText = stats.schools;
}

// 3. ฟังก์ชันสุ่มตำแหน่งปัจจุบัน
function simulateLocation() {
    layers.userLocation.clearLayers();
    // สุ่มพิกัดในเขตกรุงเทพฯ
    const lat = 13.65 + Math.random() * (13.90 - 13.65);
    const lng = 100.35 + Math.random() * (100.70 - 100.35);
    
    const marker = L.circleMarker([lat, lng], {
        pane: 'pane_user', radius: 8, fillColor: "#00b894", color: "#fff", weight: 3, fillOpacity: 1
    }).addTo(layers.userLocation);
    
    marker.bindPopup("<b>ตำแหน่งปัจจุบันของคุณ (จำลอง)</b>").openPopup();
    map.setView([lat, lng], 14);
}

// 4. ฟังก์ชัน Filter, Search และ Zoom
function filterLandUse() {
    const filter = document.getElementById('filter-lu').value;
    layers.landuse.clearLayers();
    L.geoJSON(rawData.landuse, {
        pane: 'pane_landuse',
        filter: f => filter === 'all' || f.properties.LUL1_CODE === filter,
        style: f => ({ fillColor: getLUColor(f.properties.LUL1_CODE), weight: 0.5, color: '#fff', fillOpacity: 0.5 }),
        onEachFeature: (f, l) => {
            l.bindPopup(`<div class="custom-popup"><h6>${f.properties.LU_DES_TH}</h6>พื้นที่: ${f.properties.Area_Rai} ไร่</div>`);
            l.on('click', e => map.fitBounds(e.target.getBounds()));
        }
    }).addTo(layers.landuse);
}

function searchLocation() {
    const query = document.getElementById('search-input').value.toLowerCase();
    let found = false;
    [layers.stations, layers.schools].forEach(group => {
        group.eachLayer(l => {
            const name = l.feature.properties.name || l.feature.properties.CUL_PNAME || "";
            if (name.toLowerCase().includes(query) && !found) {
                map.setView(l.getLatLng(), 15);
                l.openPopup();
                found = true;
            }
        });
    });
}

// 5. โหลดข้อมูล (WGS84)
async function init() {
    try {
        const resSta = await fetch('data/mrt_station.geojson');
        rawData.stations = await resSta.json();
        stats.stations = rawData.stations.features.length;
        L.geoJSON(rawData.stations, {
            pane: 'pane_markers',
            pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 6, fillColor: "#4361ee", color: "#fff", weight: 2, fillOpacity: 1 }),
            onEachFeature: (f, l) => {
                l.bindPopup(`<b>สถานี:</b> ${f.properties.name}`);
                l.on('click', e => map.setView(e.latlng, 15));
            }
        }).addTo(layers.stations);

        const resSch = await fetch('data/school.geojson');
        rawData.schools = await resSch.json();
        stats.schools = rawData.schools.features.length;
        L.geoJSON(rawData.schools, {
            pane: 'pane_markers',
            pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 5, fillColor: "#ef476f", color: "#fff", weight: 1.5, fillOpacity: 1 }),
            onEachFeature: (f, l) => {
                l.bindPopup(`<b>โรงเรียน:</b> ${f.properties.CUL_PNAME}`);
                l.on('click', e => map.setView(e.latlng, 15));
            }
        }).addTo(layers.schools);

        const resLu = await fetch('data/Lu bkk.geojson');
        rawData.landuse = await resLu.json();
        filterLandUse();

        const resLine = await fetch('data/mrt_line.geojson');
        L.geoJSON(await resLine.json(), { style: { color: "#4361ee", weight: 3, opacity: 0.4 } }).addTo(layers.lines);

        simulateLocation();
        updateTotalStats();
    } catch (e) { console.error("Load failed", e); }
}

// 6. Layer Visibility Controls
document.getElementById('check-line').addEventListener('change', e => {
    if(e.target.checked) { map.addLayer(layers.lines); map.addLayer(layers.stations); }
    else { map.removeLayer(layers.lines); map.removeLayer(layers.stations); }
});
document.getElementById('check-lu').addEventListener('change', e => e.target.checked ? map.addLayer(layers.landuse) : map.removeLayer(layers.landuse));
document.getElementById('check-school').addEventListener('change', e => e.target.checked ? map.addLayer(layers.schools) : map.removeLayer(layers.schools));
document.getElementById('check-user-loc').addEventListener('change', e => e.target.checked ? map.addLayer(layers.userLocation) : map.removeLayer(layers.userLocation));
document.getElementById('check-buffer').addEventListener('change', e => {
    layers.buffer.clearLayers();
    if(e.target.checked && rawData.stations) {
        const buffered = turf.buffer(rawData.stations, 0.8, {units: 'kilometers'});
        L.geoJSON(buffered, { pane: 'pane_buffer', style: { color: "#4361ee", weight: 1, fillOpacity: 0.1, dashArray: "5, 10" } }).addTo(layers.buffer);
    }
});

init();