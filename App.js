import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, AppState, Keyboard, useWindowDimensions, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { sincronizarContratoSdui, ejecutarRpcUniversal } from './src/PuenteUniversalApi';
import MotorInterpreteSdui from './src/MotorInterpreteSdui';

const SEMILLA_VACIA_58 = {
  geometria: {
    color_fondo: '#050A14',
    color_tarjeta: '#0F172A',
    color_primario: '#F59E0B',
    color_secundario: '#38BDF8',
    margen_arriba: 34,
    margen_abajo: 48,
    margen_izquierda: 0,
    margen_derecha: 0
  },
  pestanas: [
    { id: 'RAIZ', titulo: 'RAIZ', visible: true, color_fondo_pantalla: '#050A14' }
  ],
  pantallas_json: {
    RAIZ: [{ id: 'lienzo_vacio_58', tipo: 'PANTALLA_COLOR_PURO', color_fondo: '#050A14' }]
  }
};

export default function App() {
  const { width: ANCHO } = useWindowDimensions();
  const [contrato, setContrato] = useState(SEMILLA_VACIA_58);
  const [indicePagina, setIndicePagina] = useState(0);
  const [estadoForm, setEstadoForm] = useState({});
  const scrollRef = useRef(null);

  // Candado Negro Camuflado (5 toques en esquina superior derecha)
  const [enCandadoInvisible, setEnCandadoInvisible] = useState(false);
  const [claveSecreta, setClaveSecreta] = useState('');

  // Rol SuperAdmin Expo 58 (Esquema 2)
  const [esAdmin, setEsAdmin] = useState(false);
  const [modalJson, setModalJson] = useState(false);
  const [editorTexto, setEditorTexto] = useState('');

  const [toques, setToques] = useState(0);
  const timerToques = useRef(null);

  async function sincronizarAhora() {
    try {
      const res = await sincronizarContratoSdui('MODULO_MAESTRO_V1');
      if (res.contrato && res.contrato.pantallas_json) {
        setContrato(res.contrato);
      }
    } catch (e) {}
  }

  useEffect(() => {
    sincronizarAhora();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') sincronizarAhora();
    });
    return () => {
      sub.remove();
      if (timerToques.current) clearTimeout(timerToques.current);
    };
  }, []);

  function tocarEsquinaCincoVeces() {
    const n = toques + 1;
    setToques(n);
    if (timerToques.current) clearTimeout(timerToques.current);
    if (n >= 5) {
      setToques(0);
      setClaveSecreta('');
      setEnCandadoInvisible(true);
    } else {
      timerToques.current = setTimeout(() => setToques(0), 1800);
    }
  }

  async function presionarBotonDoradoEntrar() {
    Keyboard.dismiss();
    const clave = claveSecreta.trim();
    setClaveSecreta('');

    if (clave === '?1942?' || clave === '1942?' || clave === '1942') {
      setEsAdmin(true);
      setEnCandadoInvisible(false);
      await ejecutarRpcUniversal('procesar_evento_sdui', {
        p_payload: { p_id_accion: 'ADMIN_AUTENTICAR', p_input_1: '?1942?' }
      });
      await sincronizarAhora();
      setEditorTexto(JSON.stringify(contrato, null, 2));
      setModalJson(true);
    } else {
      setEnCandadoInvisible(false);
      sincronizarAhora();
    }
  }

  async function publicarJsonEnCaliente() {
    try {
      const nuevo = JSON.parse(editorTexto);
      setContrato(nuevo);
      const r = await ejecutarRpcUniversal('esq1_rpc_actualizar_sdui', {
        p_modulo: 'MODULO_MAESTRO_V1',
        p_nuevo_json: nuevo
      });
      if (r && r.exito === false && r.mensaje) {
        alert(r.mensaje);
        return;
      }
      setModalJson(false);
      await sincronizarAhora();
    } catch (e) {
      alert('Error de formato JSON: ' + e.message);
    }
  }

  const g = contrato?.geometria || SEMILLA_VACIA_58.geometria;
  const listaPestanas = (contrato?.pestanas || SEMILLA_VACIA_58.pestanas).filter((p) => {
    if (p.visible === false) return false;
    if (p.rol_permitido === 'superadmin' && !esAdmin) return false;
    return true;
  });

  const anchoUtil = Math.max(200, ANCHO - Number(g.margen_izquierda ?? 0) - Number(g.margen_derecha ?? 0));
  const mostrarBarraSuperior = listaPestanas.length > 1 || esAdmin;

  function irAPagina(idx) {
    setIndicePagina(idx);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ x: idx * anchoUtil, animated: true });
    }
  }

  return (
    <View style={{
      flex: 1,
      backgroundColor: g.color_fondo || '#050A14',
      paddingTop: Number(g.margen_arriba ?? 34),
      paddingBottom: Number(g.margen_abajo ?? 48),
      paddingLeft: Number(g.margen_izquierda ?? 0),
      paddingRight: Number(g.margen_derecha ?? 0)
    }}>
      <StatusBar style="light" backgroundColor="#050A14" translucent={false} />

      {/* ZONA INVISIBLE ARRIBA A LA DERECHA: 5 TOQUES ABRE EL CANDADO NEGRO */}
      <TouchableOpacity style={styles.esquinaInvisible} activeOpacity={1} onPress={tocarEsquinaCincoVeces} />

      {mostrarBarraSuperior && (
        <View style={styles.barraNavegacion}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 6 }}>
            {listaPestanas.map((p, idx) => {
              const activa = indicePagina === idx;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.chipPestana, activa && { backgroundColor: '#F59E0B', borderColor: '#FFF' }]}
                  onPress={() => irAPagina(idx)}
                >
                  <Text style={{ color: activa ? '#000000' : '#FFFFFF', fontWeight: 'bold', fontSize: 11 }}>{p.titulo || p.id}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {esAdmin && (
            <TouchableOpacity
              style={styles.btnEditorAdmin}
              onPress={() => {
                setEditorTexto(JSON.stringify(contrato, null, 2));
                setModalJson(true);
              }}
            >
              <Text style={{ color: '#000000', fontSize: 10, fontWeight: '900' }}>⚡ EXPO 58 (ESQ2)</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* LIENZO PRINCIPAL SDUI (ENTRA DIRECTO SIN SPLASH INTERMEDIO) */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(ev) => {
          const idx = Math.round(ev.nativeEvent.contentOffset.x / anchoUtil);
          setIndicePagina(idx);
        }}
        style={{ flex: 1 }}
      >
        {listaPestanas.map((p) => {
          const bloques = contrato?.pantallas_json?.[p.id] || [];
          return (
            <View key={p.id} style={{ width: anchoUtil, flex: 1, backgroundColor: p.color_fondo_pantalla || g.color_fondo || '#050A14' }}>
              <MotorInterpreteSdui
                bloques={bloques}
                geometria={g}
                estadoForm={estadoForm}
                setEstadoForm={setEstadoForm}
                onRecargar={() => sincronizarAhora()}
                onAbrirEditorJson={() => {
                  setEditorTexto(JSON.stringify(contrato, null, 2));
                  setModalJson(true);
                }}
              />
            </View>
          );
        })}
      </ScrollView>

      {/* PANTALLA NEGRA CAMUFLADA CON INPUT INVISIBLE Y BOTÓN DORADO "ENTRAR" */}
      <Modal visible={enCandadoInvisible} transparent={false} animationType="fade">
        <View style={styles.pantallaNegraCandado}>
          <StatusBar style="light" backgroundColor="#000000" translucent={false} />
          <TextInput
            style={styles.inputTotalmenteInvisible}
            value={claveSecreta}
            onChangeText={setClaveSecreta}
            secureTextEntry={true}
            caretHidden={true}
            autoCorrect={false}
            autoCapitalize="none"
            underlineColorAndroid="transparent"
            selectionColor="#000000"
            contextMenuHidden={true}
          />
          <TouchableOpacity style={styles.botonDoradoEntrar} activeOpacity={0.85} onPress={presionarBotonDoradoEntrar}>
            <Text style={styles.textoBotonDorado}>ENTRAR</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* CONSOLA EDITOR REMOTO EN CALIENTE (EXPO 58 • ESQUEMA 2) */}
      <Modal visible={modalJson} transparent animationType="slide">
        <View style={styles.modalFondo}>
          <View style={styles.modalCaja}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: 12 }}>👑 SUPER APP EXPO 58 • ESQUEMA 2 (JSON)</Text>
              <TouchableOpacity onPress={() => setModalJson(false)}>
                <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 12 }}>✖ CERRAR</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.editorJson}
              multiline
              value={editorTexto}
              onChangeText={setEditorTexto}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.btnPublicarCaliente} onPress={publicarJsonEnCaliente}>
              <Text style={{ color: '#000000', fontWeight: '900', fontSize: 12 }}>🚀 PUBLICAR A ESQUEMA 2 (EXPO 58)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  esquinaInvisible: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 95,
    height: 75,
    zIndex: 999,
    backgroundColor: 'transparent'
  },
  pantallaNegraCandado: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30
  },
  inputTotalmenteInvisible: {
    width: '100%',
    height: 80,
    backgroundColor: '#000000',
    color: '#000000',
    borderWidth: 0,
    borderColor: 'transparent',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16
  },
  botonDoradoEntrar: {
    width: '100%',
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textoBotonDorado: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2
  },
  barraNavegacion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#050A14'
  },
  chipPestana: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  btnEditorAdmin: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#00FF66'
  },
  modalFondo: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    padding: 14
  },
  modalCaja: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#00FF66'
  },
  editorJson: {
    backgroundColor: '#020617',
    color: '#38BDF8',
    fontFamily: 'monospace',
    fontSize: 11,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    height: 350,
    textAlignVertical: 'top'
  },
  btnPublicarCaliente: {
    backgroundColor: '#00FF66',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10
  }
});