import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, PanResponder, StyleSheet, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as LocalAuthentication from 'expo-local-authentication';
import { DeviceMotion } from 'expo-sensors';
import { Video, ResizeMode } from 'expo-av';
import { CameraView } from 'expo-camera';

export async function exportarReportePdfUniversal(titulo, filas = [], piePagina = 'Generado por Motor Universal SDUI') {
  try {
    const filasHtml = filas.map((f, i) => `<tr><td style="padding:8px;border:1px solid #ccc;">${i + 1}</td><td style="padding:8px;border:1px solid #ccc;">${f}</td></tr>`).join('');
    const html = `
      <html>
        <body style="font-family: Arial; padding: 24px; color: #0F172A;">
          <h1 style="color: #042B6B;">${titulo}</h1>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
            <thead><tr style="background:#042B6B;color:#FFF;"><th style="padding:8px;">#</th><th style="padding:8px;">Detalle del Registro</th></tr></thead>
            <tbody>${filasHtml}</tbody>
          </table>
          <p style="margin-top:30px; font-weight:bold; color:#475569;">${piePagina}</p>
        </body>
      </html>
    `;
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: titulo });
  } catch (e) {
    Alert.alert('Error PDF', e.message);
  }
}

export async function verificarBiometriaNativa(mensaje = 'Confirma tu huella o rostro') {
  try {
    const ok = await LocalAuthentication.hasHardwareAsync();
    if (!ok) return { exito: false, mensaje: 'Sin sensor biométrico.' };
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: mensaje });
    return { exito: r.success, mensaje: r.success ? '✅ Biometría verificada' : '❌ Cancelado' };
  } catch (e) {
    return { exito: false, mensaje: e.message };
  }
}

export function WidgetPizarraTactilSvg({ bloque }) {
  const [trazos, setTrazos] = useState([]);
  const [trazoActual, setTrazoActual] = useState('');
  const ref = useRef('');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        ref.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setTrazoActual(ref.current);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        ref.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setTrazoActual(ref.current);
      },
      onPanResponderRelease: () => {
        if (ref.current) {
          const final = ref.current;
          setTrazos((prev) => [...prev, final]);
          setTrazoActual('');
        }
      }
    })
  ).current;

  return (
    <View style={styles.cajaJuego}>
      <Text style={{ color: '#38BDF8', fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>
        ✍️ {bloque.titulo_pizarra || 'PIZARRA TÁCTIL (ESCRIBE O DIBUJA CON EL DEDO)'}
      </Text>
      <View style={styles.lienzoFirma} {...panResponder.panHandlers}>
        <Svg style={StyleSheet.absoluteFill}>
          {trazos.map((d, idx) => (
            <Path key={idx} d={d} stroke={bloque.color_lapiz || '#00FF66'} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {trazoActual !== '' && (
            <Path d={trazoActual} stroke={bloque.color_lapiz || '#00F3FF'} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </Svg>
      </View>
      <TouchableOpacity style={[styles.btnComprobar, { marginTop: 8, backgroundColor: '#334155' }]} onPress={() => { setTrazos([]); setTrazoActual(''); }}>
        <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 11 }}>🗑️ LIMPIAR PIZARRA</Text>
      </TouchableOpacity>
    </View>
  );
}

export function WidgetJuegoCognitivo({ bloque, onResultado }) {
  const [respuesta, setRespuesta] = useState('');
  const [faseMemoria, setFaseMemoria] = useState('MEMORIZAR');
  const [seleccionados, setSeleccionados] = useState([]);

  const subtipo = bloque.subtipo_juego || 'KAHOOT_4_OPCIONES';

  function hablarTexto(txt, idioma = 'es-ES') {
    Speech.stop();
    Speech.speak(txt, { language: idioma, rate: 0.9 });
  }

  if (subtipo === 'KAHOOT_4_OPCIONES') {
    const opciones = bloque.opciones_kahoot || [
      { texto: 'Opción 1', correcta: true, color: '#e21b3c' },
      { texto: 'Opción 2', correcta: false, color: '#1368ce' },
      { texto: 'Opción 3', correcta: false, color: '#d89e00' },
      { texto: 'Opción 4', correcta: false, color: '#26890c' }
    ];
    return (
      <View style={styles.cajaJuego}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={styles.preguntaGrande}>{bloque.pregunta || 'Pregunta Interactiva'}</Text>
          <TouchableOpacity style={styles.btnVoz} onPress={() => hablarTexto(bloque.pregunta || 'Pregunta Interactiva')}>
            <Text style={{ fontSize: 20 }}>🔊</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.gridKahoot}>
          {opciones.map((op, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.btnKahoot, { backgroundColor: op.color || '#1368ce' }]}
              onPress={() => {
                Haptics.notificationAsync(op.correcta ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
                hablarTexto(op.correcta ? '¡Correcto!' : 'Incorrecto');
                if (onResultado) onResultado(op.correcta, op.correcta ? 10 : 0);
              }}
            >
              <Text style={styles.txtKahoot}>{op.texto}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  if (subtipo === 'CALCULO_VEDICO' || subtipo === 'MATEMATICA_RAPIDA') {
    const n1 = Number(bloque.num_arriba || 45);
    const n2 = Number(bloque.num_abajo || 23);
    const esperado = String(n1 * n2);

    function escribirDerechaAIzquierda(txt) {
      const limpio = txt.replace(/[^0-9]/g, '');
      if (limpio.length > respuesta.length) {
        setRespuesta(limpio.slice(-1) + respuesta);
      } else {
        setRespuesta(respuesta.slice(1));
      }
    }

    return (
      <View style={styles.cajaJuego}>
        <View style={styles.pizarraMate}>
          <Text style={styles.numGigante}>{n1}</Text>
          <Text style={[styles.numGigante, { color: '#F43F5E' }]}>× {n2}</Text>
          <TextInput
            style={styles.inputVedic}
            value={respuesta}
            onChangeText={escribirDerechaAIzquierda}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#475569"
          />
        </View>
        <TouchableOpacity
          style={styles.btnComprobar}
          onPress={() => {
            const ok = respuesta.trim() === esperado;
            hablarTexto(ok ? '¡Excelente!' : `Era ${esperado}`);
            if (onResultado) onResultado(ok, ok ? 20 : 0);
            setRespuesta('');
          }}
        >
          <Text style={{ color: '#000', fontWeight: 'bold' }}>COMPROBAR RESULTADO</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const objetivos = bloque.items_memorizar || ['⚽', '🏆', '🛡️', '⚡'];
  const distractores = bloque.items_distractores || ['🍔', '🚗'];
  const todos = [...objetivos, ...distractores];

  return (
    <View style={styles.cajaJuego}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginVertical: 10 }}>
        {(faseMemoria === 'MEMORIZAR' ? objetivos : todos).map((em, k) => {
          const marcado = seleccionados.includes(em);
          return (
            <TouchableOpacity
              key={k}
              style={[styles.celdaMemoria, marcado && { borderColor: '#00FF66', backgroundColor: '#064E3B' }]}
              onPress={() => {
                if (faseMemoria === 'MEMORIZAR') return;
                setSeleccionados((prev) => prev.includes(em) ? prev.filter((x) => x !== em) : [...prev, em]);
              }}
            >
              <Text style={{ fontSize: 28 }}>{em}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={styles.btnComprobar}
        onPress={() => {
          if (faseMemoria === 'MEMORIZAR') setFaseMemoria('RECORDAR');
          else { setFaseMemoria('MEMORIZAR'); setSeleccionados([]); }
        }}
      >
        <Text style={{ color: '#000', fontWeight: 'bold' }}>{faseMemoria === 'MEMORIZAR' ? 'EMPEZAR RETO' : 'VERIFICAR'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function WidgetRealidadInmersiva({ bloque }) {
  const [modo, setModo] = useState(bloque.subtipo_realidad || 'AR');
  const [rotacion, setRotacion] = useState({ beta: 0, gamma: 0 });

  useEffect(() => {
    DeviceMotion.setUpdateInterval(40);
    const sub = DeviceMotion.addListener((d) => {
      if (d.rotation) setRotacion(d.rotation);
    });
    return () => sub.remove();
  }, []);

  const tx = -(rotacion.gamma || 0) * 90;
  const ty = -(rotacion.beta || 0) * 60;
  const urlVid = bloque.url_video_mp4 || 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

  return (
    <View style={{ width: '100%', height: 280, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#00FF66', backgroundColor: '#000' }}>
      {modo === 'VR' ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ flex: 1, overflow: 'hidden', borderRightWidth: 2, borderColor: '#00F3FF' }}>
            <Video source={{ uri: urlVid }} style={{ width: '140%', height: '140%', transform: [{ translateX: tx }, { translateY: ty }] }} shouldPlay isLooping resizeMode={ResizeMode.COVER} />
          </View>
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <Video source={{ uri: urlVid }} style={{ width: '140%', height: '140%', transform: [{ translateX: tx }, { translateY: ty }] }} shouldPlay isLooping resizeMode={ResizeMode.COVER} />
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <CameraView style={StyleSheet.absoluteFillObject} facing="back" />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: '82%', height: '65%', borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#00FF66' }}>
              <Video source={{ uri: urlVid }} style={{ width: '100%', height: '100%' }} shouldPlay isLooping resizeMode={ResizeMode.COVER} />
            </View>
          </View>
        </View>
      )}
      <View style={{ position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity style={styles.chipModo} onPress={() => setModo('AR')}><Text style={{ color: '#00FF66', fontWeight: 'bold', fontSize: 11 }}>🔮 AR</Text></TouchableOpacity>
        <TouchableOpacity style={styles.chipModo} onPress={() => setModo('VR')}><Text style={{ color: '#00F3FF', fontWeight: 'bold', fontSize: 11 }}>🥽 VR 360</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cajaJuego: { backgroundColor: '#050814', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', marginVertical: 8 },
  lienzoFirma: { width: '100%', height: 210, backgroundColor: '#020617', borderRadius: 12, borderWidth: 1.5, borderColor: '#334155', overflow: 'hidden' },
  preguntaGrande: { flex: 1, color: '#FFF', fontSize: 17, fontWeight: 'bold' },
  btnVoz: { backgroundColor: '#1E293B', padding: 10, borderRadius: 25, marginLeft: 8 },
  gridKahoot: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  btnKahoot: { width: '48%', minHeight: 78, borderRadius: 10, padding: 10, justifyContent: 'center', alignItems: 'center' },
  txtKahoot: { color: '#FFF', fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
  pizarraMate: { backgroundColor: '#0F172A', padding: 14, borderRadius: 12, alignItems: 'flex-end', marginBottom: 10 },
  numGigante: { color: '#FFF', fontSize: 32, fontWeight: 'bold', letterSpacing: 4 },
  inputVedic: { width: '100%', backgroundColor: '#020617', color: '#38BDF8', fontSize: 28, fontWeight: 'bold', textAlign: 'right', padding: 10, borderRadius: 8, marginTop: 6 },
  btnComprobar: { backgroundColor: '#00FF66', padding: 12, borderRadius: 8, alignItems: 'center' },
  celdaMemoria: { width: 56, height: 56, backgroundColor: '#0F172A', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#334155' },
  chipModo: { backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#334155' }
});