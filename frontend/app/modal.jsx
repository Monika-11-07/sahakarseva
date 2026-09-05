import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Urban Home</Text>
      <Link href="/" dismissTo style={styles.link}>Return home</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { color: '#203747', fontSize: 24, fontWeight: '700' },
  link: { color: '#ef795e', marginTop: 16 },
});