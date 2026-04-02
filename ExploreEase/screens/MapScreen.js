// screens/MapScreen.js
import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import WebView from 'react-native-webview';

// ── HTML dùng Leaflet.js + OpenStreetMap (không cần API key) ──
const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <title>ExploreEase Map</title>

  <!-- Leaflet CSS -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #F0FDF9; }
    #map { width: 100%; height: 100%; }

    /* Nút vị trí hiện tại */
    #locate-btn {
      position: absolute;
      bottom: 110px; right: 14px;
      z-index: 1000;
      width: 48px; height: 48px;
      border-radius: 24px;
      background: #0D9488;
      border: none;
      box-shadow: 0 4px 14px rgba(13,148,136,0.4);
      font-size: 22px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    #locate-btn:active { transform: scale(0.93); }

    /* Toast thông báo */
    #toast {
      position: absolute;
      bottom: 170px; left: 50%; transform: translateX(-50%);
      z-index: 1000;
      background: rgba(17,24,39,0.82);
      color: #fff;
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 13px;
      font-family: sans-serif;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    }
    #toast.show { opacity: 1; }

    /* Dot vị trí user */
    .user-dot {
      width: 18px; height: 18px;
      background: #0D9488;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(13,148,136,0.25);
    }

    /* Pulse animation */
    .user-pulse {
      width: 40px; height: 40px;
      background: rgba(13,148,136,0.2);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%   { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.8); opacity: 0; }
    }
  </style>
</head>
<body>

  <div id="map"></div>
  <button id="locate-btn" onclick="locateUser()">📍</button>
  <div id="toast"></div>

  <!-- Leaflet JS -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <script>
    // ── Khởi tạo bản đồ (mặc định TP.HCM) ────────
    const map = L.map('map', {
      center: [10.7769, 106.7009],
      zoom: 14,
      zoomControl: true,
    });

    // ── OpenStreetMap tiles (miễn phí, không cần key) ──
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // ── Marker vị trí user ─────────────────────────
    let userMarker   = null;
    let userCircle   = null;
    let watchId      = null;
    let isTracking   = false;

    // ── Lấy vị trí hiện tại ───────────────────────
    function locateUser() {
      if (!navigator.geolocation) {
        showToast('Thiết bị không hỗ trợ GPS');
        return;
      }

      showToast('Đang xác định vị trí...');

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          updateUserLocation(lat, lng, accuracy);
          map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
          showToast('📍 Đã xác định vị trí của bạn');

          // Gửi tọa độ về React Native
          sendToRN({ type: 'LOCATION_UPDATE', lat, lng, accuracy });
        },
        (err) => {
          showToast('Không lấy được vị trí. Hãy cấp quyền GPS.');
          sendToRN({ type: 'LOCATION_ERROR', message: err.message });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    // ── Cập nhật marker vị trí ─────────────────────
    function updateUserLocation(lat, lng, accuracy) {
      // Xóa marker cũ
      if (userMarker)  map.removeLayer(userMarker);
      if (userCircle)  map.removeLayer(userCircle);

      // Vòng tròn độ chính xác
      userCircle = L.circle([lat, lng], {
        radius: accuracy || 30,
        color: '#0D9488',
        fillColor: '#0D9488',
        fillOpacity: 0.08,
        weight: 1,
      }).addTo(map);

      // Dot vị trí
      const dotIcon = L.divIcon({
        className: '',
        html: '<div class="user-dot"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      userMarker = L.marker([lat, lng], { icon: dotIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('<b>📍 Vị trí của bạn</b><br>Lat: ' + lat.toFixed(5) + '<br>Lng: ' + lng.toFixed(5));
    }

    // ── Real-time tracking (dùng sau) ─────────────
    function startTracking() {
      if (isTracking) return;
      isTracking = true;

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          updateUserLocation(lat, lng, accuracy);
          sendToRN({ type: 'LOCATION_UPDATE', lat, lng, accuracy });
        },
        (err) => sendToRN({ type: 'LOCATION_ERROR', message: err.message }),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );

      sendToRN({ type: 'TRACKING_STARTED' });
    }

    function stopTracking() {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      isTracking = false;
      sendToRN({ type: 'TRACKING_STOPPED' });
    }

    // ── Nhận lệnh từ React Native ──────────────────
    window.addEventListener('message', (e) => {
      try {
        const cmd = JSON.parse(e.data);
        if (cmd.type === 'START_TRACKING') startTracking();
        if (cmd.type === 'STOP_TRACKING')  stopTracking();
        if (cmd.type === 'FLY_TO') map.flyTo([cmd.lat, cmd.lng], cmd.zoom || 16);
      } catch {}
    });

    // ── Giao tiếp với React Native ─────────────────
    function sendToRN(data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    // ── Toast ──────────────────────────────────────
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(window._toastTimer);
      window._toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
    }

    // ── Tự động lấy vị trí khi mở bản đồ ─────────
    window.addEventListener('load', () => {
      setTimeout(locateUser, 800);
    });
  </script>
</body>
</html>
`;

// ── React Native Component ───────────────────────
export default function MapScreen() {
  const webRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [location, setLocation] = useState(null);

  // Nhận message từ WebView
  const handleMessage = (e) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);

      if (data.type === 'LOCATION_UPDATE') {
        setLocation({ lat: data.lat, lng: data.lng });
        console.log('📍 Vị trí:', data.lat, data.lng);
      }
      if (data.type === 'LOCATION_ERROR') {
        console.warn('GPS error:', data.message);
      }
    } catch {}
  };

  // Gửi lệnh vào WebView
  const sendCommand = (cmd) => {
    webRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: '${JSON.stringify(cmd)}' })); true;`
    );
  };

  const handleRetry = () => {
    setError(false);
    setLoading(true);
    webRef.current?.reload();
  };

  return (
    <View style={styles.container}>
      {/* Loading */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0D9488" />
          <Text style={styles.loadingText}>Đang tải bản đồ...</Text>
        </View>
      )}

      {/* Error */}
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

      {/* WebView */}
      {!error && (
        <WebView
          ref={webRef}
          style={styles.map}
          source={{ html: MAP_HTML }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          onMessage={handleMessage}
          javaScriptEnabled
          geolocationEnabled
          originWhitelist={['*']}
          allowsInlineMediaPlayback
        />
      )}
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

  errorBox: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  errorEmoji: { fontSize: 56 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 12 },
  errorSub:   { fontSize: 13, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
  retryBtn: {
    marginTop: 20, backgroundColor: '#0D9488',
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});