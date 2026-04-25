import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";

const SERVER = "http://192.168.10.16:8080";

export default function Index() {
  const [token, setToken] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tocando, setTocando] = useState("");

  const logado = token !== "";

  async function login() {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ us: usuario, pass: senha }),
      });

      const data = await res.json();

      if (res.ok) {
        setToken(data.token);
        buscarMusicas(data.token);
      } else {
        Alert.alert("Erro", data.error || "Credenciais inválidas");
      }
    } catch (err) {
      Alert.alert("Erro", "Não foi possível conectar ao servidor");
    }
    setLoading(false);
  }

  async function buscarMusicas(t: string) {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER}/songs`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setSongs(data);
    } catch (err) {
      Alert.alert("Erro", "Não foi possível buscar músicas");
    }
    setLoading(false);
  }

  if (!logado) {
    return (
      <View style={styles.container}>
        <Text style={styles.titulo}>HeartBeat</Text>
        <Text style={styles.subtitulo}>faça login para continuar</Text>

        <TextInput
          style={styles.input}
          placeholder="usuário"
          placeholderTextColor="#666"
          autoCapitalize="none"
          onChangeText={setUsuario}
        />

        <TextInput
          style={styles.input}
          placeholder="senha"
          placeholderTextColor="#666"
          secureTextEntry
          onChangeText={setSenha}
        />

        <TouchableOpacity style={styles.botao} onPress={login}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.botaoTexto}>entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>HeartBeat</Text>
      <Text style={styles.subtitulo}>suas músicas</Text>

      {loading ? (
        <ActivityIndicator color="#1DB954" size="large" />
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => item}
          style={styles.lista}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.musicaItem,
                tocando === item && styles.musicaItemAtivo,
              ]}
              onPress={() => setTocando(item)}
            >
              <Text style={styles.musicaNome}>{item}</Text>
              {tocando === item && (
                <Text style={styles.tocandoLabel}>▶ tocando</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {tocando !== "" && (
        <View style={styles.player}>
          <Text style={styles.playerTexto} numberOfLines={1}>
            {tocando}
          </Text>
          <TouchableOpacity onPress={() => setTocando("")}>
            <Text style={styles.playerParar}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  titulo: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1DB954",
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 14,
    color: "#666",
    marginBottom: 40,
  },
  input: {
    backgroundColor: "#1e1e1e",
    color: "#fff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  botao: {
    backgroundColor: "#1DB954",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  botaoTexto: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 16,
  },
  lista: {
    flex: 1,
  },
  musicaItem: {
    backgroundColor: "#1e1e1e",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  musicaItemAtivo: {
    backgroundColor: "#1a3a2a",
    borderColor: "#1DB954",
    borderWidth: 1,
  },
  musicaNome: {
    color: "#fff",
    fontSize: 15,
  },
  tocandoLabel: {
    color: "#1DB954",
    fontSize: 12,
    marginTop: 4,
  },
  player: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  playerTexto: {
    color: "#fff",
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  playerParar: {
    color: "#666",
    fontSize: 18,
  },
});