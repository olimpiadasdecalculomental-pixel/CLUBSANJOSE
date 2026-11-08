import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Linking, StyleSheet, Alert, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ejecutarRpcUniversal } from './PuenteUniversalApi';
import { WidgetPizarraTactilSvg, WidgetJuegoCognitivo, WidgetRealidadInmersiva, exportarReportePdfUniversal, verificarBiometriaNativa } from './MotorJuegosvrContabilidad';

const ALTO_PANTALLA = Dimensions.get('window').height;

function convertirUrlAEmbed(urlOriginal) {
  if (!urlOriginal) return '';
  const matchTiktok = urlOriginal.match(/video\/(\d+)/);
  if (matchTiktok && matchTiktok[1]) return `https://www.tiktok.com/embed/v2/${matchTiktok[1]}`;
  const matchYt = urlOriginal.match(/(?:youtu\.be\/|watch\?v=|embed\/)([^#\&\?]{11})/);
  if (matchYt && matchYt[1]) return `https://www.youtube.com/embed/${matchYt[1]}?autoplay=1&playsinline=1&rel=0`;
  return urlOriginal;
}

export default function MotorInterpreteSdui({ bloques = [], geometria = {}, estadoForm, setEstadoForm, onRecargar, onAbrirEditorJson }) {
  const [permisoCam, pedirPermisoCam] = useCameraPermissions();
  const [camaraActivaId, setCamaraActivaId] = useState(null);
  const [videoLocalUri, setVideoLocalUri] = useState(null);
  const [indiceVideo, setIndiceVideo] = useState(0);
  const [feedback, setFeedback] = useState('');

  const colorP = geometria.color_primario || '#F59E0B';
  const colorS = geometria.color_secundario || '#38BDF8';
  const colorCard = geometria.color_tarjeta || '#0F172A';

  async function descargarVideoConDetectorWifi(urlRemota, nombreArchivo) {
    const ruta = FileSystem.documentDirectory + (nombreArchivo || 'offline_video.mp4');
    const net = await Network.getNetworkStateAsync();
    const esWifi = net.type === Network.NetworkStateType.WIFI;

    if (esWifi) {
      setFeedback('📶 Wi-Fi detectado: Guardando para uso Offline...');
      try {
        const r = await FileSystem.downloadAsync(urlRemota, ruta);
        setVideoLocalUri(r.uri);
        setFeedback('✅ Guardado en memoria Offline.');
      } catch (e) {
        setFeedback('ℹ️ Modo streaming directo.');
      }
    } else {
      Alert.alert(
        '📱 Datos Móviles',
        '¿Deseas descargar este contenido para uso Offline?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Descargar',
            onPress: async () => {
              try {
                const r = await FileSystem.downloadAsync(urlRemota, ruta);
                setVideoLocalUri(r.uri);
                setFeedback('✅ Guardado Offline.');
              } catch (e) {}
            }
          }
        ]
      );
    }
  }

  async function dispararAccionBoton(btn, bloquePadre = {}) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (btn.accion === 'ABRIR_EDITOR_JSON_CALIENTE' && onAbrirEditorJson) {
      onAbrirEditorJson();
      return;
    }

    if (btn.accion === 'SIGUIENTE_VIDEO' || btn.accion === 'SIGUIENTE_MEDIA') {
      setIndiceVideo((prev) => prev + 1);
      setVideoLocalUri(null);
      return;
    }

    if (btn.accion === 'DESCARGAR_VIDEO_OFFLINE') {
      await descargarVideoConDetectorWifi(btn.url_mp4, btn.nombre_archivo);
      return;
    }

    if (btn.accion === 'EXPORTAR_PDF_CONTABILIDAD' || btn.accion === 'EXPO_PRINT_PDF') {
      await exportarReportePdfUniversal(
        btn.titulo_pdf || bloquePadre.titulo || 'Documento Oficial',
        bloquePadre.items_lista || ['Sin registros']
      );
      return;
    }

    if (btn.accion === 'EXPO_BIOMETRIA_HUELLA') {
      const b = await verificarBiometriaNativa();
      setFeedback(b.mensaje);
      return;
    }

    if (btn.accion === 'ENVIAR_SOS_GPS') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let coordTxt = 'GPS Activo';
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        coordTxt = `Lat: ${loc.coords.latitude.toFixed(5)}, Lng: ${loc.coords.longitude.toFixed(5)}`;
      }
      Speech.speak('Alerta enviada con ubicación satelital', { language: 'es-ES' });
      const r = await ejecutarRpcUniversal('procesar_evento_sdui', {
        p_payload: { p_id_accion: 'SOS_EMERGENCIA_GPS', p_input_1: coordTxt }
      });
      setFeedback(r.mensaje || `🚨 Alerta enviada (${coordTxt})`);
      return;
    }

    if (btn.accion === 'EJECUTAR_JS_SUPABASE' && btn.codigo_js) {
      try {
        const fnDinamica = new Function(
          'estadoForm', 'setEstadoForm', 'setFeedback', 'Speech', 'Haptics', 'Alert', 'ejecutarRpcUniversal',
          btn.codigo_js
        );
        fnDinamica(estadoForm, setEstadoForm, setFeedback, Speech, Haptics, Alert, ejecutarRpcUniversal);
      } catch (e) {
        setFeedback('❌ Error JS: ' + e.message);
      }
      return;
    }

    if (btn.accion === 'ABRIR_LINK' && btn.url) {
      Linking.openURL(btn.url);
      return;
    }

    if (btn.accion === 'ELEGIR_FOTO_GALERIA') {
      const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!p.granted) return setFeedback('⚠️ Activa permiso de galería.');
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.3, base64: true });
      if (!res.canceled && res.assets?.[0]) {
        const uri64 = res.assets[0].base64 ? `data:image/jpeg;base64,${res.assets[0].base64}` : res.assets[0].uri;
        setEstadoForm((prev) => ({ ...prev, [btn.campo_destino || 'p_foto_uri']: uri64 }));
        setFeedback('📸 Imagen cargada.');
      }
      return;
    }

    if (btn.accion === 'EJECUTAR_RPC') {
      setFeedback('⏳ Procesando en Supabase...');
      const paqueteUnico = { ...(btn.parametros_fijos || {}), ...estadoForm };
      const r = await ejecutarRpcUniversal(btn.rpc_nombre || 'procesar_evento_sdui', {
        p_payload: paqueteUnico
      });
      setFeedback(r.mensaje || (r.exito ? '✅ Operación exitosa' : '❌ Error'));
      if (r.limpiar_inputs) setEstadoForm({});
      if (onRecargar) onRecargar();
    }
  }

  if (!bloques || bloques.length === 0 || (bloques.length === 1 && bloques[0].tipo === 'PANTALLA_COLOR_PURO')) {
    const bg = bloques?.[0]?.color_fondo || geometria.color_fondo || '#050A14';
    return <View style={{ flex: 1, width: '100%', height: '100%', backgroundColor: bg }} />;
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 10 }}>
      {feedback !== '' && (
        <View style={[styles.cajaFeedback, { borderColor: colorS }]}>
          <Text style={{ color: '#00FF66', fontWeight: 'bold', fontSize: 12, textAlign: 'center' }}>{feedback}</Text>
        </View>
      )}

      {bloques.filter((b) => b.visible !== false).map((b, i) => {
        if (b.tipo === 'FEED_TIKTOK_REAL' || b.tipo === 'FEED_TIKTOK_UNIVERSAL') {
          const listaVids = Array.isArray(b.lista_multimedia || b.lista_videos_json) && (b.lista_multimedia || b.lista_videos_json).length > 0
            ? (b.lista_multimedia || b.lista_videos_json)
            : [{ titulo: b.titulo || '', url: b.url_video || 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' }];
          const vidActual = listaVids[indiceVideo % listaVids.length];
          const urlLimpia = vidActual.url || b.url_video || '';
          const esArchivoMp4 = urlLimpia.toLowerCase().endsWith('.mp4') || urlLimpia.includes('gtv-videos-bucket') || !!videoLocalUri;

          return (
            <View key={b.id || i} style={styles.contenedorTiktok}>
              {esArchivoMp4 ? (
                <Video source={{ uri: videoLocalUri || urlLimpia }} style={{ width: '100%', height: '100%' }} resizeMode={ResizeMode.COVER} shouldPlay isLooping useNativeControls />
              ) : (
                <WebView source={{ uri: convertirUrlAEmbed(urlLimpia) }} style={{ flex: 1, backgroundColor: '#000' }} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} javaScriptEnabled domStorageEnabled />
              )}
              <View style={styles.columnaFlotanteDerecha}>
                <TouchableOpacity style={styles.btnCircularTiktok} onPress={() => dispararAccionBoton({ accion: 'SIGUIENTE_VIDEO' })}>
                  <Ionicons name="play-skip-forward" size={24} color="#00F3FF" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnCircularTiktok, { borderColor: '#00FF66' }]} onPress={() => descargarVideoConDetectorWifi(urlLimpia, 'clip_offline.mp4')}>
                  <Ionicons name="cloud-download" size={24} color="#00FF66" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }

        return (
          <View key={b.id || i} style={[styles.tarjetaNeon, { backgroundColor: colorCard, borderColor: b.color_borde || colorP }]}>
            {b.titulo ? <Text style={[styles.tituloNeon, { color: b.color_borde || colorP }]}>{b.titulo}</Text> : null}
            {b.subtitulo ? <Text style={styles.sub}>{b.subtitulo}</Text> : null}

            {b.tipo === 'PIZARRA_TACTIL_SVG' && <WidgetPizarraTactilSvg bloque={b} />}
            {b.tipo === 'MOTOR_JUEGO_COGNITIVO' && <WidgetJuegoCognitivo bloque={b} />}
            {b.tipo === 'VISOR_AR_VR_360' && <WidgetRealidadInmersiva bloque={b} />}

            {b.tipo === 'LIENZO_WEBAR_HTML5' && (
              <View style={{ width: '100%', height: 300, borderRadius: 12, overflow: 'hidden', marginVertical: 8 }}>
                <WebView originWhitelist={['*']} source={b.html_puro ? { html: b.html_puro } : { uri: b.url_webar || 'https://modelviewer.dev/' }} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback />
              </View>
            )}

            {b.tipo === 'CARNET_QR_ACTIVO' && (
              <View style={{ alignItems: 'center', marginVertical: 10 }}>
                <Text style={styles.codigoGrande}>{b.valor_qr_defecto || 'ID-001'}</Text>
                <View style={styles.marcoQr}>
                  <QRCode value={b.valor_qr_defecto || 'ID-001'} size={150} />
                </View>
              </View>
            )}

            {b.imagen_url ? <Image source={{ uri: b.imagen_url }} style={styles.imgPremio} resizeMode="cover" /> : null}

            {Array.isArray(b.selector_chips) && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.labelInput}>{b.titulo_selector || 'Selecciona una opción:'}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {b.selector_chips.map((op, k) => {
                    const valorOp = typeof op === 'object' ? `${op.bandera || ''} ${op.nombre}` : op;
                    const activo = estadoForm[b.campo_selector || 'p_seleccion'] === valorOp;
                    return (
                      <TouchableOpacity
                        key={k}
                        style={[styles.btnOpcionChip, { borderColor: b.color_borde || colorP, backgroundColor: activo ? (b.color_borde || colorP) : '#111' }]}
                        onPress={() => setEstadoForm((prev) => ({ ...prev, [b.campo_selector || 'p_seleccion']: valorOp }))}
                      >
                        <Text style={{ color: activo ? '#000' : '#FFF', fontSize: 11, fontWeight: 'bold' }}>{valorOp}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {Array.isArray(b.campos_input) && b.campos_input.map((inp, idx) => (
              <View key={idx} style={{ marginBottom: 10 }}>
                <Text style={styles.labelInput}>{inp.placeholder}</Text>
                <TextInput
                  style={[styles.inputNeon, { borderColor: b.color_borde || colorP }]}
                  placeholder={inp.placeholder}
                  placeholderTextColor="#555"
                  secureTextEntry={!!inp.es_password}
                  keyboardType={inp.teclado || 'default'}
                  value={estadoForm[inp.campo] || ''}
                  onChangeText={(txt) => setEstadoForm((prev) => ({ ...prev, [inp.campo]: txt }))}
                />
              </View>
            ))}

            {Array.isArray(b.items_lista) && b.items_lista.map((item, j) => (
              <View key={j} style={[styles.filaInventarioOrbe, { borderColor: b.color_borde || '#333' }]}>
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold', lineHeight: 18 }}>{item}</Text>
              </View>
            ))}

            {b.tipo === 'ESCANER_CAMARA_QR' && (
              <View style={{ alignItems: 'center', marginVertical: 8 }}>
                {camaraActivaId === b.id ? (
                  <View style={{ width: '100%', height: 240, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: colorP }}>
                    <CameraView
                      style={{ flex: 1 }}
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={({ data }) => {
                        setCamaraActivaId(null);
                        setEstadoForm((prev) => ({ ...prev, [b.campo_destino || 'p_id_o_qr']: data }));
                        setFeedback(`🎯 QR Escaneado: ${data}`);
                      }}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.botonNeon, { backgroundColor: colorS, width: '100%' }]}
                    onPress={async () => {
                      if (!permisoCam?.granted) await pedirPermisoCam();
                      setCamaraActivaId(b.id);
                    }}
                  >
                    <Text style={styles.txtBoton}>📷 ACTIVAR CÁMARA ESCÁNER QR</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {Array.isArray(b.botones) && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                {b.botones.map((btn, n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.botonNeon, { backgroundColor: btn.color || b.color_borde || colorP, width: btn.ancho_mitad ? '48%' : '100%' }]}
                    onPress={() => dispararAccionBoton(btn, b)}
                  >
                    <Text style={[styles.txtBoton, { color: btn.color_texto || '#000' }]}>{btn.texto}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedorTiktok: { width: '100%', height: ALTO_PANTALLA * 0.76, backgroundColor: '#000', borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: '#00F3FF', position: 'relative', marginTop: 6 },
  columnaFlotanteDerecha: { position: 'absolute', right: 12, bottom: 25, alignItems: 'center', gap: 14, zIndex: 20 },
  btnCircularTiktok: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(5, 5, 15, 0.82)', borderWidth: 1.5, borderColor: '#00F3FF', justifyContent: 'center', alignItems: 'center' },
  tarjetaNeon: { borderRadius: 12, padding: 16, marginTop: 14, borderWidth: 1.5 },
  tituloNeon: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  sub: { color: '#AAA', fontSize: 12, marginBottom: 12, lineHeight: 17 },
  labelInput: { color: '#AAA', fontSize: 11, marginBottom: 4, fontWeight: 'bold' },
  inputNeon: { backgroundColor: '#000', color: '#FFF', borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, height: 46, fontSize: 14 },
  btnOpcionChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  filaInventarioOrbe: { backgroundColor: '#111', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1 },
  imgPremio: { width: '100%', height: 165, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  botonNeon: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  txtBoton: { fontWeight: 'bold', fontSize: 12, letterSpacing: 0.6, textAlign: 'center' },
  codigoGrande: { color: '#FFD700', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  marcoQr: { padding: 12, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 3, borderColor: '#00F3FF' },
  cajaFeedback: { backgroundColor: '#0A0A1C', padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 8 }
});