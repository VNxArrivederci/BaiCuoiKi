// screens/HomeScreen.js — Trang chủ tích hợp bản đồ Leaflet + CARTO
import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, TextInput, Alert,
} from 'react-native';
import WebView from 'react-native-webview';
import * as Location from 'expo-location';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const TEAL = '#0D9488';
const GOLD = '#F59E0B';

// ── Build HTML Leaflet ───────────────────────────────────────────
function buildMapHtml(markers = []) {
  const markersJson = JSON.stringify(markers);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0,
        maximum-scale=1.0, user-scalable=no"/>
  <title>ExploreEase Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; }
    #map { width:100%; height:100%; }

    #toast {
      position:absolute; bottom:80px; left:50%;
      transform:translateX(-50%); z-index:1000;
      background:rgba(17,24,39,.82); color:#fff;
      padding:10px 20px; border-radius:20px; font-size:13px;
      font-family:sans-serif; white-space:nowrap;
      opacity:0; transition:opacity .3s; pointer-events:none;
    }
    #toast.show { opacity:1; }

    .place-dot {
      width:34px; height:34px; background:#0D9488;
      border:3px solid #fff; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:16px; box-shadow:0 2px 10px rgba(0,0,0,.25); cursor:pointer;
    }
    .event-dot {
      width:34px; height:34px; background:#F59E0B;
      border:3px solid #fff; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:16px; box-shadow:0 2px 10px rgba(0,0,0,.25); cursor:pointer;
    }
    .user-dot {
      width:20px; height:20px; background:#0D9488;
      border:3px solid #fff; border-radius:50%;
      box-shadow:0 0 0 5px rgba(13,148,136,.2);
    }

    .leaflet-popup-content-wrapper {
      border-radius:16px !important;
      box-shadow:0 4px 20px rgba(0,0,0,.15) !important;
      padding:0 !important; overflow:hidden;
    }
    .leaflet-popup-content { margin:0 !important; }
    .popup-inner  { padding:14px 16px; min-width:190px; max-width:250px; }
    .popup-type   { font-size:11px; font-weight:700; color:#0D9488; margin-bottom:5px; }
    .popup-title  { font-size:15px; font-weight:800; color:#111827;
                    margin-bottom:4px; line-height:1.3; }
    .popup-addr   { font-size:12px; color:#6B7280; margin-bottom:4px; }
    .popup-rating { font-size:12px; color:#F59E0B; font-weight:600; margin-bottom:10px; }
    .popup-btn {
      display:block; width:100%; padding:9px 0;
      background:#0D9488; color:#fff; border:none;
      border-radius:9px; font-size:13px; font-weight:700;
      cursor:pointer; text-align:center;
    }
    .popup-btn:active { background:#0F766E; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="toast"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', {
      center: [10.7769, 106.7009],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 19,
        subdomains: 'abcd',
      }
    ).addTo(map);

    let userMarker = null, userCircle = null;

    const MARKERS = ${markersJson};
    MARKERS.forEach(m => {
      if (!m.lat || !m.lng) return;
      const isEvent = m.type === 'event';
      const icon = L.divIcon({
        className: '',
        html: '<div class="' + (isEvent ? 'event-dot' : 'place-dot') + '">'
              + (isEvent ? '🎉' : '📍') + '</div>',
        iconSize:    [34, 34],
        iconAnchor:  [17, 17],
        popupAnchor: [0, -20],
      });
      const ratingHtml = m.rating > 0
        ? '<div class="popup-rating">⭐ ' + m.rating.toFixed(1)
          + ' (' + (m.ratingCount || 0) + ' đánh giá)</div>'
        : '';
      const safeItem = JSON.stringify(JSON.stringify(m));
      const popupHtml =
        '<div class="popup-inner">' +
          '<div class="popup-type">' + (isEvent ? '🎉 Sự kiện' : '📍 Địa điểm') + '</div>' +
          '<div class="popup-title">' + (m.title  || '') + '</div>' +
          '<div class="popup-addr">'  + (m.address || '') + '</div>' +
          ratingHtml +
          '<button class="popup-btn" onclick="openDetail(' + safeItem + ')">' +
            'Xem chi tiết →' +
          '</button>' +
        '</div>';
      L.marker([m.lat, m.lng], { icon })
        .addTo(map)
        .bindPopup(popupHtml, { maxWidth: 270 });
    });

    function openDetail(jsonStr) {
      try {
        const item = JSON.parse(jsonStr);
        sendToRN({ type: 'OPEN_DETAIL', item });
      } catch(e) {}
    }

    window.addEventListener('message', (e) => {
      try {
        const cmd = JSON.parse(e.data);
        if (cmd.type === 'FLY_TO') {
          map.flyTo([cmd.lat, cmd.lng], cmd.zoom || 16,
            { animate: true, duration: 1.2 });
        }
        if (cmd.type === 'SET_USER_LOCATION') {
          placeUserMarker(cmd.lat, cmd.lng, cmd.accuracy || 30);
        }
        if (cmd.type === 'SET_USER_LOCATION_ERROR') {
          showToast('Không lấy được vị trí. Kiểm tra quyền GPS.');
        }
      } catch {}
    });

    function placeUserMarker(lat, lng, accuracy) {
      if (userCircle) map.removeLayer(userCircle);
      if (userMarker) map.removeLayer(userMarker);
      userCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: '#0D9488', fillColor: '#0D9488',
        fillOpacity: 0.12, weight: 1,
      }).addTo(map);
      const dotIcon = L.divIcon({
        className: '',
        html: '<div class="user-dot"></div>',
        iconSize: [20, 20], iconAnchor: [10, 10],
      });
      userMarker = L.marker([lat, lng], { icon: dotIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('<b>📍 Vị trí của bạn</b>');
      map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
      showToast('📍 Đã xác định vị trí');
    }

    function sendToRN(data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(window._toastTimer);
      window._toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
    }
  </script>
</body>
</html>
`;
}

// ── Main Component ───────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const webRef = useRef(null);

  const [markers, setMarkers]         = useState([]);
  const [mapReady, setMapReady]       = useState(false);
  const [webLoading, setWebLoading]   = useState(true);
  const [webError, setWebError]       = useState(false);
  const [locating, setLocating]       = useState(false);

  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState('all');
  const [suggestions, setSuggestions] = useState([]);

  // ── Xin quyền + fetch markers ────────────────────
  useEffect(() => {
    const init = async () => {
      await Location.requestForegroundPermissionsAsync();
      try {
        const [placesSnap, eventsSnap] = await Promise.all([
          getDocs(collection(db, 'places')),
          getDocs(collection(db, 'events')),
        ]);
        const places = placesSnap.docs
          .map(d => ({ id: d.id, ...d.data(), type: 'place' }))
          .filter(d => d.lat && d.lng);
        const events = eventsSnap.docs
          .map(d => ({ id: d.id, ...d.data(), type: 'event' }))
          .filter(d => d.lat && d.lng);
        setMarkers([...places, ...events]);
      } catch (e) {
        console.error('Firestore:', e);
      } finally {
        setMapReady(true);
      }
    };
    init();
  }, []);

  // ── Định vị qua expo-location ────────────────────
  const handleLocate = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Cần quyền vị trí',
          'Vào Cài đặt → Ứng dụng → ExploreEase → Quyền → Vị trí → Cho phép',
          [{ text: 'OK' }],
        );
        webRef.current?.postMessage(
          JSON.stringify({ type: 'SET_USER_LOCATION_ERROR' })
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude, accuracy } = loc.coords;
      webRef.current?.postMessage(
        JSON.stringify({
          type: 'SET_USER_LOCATION',
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || 30,
        })
      );
    } catch {
      webRef.current?.postMessage(
        JSON.stringify({ type: 'SET_USER_LOCATION_ERROR' })
      );
    } finally {
      setLocating(false);
    }
  };

  // ── Filter markers ────────────────────────────────
  const filteredMarkers = markers.filter(m =>
    filter === 'all' ? true : m.type === filter
  );

  // ── Search suggestions ────────────────────────────
  const handleSearch = (text) => {
    setSearch(text);
    if (!text.trim()) { setSuggestions([]); return; }
    setSuggestions(
      markers
        .filter(m =>
          m.title?.toLowerCase().includes(text.toLowerCase()) ||
          m.address?.toLowerCase().includes(text.toLowerCase())
        )
        .slice(0, 5)
    );
  };

  const flyToMarker = (item) => {
    setSearch(item.title);
    setSuggestions([]);
    webRef.current?.postMessage(
      JSON.stringify({ type: 'FLY_TO', lat: item.lat, lng: item.lng, zoom: 17 })
    );
  };

  // ── Message từ WebView ────────────────────────────
  const handleMessage = (e) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === 'OPEN_DETAIL') {
        const col = data.item.type === 'event' ? 'events' : 'places';
        navigation.navigate('Detail', { item: data.item, collection: col });
      }
    } catch {}
  };

  // ── Loading state ─────────────────────────────────
  if (!mapReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={TEAL} />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* WebView loading overlay */}
      {webLoading && (
        <View style={styles.mapLoadingOverlay}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingText}>Đang tải bản đồ...</Text>
        </View>
      )}

      {/* WebView hoặc màn hình lỗi */}
      {webError ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🗺️</Text>
          <Text style={styles.errorTitle}>Không thể tải bản đồ</Text>
          <Text style={styles.errorSub}>Kiểm tra kết nối mạng và thử lại</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setWebError(false);
              setWebLoading(true);
              webRef.current?.reload();
            }}
          >
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webRef}
          style={styles.map}
          source={{ html: buildMapHtml(filteredMarkers) }}
          onLoadEnd={() => setWebLoading(false)}
          onError={() => { setWebLoading(false); setWebError(true); }}
          onMessage={handleMessage}
          javaScriptEnabled
          geolocationEnabled={false}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          originWhitelist={['*']}
          mixedContentMode="always"
        />
      )}

      {/* Thanh tìm kiếm overlay */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearch}
            placeholder="Tìm trên bản đồ..."
            placeholderTextColor="#9CA3AF"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setSuggestions([]); }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestList}>
            {suggestions.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.suggestItem}
                onPress={() => flyToMarker(item)}
              >
                <Text style={styles.suggestIcon}>
                  {item.type === 'event' ? '🎉' : '📍'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.suggestAddr} numberOfLines={1}>
                    {item.address}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {[
          { key: 'all',   label: '🌐 Tất cả' },
          { key: 'place', label: '📍 Địa điểm' },
          { key: 'event', label: '🎉 Sự kiện' },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.markerCount}>{filteredMarkers.length}</Text>
      </View>

      {/* Nút định vị */}
      <TouchableOpacity
        style={styles.locateBtn}
        onPress={handleLocate}
        disabled={locating}
      >
        {locating
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.locateIcon}>📍</Text>
        }
      </TouchableOpacity>

      {/* Chú thích */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: TEAL }]} />
          <Text style={styles.legendText}>
            Địa điểm ({markers.filter(m => m.type === 'place').length})
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: GOLD }]} />
          <Text style={styles.legendText}>
            Sự kiện ({markers.filter(m => m.type === 'event').length})
          </Text>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDF9' },
  map:       { flex: 1 },

  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F0FDF9', gap: 8,
  },
  loadingText: { marginTop: 10, fontSize: 14, color: '#6B7280' },
  errorTitle:  { fontSize: 17, fontWeight: '700', color: '#111827' },
  errorSub: {
    fontSize: 13, color: '#9CA3AF',
    textAlign: 'center', paddingHorizontal: 32,
  },
  retryBtn: {
    marginTop: 12, backgroundColor: TEAL,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F0FDF9', zIndex: 5,
  },

  // Search overlay
  searchWrapper: {
    position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#D1FAE5',
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  clearBtn:    { fontSize: 14, color: '#9CA3AF', paddingLeft: 8 },

  suggestList: {
    backgroundColor: '#fff', borderRadius: 12, marginTop: 4,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 6,
    overflow: 'hidden',
  },
  suggestItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  suggestIcon:  { fontSize: 18 },
  suggestTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  suggestAddr:  { fontSize: 11, color: '#9CA3AF', marginTop: 1 },

  // Filter chips
  filterRow: {
    position: 'absolute', top: 76, left: 12, right: 12, zIndex: 10,
    flexDirection: 'row', gap: 8, alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  filterChipActive: { borderColor: TEAL, backgroundColor: '#F0FDF9' },
  filterText:       { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: TEAL },
  markerCount: {
    marginLeft: 'auto', fontSize: 13, fontWeight: '800', color: TEAL,
    backgroundColor: '#F0FDF9', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#D1FAE5',
  },

  // Nút định vị
  locateBtn: {
    position: 'absolute', bottom: 100, right: 16, zIndex: 10,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: TEAL,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: TEAL, shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },
  locateIcon: { fontSize: 22 },

  // Chú thích
  legend: {
    position: 'absolute', bottom: 16, left: 16, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 12, padding: 10,
    flexDirection: 'row', gap: 14,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, fontWeight: '600', color: '#374151' },
});