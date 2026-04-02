// screens/MapScreen.js
// Cập nhật: load markers từ Firestore (places + events), click → DetailScreen
import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import WebView from 'react-native-webview';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ── Build Leaflet HTML với markers ──────────────────────────────
function buildMapHtml(markers = []) {
  const markersJson = JSON.stringify(markers);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <title>ExploreEase Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background:#F0FDF9; }
    #map { width:100%; height:100%; }
    #locate-btn {
      position:absolute; bottom:110px; right:14px; z-index:1000;
      width:48px; height:48px; border-radius:24px;
      background:#0D9488; border:none;
      box-shadow:0 4px 14px rgba(13,148,136,.4);
      font-size:22px; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
    }
    #locate-btn:active { transform:scale(.93); }
    #toast {
      position:absolute; bottom:170px; left:50%; transform:translateX(-50%);
      z-index:1000; background:rgba(17,24,39,.82); color:#fff;
      padding:10px 20px; border-radius:20px; font-size:13px;
      font-family:sans-serif; white-space:nowrap;
      opacity:0; transition:opacity .3s; pointer-events:none;
    }
    #toast.show { opacity:1; }
    .user-dot {
      width:18px; height:18px; background:#0D9488;
      border:3px solid #fff; border-radius:50%;
      box-shadow:0 0 0 4px rgba(13,148,136,.25);
    }
    .place-dot {
      width:32px; height:32px; background:#0D9488;
      border:3px solid #fff; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:16px; box-shadow:0 2px 8px rgba(0,0,0,.2);
      cursor:pointer;
    }
    .event-dot {
      width:32px; height:32px; background:#F59E0B;
      border:3px solid #fff; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:16px; box-shadow:0 2px 8px rgba(0,0,0,.2);
      cursor:pointer;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <button id="locate-btn" onclick="locateUser()">📍</button>
  <div id="toast"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { center:[10.7769,106.7009], zoom:14, zoomControl:true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'© OpenStreetMap contributors', maxZoom:19,
    }).addTo(map);

    let userMarker = null, userCircle = null;

    // ── Load markers từ React Native ────────────────
    const MARKERS = ${markersJson};

    MARKERS.forEach(m => {
      if (!m.lat || !m.lng) return;
      const isEvent = m.type === 'event';
      const icon = L.divIcon({
        className:'',
        html: '<div class="' + (isEvent ? 'event-dot' : 'place-dot') + '">' + (isEvent ? '🎉' : '📍') + '</div>',
        iconSize:[32,32],
        iconAnchor:[16,16],
        popupAnchor:[0,-18],
      });
      L.marker([m.lat, m.lng], { icon })
        .addTo(map)
        .bindPopup(
          '<div style="min-width:160px">' +
            '<b>' + m.title + '</b>' +
            '<p style="font-size:12px;color:#6B7280;margin:4px 0">' + m.address + '</p>' +
            '<button onclick="openDetail(' + JSON.stringify(m).replace(/"/g, '&quot;') + ')" ' +
              'style="margin-top:6px;padding:6px 14px;background:#0D9488;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer">' +
              'Xem chi tiết →' +
            '</button>' +
          '</div>'
        );
    });

    function openDetail(m) {
      sendToRN({ type:'OPEN_DETAIL', item: m });
    }

    // ── Locate user ─────────────────────────────────
    function locateUser() {
      if (!navigator.geolocation) { showToast('Thiết bị không hỗ trợ GPS'); return; }
      showToast('Đang xác định vị trí...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude:lat, longitude:lng, accuracy } = pos.coords;
          if (userMarker) map.removeLayer(userMarker);
          if (userCircle) map.removeLayer(userCircle);
          userCircle = L.circle([lat,lng], { radius:accuracy||30, color:'#0D9488', fillColor:'#0D9488', fillOpacity:.08, weight:1 }).addTo(map);
          const dotIcon = L.divIcon({ className:'', html:'<div class="user-dot"></div>', iconSize:[18,18], iconAnchor:[9,9] });
          userMarker = L.marker([lat,lng], { icon:dotIcon, zIndexOffset:1000 }).addTo(map)
            .bindPopup('<b>📍 Vị trí của bạn</b>');
          map.flyTo([lat,lng], 16, { animate:true, duration:1.2 });
          showToast('📍 Đã xác định vị trí');
          sendToRN({ type:'LOCATION_UPDATE', lat, lng, accuracy });
        },
        () => showToast('Không lấy được vị trí'),
        { enableHighAccuracy:true, timeout:10000 }
      );
    }

    window.addEventListener('message', (e) => {
      try {
        const cmd = JSON.parse(e.data);
        if (cmd.type === 'FLY_TO') map.flyTo([cmd.lat,cmd.lng], cmd.zoom||16);
      } catch {}
    });

    function sendToRN(data) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg; t.classList.add('show');
      clearTimeout(window._toastTimer);
      window._toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
    }

    window.addEventListener('load', () => setTimeout(locateUser, 800));
  </script>
</body>
</html>
`;
}

export default function MapScreen({ navigation }) {
  const webRef = useRef(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [markers, setMarkers]   = useState([]);
  const [mapReady, setMapReady] = useState(false);

  // ── Fetch markers từ Firestore ───────────────────
  useEffect(() => {
    const fetch = async () => {
      try {
        const [placesSnap, eventsSnap] = await Promise.all([
          getDocs(collection(db, 'places')),
          getDocs(collection(db, 'events')),
        ]);
        const places = placesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.lat && d.lng);
        const events = eventsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.lat && d.lng);
        setMarkers([...places, ...events]);
      } catch (e) { console.error(e); }
      finally { setMapReady(true); }
    };
    fetch();
  }, []);

  // ── Handle messages từ WebView ───────────────────
  const handleMessage = (e) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === 'OPEN_DETAIL') {
        // Xác định collection
        const col = data.item.type === 'event' ? 'events' : 'places';
        navigation.navigate('Detail', { item: data.item, collection: col });
      }
    } catch {}
  };

  const handleRetry = () => {
    setError(false);
    setLoading(true);
    webRef.current?.reload();
  };

  if (!mapReady) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color="#0D9488" />
        <Text style={styles.loadingText}>Đang tải dữ liệu bản đồ...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0D9488" />
          <Text style={styles.loadingText}>Đang tải bản đồ...</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorEmoji}>🗺️</Text>
          <Text style={styles.errorTitle}>Không thể tải bản đồ</Text>
          <Text style={styles.errorSub}>Kiểm tra kết nối mạng và thử lại</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      )}
      {!error && (
        <WebView
          ref={webRef}
          style={styles.map}
          source={{ html: buildMapHtml(markers) }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          onMessage={handleMessage}
          javaScriptEnabled
          geolocationEnabled
          originWhitelist={['*']}
          allowsInlineMediaPlayback
        />
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#0D9488' }]}/>
          <Text style={styles.legendText}>Địa điểm</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]}/>
          <Text style={styles.legendText}>Sự kiện</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDF9' },
  map:       { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F0FDF9', zIndex: 10,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },

  errorBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorEmoji: { fontSize: 56 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 12 },
  errorSub:   { fontSize: 13, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
  retryBtn: {
    marginTop: 20, backgroundColor: '#0D9488',
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  legend: {
    position: 'absolute', bottom: 16, left: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12, padding: 10,
    flexDirection: 'row', gap: 14,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, fontWeight: '600', color: '#374151' },
});