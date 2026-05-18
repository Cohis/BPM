import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
  import { SafeAreaView } from "react-native-safe-area-context";
  import { StatusBar } from "expo-status-bar";
  import { Audio, AVPlaybackStatusSuccess } from "expo-av";
  import { Feather, MaterialIcons, Ionicons } from "@expo/vector-icons";

  // IP do Servidor — ajuste conforme sua rede
  const SERVER = "http://192.168.0.15:8080";
  const { width, height } = Dimensions.get("window");

  // PALETA DE CORES
  const Cores = {
    principal: "#FF715B",
    fundoLeve: "#FBF9F8",
    cartao: "#FFFFFF",
    textoEscuro: "#1C1C1C",
    textoSuave: "#94A3B8",
    iconeEscuro: "#1C1C1C",
    borda: "#E2E8F0",
    pretoPlayer: "#121212",
  };

  // Mock de capas e artistas
  const mockAlbumArts = [
    "https://img.discogs.com/PZcZ6F4bTj8L9oM_M7I5oT5nZg0=/fit-in/600x600/filters:strip_icc():format(jpeg):mode_rgb():quality(90)/discogs-images/R-1032431-1183991673.jpeg.jpg",
    "https://upload.wikimedia.org/wikipedia/en/2/23/TheStrokes-Reptilia.jpg",
    "https://f4.bcbits.com/img/a1608679093_10.jpg",
    "https://i1.sndcdn.com/artworks-000216168926-25u6wz-t500x500.jpg",
  ];

  const mockArtists = [
    "Deftones",
    "The Strokes",
    "ARTBAT",
    "Bob Moses",
  ];

  // --- UTILITÁRIOS ---
  function formatarTempo(millis: number | undefined) {
    if (!millis) return "0:00";
    const totalSegundos = Math.floor(millis / 1000);
    const minutos = Math.floor(totalSegundos / 60);
    const segundos = totalSegundos % 60;
    return `${minutos}:${segundos < 10 ? "0" : ""}${segundos}`;
  }

  function getMetadados(item: string, index: number) {
    return {
      capa: mockAlbumArts[index % mockAlbumArts.length],
      artista: mockArtists[index % mockArtists.length],
      nomeSimplificado: item.replace(/\.mp3$/i, ""),
    };
  }

  // --- COMPONENTE BARRA DE PROGRESSO (SEEKABLE) ---
  type ProgressBarProps = {
    progress: number;
    onSeek: (percent: number) => void;
    activeColor?: string;
    trackColor?: string;
    height?: number;
  };

  function ProgressBar({
    progress,
    onSeek,
    activeColor = Cores.principal,
    trackColor = Cores.borda,
    height = 4,
  }: ProgressBarProps) {
    const [barWidth, setBarWidth] = useState(0);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        onPress={(e) => {
          if (barWidth > 0) {
            const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth));
            onSeek(pct);
          }
        }}
        style={{ height: 28, justifyContent: "center" }}
      >
        <View
          style={{
            height,
            backgroundColor: trackColor,
            borderRadius: height / 2,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              backgroundColor: activeColor,
              borderRadius: height / 2,
            }}
          />
        </View>
      </TouchableOpacity>
    );
  }

  // --- PLAYER FULL SCREEN ---
  type PlayerFullScreenProps = {
    songTocando: string;
    currentIndex: number;
    statusToca: AVPlaybackStatusSuccess | null;
    onClose: () => void;
    onTogglePlayPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    onSeek: (percent: number) => void;
  };

  function PlayerFullScreen({
    songTocando,
    currentIndex,
    statusToca,
    onClose,
    onTogglePlayPause,
    onNext,
    onPrev,
    onSeek,
  }: PlayerFullScreenProps) {
    const meta = getMetadados(songTocando, currentIndex);
    const duracaoTotal = formatarTempo(statusToca?.durationMillis);
    const tempoAtual = formatarTempo(statusToca?.positionMillis);
    const progresso =
      statusToca && statusToca.durationMillis
        ? statusToca.positionMillis / statusToca.durationMillis
        : 0;

    return (
      <SafeAreaView style={styles.fullPlayerContainer}>
        <StatusBar style="dark" />

        <View style={styles.fullHeader}>
          <TouchableOpacity onPress={onClose}>
            <Feather name="chevron-left" size={28} color={Cores.iconeEscuro} />
          </TouchableOpacity>
          <Text style={styles.fullHeaderTitulo}>Now playing</Text>
          <TouchableOpacity>
            <Ionicons name="settings-sharp" size={24} color={Cores.iconeEscuro} />
          </TouchableOpacity>
        </View>

        <View style={styles.discoContainer}>
          <Image source={{ uri: meta.capa }} style={styles.discoImagem} />
          <TouchableOpacity
            style={styles.discoPlayCentral}
            onPress={onTogglePlayPause}
          >
            <Ionicons
              name={statusToca?.isPlaying ? "pause" : "play"}
              size={24}
              color={Cores.pretoPlayer}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.fullInfoMusica}>
          <Text style={styles.fullTituloMusica}>{meta.nomeSimplificado}</Text>
          <Text style={styles.fullArtistaMusica}>{meta.artista}</Text>
        </View>

        <View style={{ marginHorizontal: 32, marginBottom: 8 }}>
          <ProgressBar progress={progresso} onSeek={onSeek} />
        </View>

        <View style={styles.fullTemposContainer}>
          <Text style={styles.fullTempoTexto}>{tempoAtual}</Text>
          <Text style={styles.fullTempoDividor}>|</Text>
          <Text style={styles.fullTempoTexto}>{duracaoTotal}</Text>
        </View>

        <View style={styles.fullControlesCentrais}>
          <TouchableOpacity onPress={onPrev} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <Ionicons name="play-skip-back" size={32} color={Cores.textoEscuro} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onTogglePlayPause}
            style={styles.botaoPlayCentral}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Ionicons
              name={statusToca?.isPlaying ? "pause" : "play"}
              size={32}
              color="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={onNext} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <Ionicons name="play-skip-forward" size={32} color={Cores.textoEscuro} />
          </TouchableOpacity>
        </View>

        <View style={styles.fullControlesDown}>
          <TouchableOpacity>
            <MaterialIcons name="repeat" size={24} color={Cores.textoSuave} />
          </TouchableOpacity>
          <TouchableOpacity>
            <MaterialIcons name="playlist-play" size={26} color={Cores.textoSuave} />
          </TouchableOpacity>
          <TouchableOpacity>
            <Feather name="heart" size={22} color={Cores.principal} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- COMPONENTE PRINCIPAL ---
  export default function Index() {
    const [token, setToken] = useState("");
    const [usuario, setUsuario] = useState("");
    const [senha, setSenha] = useState("");
    const [songs, setSongs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(-1);

    const soundRef = useRef<Audio.Sound | null>(null);
    const [songTocando, setSongTocando] = useState("");
    const [statusToca, setStatusToca] = useState<AVPlaybackStatusSuccess | null>(null);
    const [showFullPlayer, setShowFullPlayer] = useState(false);

    // Refs para evitar stale closures
    const tokenRef = useRef(token);
    const songsRef = useRef(songs);
    const currentIndexRef = useRef(currentIndex);
    const tocarProximaRef = useRef(() => {});

    // Throttle para updates de progresso (evita re-render excessivo)
    const lastUpdateRef = useRef(0);
    const pendingStatusRef = useRef<AVPlaybackStatusSuccess | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => { tokenRef.current = token; }, [token]);
    useEffect(() => { songsRef.current = songs; }, [songs]);
    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

    const logado = token !== "";

    // Configuração de áudio + cleanup
    useEffect(() => {
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      return () => {
        if (soundRef.current) {
          soundRef.current.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
      };
    }, []);

    // Throttled status update usando requestAnimationFrame
    const throttledSetStatus = useCallback((status: AVPlaybackStatusSuccess) => {
      pendingStatusRef.current = status;
      const now = Date.now();
      if (now - lastUpdateRef.current < 1000) {
        // Se passou menos de 1s, agenda no próximo frame
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (pendingStatusRef.current) {
              setStatusToca(pendingStatusRef.current);
              pendingStatusRef.current = null;
              lastUpdateRef.current = Date.now();
            }
          });
        }
        return;
      }
      // Se passou 1s+, atualiza imediatamente
      setStatusToca(status);
      lastUpdateRef.current = now;
      pendingStatusRef.current = null;
    }, []);

    // Logout completo
    const logout = useCallback(async () => {
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); } catch (e) {}
        try { await soundRef.current.unloadAsync(); } catch (e) {}
        soundRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setToken("");
      setSongs([]);
      setSongTocando("");
      setCurrentIndex(-1);
      setStatusToca(null);
      setShowFullPlayer(false);
      setUsuario("");
      setSenha("");
      lastUpdateRef.current = 0;
      pendingStatusRef.current = null;
    }, []);

    // Login
    async function login() {
      if (!usuario || !senha) {
        Alert.alert("Atenção", "Preencha usuário e senha");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${SERVER}/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ us: usuario, pass: senha }),
        });

        if (res.status === 401 || res.status === 403) {
          Alert.alert("Erro", "Credenciais inválidas");
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error("Erro no servidor");

        const data = await res.json();
        if (data.token) {
          setToken(data.token);
          buscarMusicas(data.token);
        } else {
          Alert.alert("Erro", data.error || "Falha no login");
        }
      } catch (err) {
        Alert.alert("Erro", "Não foi possível conectar ao servidor");
      }
      setLoading(false);
    }

    // Buscar músicas
    async function buscarMusicas(t: string) {
      setLoading(true);
      try {
        const res = await fetch(`${SERVER}/songs`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (res.status === 401 || res.status === 403) {
          Alert.alert("Sessão expirada", "Faça login novamente.");
          logout();
          return;
        }
        if (!res.ok) throw new Error("Erro no servidor");
        const data = await res.json();
        if (Array.isArray(data)) {
          setSongs(data);
        } else {
          throw new Error("Resposta inválida");
        }
      } catch (err) {
        Alert.alert("Erro", "Não foi possível buscar músicas");
      }
      setLoading(false);
    }

    // Carregar e tocar música
    const carregarETocar = useCallback(async (item: string, index?: number, openPlayer = false) => {
      // Cancela qualquer RAF pendente
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastUpdateRef.current = 0;
      pendingStatusRef.current = null;

      // Para e descarrega a atual
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); } catch (e) {}
        try { await soundRef.current.unloadAsync(); } catch (e) {}
        soundRef.current = null;
      }

      const idx = index !== undefined ? index : songsRef.current.indexOf(item);
      if (idx === -1) {
        Alert.alert("Erro", "Música não encontrada na lista");
        return;
      }

      setCurrentIndex(idx);
      setSongTocando(item);
      setStatusToca(null);

      try {
        const source = {
          uri: `${SERVER}/songs/${encodeURIComponent(item)}?token=${tokenRef.current}`,
        };
        const { sound } = await Audio.Sound.createAsync(
          source,
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              throttledSetStatus(status);
              if (status.didJustFinish && !status.isLooping) {
                tocarProximaRef.current();
              }
            }
          }
        );
        soundRef.current = sound;
        if (openPlayer) setShowFullPlayer(true);
      } catch (error) {
        Alert.alert("Erro", "Não foi possível carregar o streaming da música.");
        setSongTocando("");
        setCurrentIndex(-1);
      }
    }, [throttledSetStatus]);

    // Toggle play/pause
    const togglePlayPause = useCallback(async () => {
      if (!soundRef.current) return;
      try {
        const status = await soundRef.current.getStatusAsync();
        if (!status.isLoaded) return;
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
        } else {
          await soundRef.current.playAsync();
        }
      } catch (e) {
        // ignora
      }
    }, []);

    // Seek
    const seekTo = useCallback(async (percent: number) => {
      if (!soundRef.current || !statusToca?.durationMillis) return;
      const position = Math.floor(percent * statusToca.durationMillis);
      try {
        await soundRef.current.setPositionAsync(position);
      } catch (e) {
        // ignora
      }
    }, [statusToca?.durationMillis]);

    // Próxima música
    const tocarProxima = useCallback(() => {
      const list = songsRef.current;
      const idx = currentIndexRef.current;
      if (list.length === 0) return;
      const next = (idx + 1) % list.length;
      carregarETocar(list[next], next);
    }, [carregarETocar]);

    // Música anterior
    const tocarAnterior = useCallback(() => {
      const list = songsRef.current;
      const idx = currentIndexRef.current;
      if (list.length === 0) return;
      const prev = idx <= 0 ? list.length - 1 : idx - 1;
      carregarETocar(list[prev], prev);
    }, [carregarETocar]);

    useEffect(() => {
      tocarProximaRef.current = tocarProxima;
    }, [tocarProxima]);

    // Progresso para mini player
    const miniProgress =
      statusToca && statusToca.durationMillis
        ? statusToca.positionMillis / statusToca.durationMillis
        : 0;

    // --- TELA DE LOGIN ---
    if (!logado) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: Cores.fundoLeve }]}>
          <StatusBar style="dark" />
          <View style={styles.loginCard}>
            <Text style={styles.loginTitulo}>HeartBeat</Text>
            <Text style={styles.loginSubtitulo}>faça login para continuar</Text>

            <View style={styles.inputContainer}>
              <Feather name="user" size={18} color={Cores.textoSuave} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="usuário"
                placeholderTextColor={Cores.textoSuave}
                autoCapitalize="none"
                value={usuario}
                onChangeText={setUsuario}
              />
            </View>

            <View style={styles.inputContainer}>
              <Feather name="lock" size={18} color={Cores.textoSuave} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="senha"
                placeholderTextColor={Cores.textoSuave}
                secureTextEntry
                value={senha}
                onChangeText={setSenha}
              />
            </View>

            <TouchableOpacity style={styles.botao} onPress={login} activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.botaoTexto}>entrar</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    // --- PLAYER FULL SCREEN ---
    if (showFullPlayer && songTocando !== "") {
      return (
        <PlayerFullScreen
          songTocando={songTocando}
          currentIndex={currentIndex}
          statusToca={statusToca}
          onClose={() => setShowFullPlayer(false)}
          onTogglePlayPause={togglePlayPause}
          onNext={tocarProxima}
          onPrev={tocarAnterior}
          onSeek={seekTo}
        />
      );
    }

    // --- TELA PRINCIPAL (DISCOVER) ---
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Cores.fundoLeve }]}>
        <StatusBar style="dark" />

        <View style={styles.discoverHeader}>
          <View>
            <Text style={styles.discoverTitulo}>Discover</Text>
            <View style={styles.discoverTabsContainer}>
              <Text style={styles.tabAtiva}>HeartBeat</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
            <TouchableOpacity onPress={logout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="log-out" size={22} color={Cores.iconeEscuro} />
            </TouchableOpacity>
            <Feather name="search" size={24} color={Cores.iconeEscuro} />
          </View>
        </View>

        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>
            <Text style={styles.coracinho}>-</Text> Recent
          </Text>
        </View>

        {loading ? (
          <View style={styles.centro}>
            <ActivityIndicator color={Cores.principal} size="large" />
          </View>
        ) : songs.length === 0 ? (
          <View style={styles.centro}>
            <Text style={{ color: Cores.textoSuave }}>Nenhuma música encontrada</Text>
          </View>
        ) : (
          <FlatList
            data={songs}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.listaScrollPadding}
            renderItem={({ item, index }) => {
              const meta = getMetadados(item, index);
              return (
                <TouchableOpacity
                  style={[
                    styles.musicaItem,
                    songTocando === item && styles.musicaItemAtivo,
                  ]}
                  onPress={() => carregarETocar(item, index, true)}
                  activeOpacity={0.7}
                >
                  <Image source={{ uri: meta.capa }} style={styles.musicaCapa} />
                  <View style={styles.musicaTextos}>
                    <Text style={styles.musicaNome}>{meta.nomeSimplificado}</Text>
                    <Text style={styles.musicaArtista}>{meta.artista}</Text>
                  </View>
                  <Text style={styles.musicaTempo}>3:12</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {songTocando !== "" && (
          <View style={styles.miniPlayerWrapper}>
            <View style={styles.miniPlayerProgressTrack}>
              <View
                style={[
                  styles.miniPlayerProgressFill,
                  { width: `${miniProgress * 100}%` },
                ]}
              />
            </View>

            <TouchableOpacity
              style={styles.miniPlayer}
              onPress={() => setShowFullPlayer(true)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: getMetadados(songTocando, currentIndex).capa }}
                style={styles.miniPlayerCapa}
              />
              <View style={styles.miniPlayerTextos}>
                <Text style={styles.miniPlayerTitulo} numberOfLines={1}>
                  {getMetadados(songTocando, currentIndex).nomeSimplificado}
                </Text>
                <Text style={styles.miniPlayerArtista}>
                  {getMetadados(songTocando, currentIndex).artista}
                </Text>
              </View>
              <View style={styles.miniPlayerControles}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    tocarAnterior();
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="play-skip-back" size={20} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    togglePlayPause();
                  }}
                  style={{ marginHorizontal: 12 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={statusToca?.isPlaying ? "pause" : "play"}
                    size={24}
                    color="#fff"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    tocarProxima();
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="play-skip-forward" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const styles = StyleSheet.create({
    centro: { flex: 1, justifyContent: "center", alignItems: "center" },
    container: { flex: 1 },

    loginCard: {
      backgroundColor: Cores.cartao,
      marginHorizontal: 24,
      marginTop: height * 0.15,
      padding: 32,
      borderRadius: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 3,
    },
    loginTitulo: {
      fontSize: 34,
      fontWeight: "800",
      color: Cores.textoEscuro,
      marginBottom: 4,
      textAlign: "center",
    },
    loginSubtitulo: {
      fontSize: 15,
      color: Cores.textoSuave,
      marginBottom: 40,
      textAlign: "center",
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Cores.fundoLeve,
      borderWidth: 1,
      borderColor: Cores.borda,
      borderRadius: 12,
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    inputIcon: { marginRight: 10 },
    input: {
      flex: 1,
      color: Cores.textoEscuro,
      paddingVertical: 16,
      fontSize: 16,
    },
    botao: {
      backgroundColor: Cores.principal,
      borderRadius: 12,
      padding: 18,
      alignItems: "center",
      marginTop: 20,
    },
    botaoTexto: {
      color: "#fff",
      fontWeight: "bold",
      fontSize: 16,
    },
    discoverHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginHorizontal: 24,
      marginVertical: 20,
    },
    discoverTitulo: {
      fontSize: 34,
      fontWeight: "800",
      color: Cores.textoEscuro,
    },
    discoverTabsContainer: {
      flexDirection: "row",
      marginTop: 8,
    },
    tabAtiva: {
      fontSize: 14,
      color: Cores.principal,
      fontWeight: "bold",
    },
    sectionTitleContainer: {
      marginLeft: -10,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: Cores.textoEscuro,
      paddingHorizontal: 24,
    },
    coracinho: { color: Cores.principal },

    listaScrollPadding: { paddingBottom: 140, paddingHorizontal: 24 },
    musicaItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      marginBottom: 8,
    },
    musicaItemAtivo: {
      backgroundColor: Cores.principal + "0A",
      borderRadius: 12,
      marginHorizontal: -12,
      paddingHorizontal: 12,
    },
    musicaCapa: {
      width: 48,
      height: 48,
      borderRadius: 12,
      marginRight: 16,
    },
    musicaTextos: { flex: 1 },
    musicaNome: {
      color: Cores.textoEscuro,
      fontSize: 16,
      fontWeight: "700",
    },
    musicaArtista: {
      color: Cores.textoSuave,
      fontSize: 14,
      marginTop: 2,
    },
    musicaTempo: {
      color: Cores.textoSuave,
      fontSize: 13,
    },

    miniPlayerWrapper: {
      position: "absolute",
      bottom: 24,
      left: 24,
      right: 24,
      borderRadius: 16,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 10,
    },
    miniPlayerProgressTrack: {
      height: 2,
      backgroundColor: "#333",
    },
    miniPlayerProgressFill: {
      height: "100%",
      backgroundColor: Cores.principal,
    },
    miniPlayer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Cores.pretoPlayer,
      padding: 12,
    },
    miniPlayerCapa: {
      width: 44,
      height: 44,
      borderRadius: 12,
      marginRight: 14,
    },
    miniPlayerTextos: { flex: 1 },
    miniPlayerTitulo: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "bold",
    },
    miniPlayerArtista: {
      color: Cores.textoSuave,
      fontSize: 13,
      marginTop: 2,
    },
    miniPlayerControles: {
      flexDirection: "row",
      alignItems: "center",
    },

    fullPlayerContainer: {
      flex: 1,
      backgroundColor: Cores.cartao,
    },
    fullHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    fullHeaderTitulo: {
      fontSize: 14,
      fontWeight: "bold",
      color: Cores.textoEscuro,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    discoContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    discoImagem: {
      width: width * 0.7,
      height: width * 0.7,
      borderRadius: width * 0.35,
      borderWidth: 2,
      borderColor: Cores.borda,
    },
    discoPlayCentral: {
      position: "absolute",
      backgroundColor: "#fff",
      padding: 18,
      borderRadius: 50,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    fullInfoMusica: {
      alignItems: "center",
      marginBottom: 24,
      paddingHorizontal: 24,
    },
    fullTituloMusica: {
      fontSize: 28,
      fontWeight: "800",
      color: Cores.textoEscuro,
      textAlign: "center",
    },
    fullArtistaMusica: {
      fontSize: 16,
      color: Cores.principal,
      marginTop: 8,
    },
    fullTemposContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 24,
    },
    fullTempoTexto: {
      fontSize: 14,
      color: Cores.textoSuave,
    },
    fullTempoDividor: {
      color: Cores.borda,
      marginHorizontal: 12,
    },
    fullControlesCentrais: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 40,
      marginBottom: 32,
    },
    botaoPlayCentral: {
      backgroundColor: Cores.principal,
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: Cores.principal,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    fullControlesDown: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      marginHorizontal: 60,
      marginBottom: 40,
    },
  });