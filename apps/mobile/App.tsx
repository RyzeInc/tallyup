import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TallyUp Mobile</Text>
      <Text style={styles.subtitle}>Expo scaffold ready</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b0d10"
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "600"
  },
  subtitle: {
    color: "#9aa3ad",
    marginTop: 8
  }
});
